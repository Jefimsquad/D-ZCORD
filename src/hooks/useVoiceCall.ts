import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { UserProfile } from '../types';
import { getSupabase } from '../lib/supabase';
import { RTC_CONFIG, type LocalMediaFlags, type SignalPayload, type VoicePeerInfo } from '../lib/voice';

export interface RemoteAudio {
  user_id: string;
  stream: MediaStream;
}

export interface RemoteVideo {
  user_id: string;
  streamId: string;
  stream: MediaStream;
}

interface UseVoiceCallResult {
  micStream: MediaStream | null;
  micError: boolean;
  localCam: MediaStream | null;
  localScreen: MediaStream | null;
  cameraOn: boolean;
  screenOn: boolean;
  mediaError: string | null;
  toggleCamera: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  remotes: RemoteAudio[];
  remoteVideos: RemoteVideo[];
  speakingIds: string[];
}

// Mesh WebRTC (áudio + câmera + tela) com padrão polite/impolite:
// qualquer lado pode renegociar; colisão de ofertas se resolve pelo ID.
export function useVoiceCall(
  channelId: string,
  localUser: UserProfile,
  isMuted: boolean,
  enabled: boolean,
  participants: VoicePeerInfo[],
  onMediaChange?: (flags: LocalMediaFlags) => void
): UseVoiceCallResult {
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [micError, setMicError] = useState(false);
  const [localCam, setLocalCam] = useState<MediaStream | null>(null);
  const [localScreen, setLocalScreen] = useState<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [remotes, setRemotes] = useState<RemoteAudio[]>([]);
  const [remoteVideos, setRemoteVideos] = useState<RemoteVideo[]>([]);
  const [speakingIds, setSpeakingIds] = useState<string[]>([]);
  const [signalReady, setSignalReady] = useState(false);

  const peersRef = useRef(new Map<string, RTCPeerConnection>());
  const makingOfferRef = useRef(new Map<string, boolean>());
  const pendingIceRef = useRef(new Map<string, RTCIceCandidateInit[]>());
  const micStreamRef = useRef<MediaStream | null>(null);
  const signalChRef = useRef<RealtimeChannel | null>(null);
  // Streams de envio (IDs estáveis sinalizados via presença)
  const sendLiveRef = useRef<MediaStream | null>(null);
  const sendScreenRef = useRef<MediaStream | null>(null);
  const camTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenTracksRef = useRef<MediaStreamTrack[]>([]);
  const onMediaChangeRef = useRef(onMediaChange);
  onMediaChangeRef.current = onMediaChange;

  const userId = localUser.id;

  const ensureSendStreams = () => {
    if (!sendLiveRef.current) sendLiveRef.current = new MediaStream();
    if (!sendScreenRef.current) sendScreenRef.current = new MediaStream();
  };

  const notifyMedia = useCallback(() => {
    onMediaChangeRef.current?.({
      video: !!camTrackRef.current,
      screensharing: screenTracksRef.current.length > 0,
      camStreamId: sendLiveRef.current?.id || '',
      screenStreamId: sendScreenRef.current?.id || '',
    });
  }, []);

  // --- Microfone local ---
  useEffect(() => {
    if (!enabled || !userId) {
      setMicStream(null);
      return;
    }
    let cancelled = false;
    let stream: MediaStream | null = null;
    setMicError(false);
    navigator.mediaDevices
      ?.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          sampleSize: 16,
          channelCount: 1,
        },
      })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        micStreamRef.current = s;
        ensureSendStreams();
        s.getAudioTracks().forEach((t) => {
          t.enabled = !isMutedRef.current;
          try {
            sendLiveRef.current!.addTrack(t);
          } catch {
            /* já adicionada */
          }
        });
        setMicStream(s);
      })
      .catch(() => {
        if (!cancelled) setMicError(true);
      });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      if (micStreamRef.current === stream) micStreamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, userId, channelId]);

  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;
  useEffect(() => {
    micStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !isMuted;
    });
  }, [isMuted]);

  // --- Limpa mídia local ao sair da call ---
  useEffect(() => {
    if (enabled) return;
    return () => {
      camTrackRef.current?.stop();
      camTrackRef.current = null;
      screenTracksRef.current.forEach((t) => t.stop());
      screenTracksRef.current = [];
      sendLiveRef.current = null;
      sendScreenRef.current = null;
      setLocalCam(null);
      setLocalScreen(null);
      setCameraOn(false);
      setScreenOn(false);
    };
  }, [enabled]);

  // --- Peers ---
  const closePeer = useCallback((id: string) => {
    peersRef.current.get(id)?.close();
    peersRef.current.delete(id);
    makingOfferRef.current.delete(id);
    pendingIceRef.current.delete(id);
    setRemotes((prev) => prev.filter((r) => r.user_id !== id));
    setRemoteVideos((prev) => prev.filter((r) => r.user_id !== id));
  }, []);

  const sendSignal = useCallback(
    (to: string, payload: Omit<SignalPayload, 'to' | 'from'>) => {
      signalChRef.current?.send({
        type: 'broadcast',
        event: 'signal',
        payload: { ...payload, to, from: userId } as SignalPayload,
      });
    },
    [userId]
  );

  const negotiate = useCallback(
    async (id: string, attempt = 0) => {
      const pc = peersRef.current.get(id);
      if (!pc || makingOfferRef.current.get(id)) return;
      makingOfferRef.current.set(id, true);
      try {
        await pc.setLocalDescription();
        const ld = pc.localDescription;
        if (ld) {
          await sendSignal(id, { kind: 'offer', sdp: ld.sdp, sdpType: ld.type });
        }
      } catch {
        // Falha transitória (ex: oferta remota chegou junto): 1 retry se estável
        if (attempt < 2) {
          setTimeout(() => {
            const cur = peersRef.current.get(id);
            if (cur && cur.signalingState === 'stable') negotiate(id, attempt + 1);
          }, 1500);
        }
      } finally {
        makingOfferRef.current.set(id, false);
      }
    },
    [sendSignal]
  );

  const attachAllTracks = useCallback((pc: RTCPeerConnection) => {
    const mic = micStreamRef.current;
    mic?.getAudioTracks().forEach((track) => {
      if (!pc.getSenders().some((s) => s.track === track) && sendLiveRef.current) {
        try {
          pc.addTrack(track, sendLiveRef.current);
        } catch {
          /* duplicada */
        }
      }
    });
    if (camTrackRef.current && sendLiveRef.current) {
      if (!pc.getSenders().some((s) => s.track === camTrackRef.current)) {
        try {
          pc.addTrack(camTrackRef.current, sendLiveRef.current);
        } catch {
          /* duplicada */
        }
      }
    }
    if (sendScreenRef.current) {
      screenTracksRef.current.forEach((track) => {
        if (!pc.getSenders().some((s) => s.track === track)) {
          try {
            pc.addTrack(track, sendScreenRef.current!);
          } catch {
            /* duplicada */
          }
        }
      });
    }
  }, []);

  const bindPeer = useCallback(
    (id: string, pc: RTCPeerConnection) => {
      pc.onnegotiationneeded = () => {
        negotiate(id);
      };
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendSignal(id, { kind: 'ice', candidate: e.candidate.toJSON() });
        }
      };
      pc.ontrack = (e) => {
        const stream = e.streams[0];
        const track = e.track;
        if (!stream || !track) return;
        if (track.kind === 'audio') {
          setRemotes((prev) =>
            prev.some((r) => r.user_id === id)
              ? prev.map((r) => (r.user_id === id ? { ...r, stream } : r))
              : [...prev, { user_id: id, stream }]
          );
        } else {
          setRemoteVideos((prev) => {
            const without = prev.filter((r) => !(r.user_id === id && r.streamId === stream.id));
            return [...without, { user_id: id, streamId: stream.id, stream }];
          });
          track.onended = () => {
            setRemoteVideos((prev) => prev.filter((r) => !(r.user_id === id && r.streamId === stream.id)));
          };
        }
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          closePeer(id);
        }
      };
    },
    [closePeer, negotiate, sendSignal]
  );

  const createPeer = useCallback(
    (id: string) => {
      if (peersRef.current.has(id)) return peersRef.current.get(id)!;
      const pc = new RTCPeerConnection(RTC_CONFIG);
      peersRef.current.set(id, pc);
      bindPeer(id, pc);
      attachAllTracks(pc);
      return pc;
    },
    [attachAllTracks, bindPeer]
  );

  // --- Sinalização ---
  useEffect(() => {
    const supabase: SupabaseClient | null = getSupabase();
    if (!supabase || !enabled || !userId || !channelId) return;

    const onSignal = async (p: SignalPayload) => {
      if (!p || p.to !== userId || !p.from) return;
      const polite = userId < p.from;
      if (p.kind === 'offer' && p.sdp) {
        const pc = createPeer(p.from);
        const collision = pc.signalingState !== 'stable' || makingOfferRef.current.get(p.from);
        if (collision && !polite) return; // impolite ignora; o polite resolve
        try {
          await pc.setRemoteDescription({ type: p.sdpType || 'offer', sdp: p.sdp });
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendSignal(p.from, { kind: 'answer', sdp: answer.sdp, sdpType: answer.type });
          const queued = pendingIceRef.current.get(p.from) || [];
          pendingIceRef.current.delete(p.from);
          for (const c of queued) {
            await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
          }
        } catch {
          closePeer(p.from);
        }
      } else if (p.kind === 'answer' && p.sdp) {
        const pc = peersRef.current.get(p.from);
        if (!pc || pc.signalingState === 'stable') return;
        try {
          await pc.setRemoteDescription({ type: p.sdpType || 'answer', sdp: p.sdp });
          const queued = pendingIceRef.current.get(p.from) || [];
          pendingIceRef.current.delete(p.from);
          for (const c of queued) {
            await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
          }
        } catch {
          closePeer(p.from);
        }
      } else if (p.kind === 'ice' && p.candidate) {
        const pc = peersRef.current.get(p.from);
        if (pc?.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(p.candidate)).catch(() => {});
        } else {
          const q = pendingIceRef.current.get(p.from) || [];
          q.push(p.candidate);
          pendingIceRef.current.set(p.from, q);
        }
      }
    };

    const ch = supabase.channel(`voice-signal:${channelId}`, {
      config: { broadcast: { self: false } },
    });
    signalChRef.current = ch;
    ch.on('broadcast', { event: 'signal' }, ({ payload }) => {
      onSignal(payload as SignalPayload);
    }).subscribe((status) => {
      // Só negocia depois do canal pronto: oferta antes disso é descartada
      if (status === 'SUBSCRIBED') setSignalReady(true);
    });

    return () => {
      setSignalReady(false);
      supabase.removeChannel(ch);
      signalChRef.current = null;
    };
  }, [enabled, userId, channelId, createPeer, sendSignal, closePeer]);

  // --- Descoberta: cria PC com quem está na call / limpa quem saiu ---
  // (só após sinalização pronta; oferta antes disso seria descartada)
  useEffect(() => {
    if (!enabled || !signalReady) return;
    participants.forEach((p) => {
      if (p.user_id !== userId && !peersRef.current.has(p.user_id)) {
        createPeer(p.user_id);
        negotiate(p.user_id);
      }
    });
    const ids = new Set(participants.map((p) => p.user_id));
    peersRef.current.forEach((_pc, id) => {
      if (!ids.has(id)) closePeer(id);
    });
  }, [participants, enabled, signalReady, userId, createPeer, negotiate, closePeer]);

  // --- Microfone chegou depois dos peers: anexa e renegocia ---
  useEffect(() => {
    if (!enabled || !micStream) return;
    peersRef.current.forEach((pc) => attachAllTracks(pc));
  }, [micStream, enabled, attachAllTracks]);

  // Fecha tudo ao desmontar/trocar de canal
  useEffect(() => {
    return () => {
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();
      makingOfferRef.current.clear();
      pendingIceRef.current.clear();
      setRemotes([]);
      setRemoteVideos([]);
    };
  }, [channelId]);

  // --- Câmera (transmite para todos) ---
  const toggleCamera = useCallback(async () => {
    setMediaError(null);
    if (camTrackRef.current) {
      peersRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track === camTrackRef.current);
        if (sender) pc.removeTrack(sender);
      });
      camTrackRef.current.stop();
      camTrackRef.current = null;
      setLocalCam(null);
      setCameraOn(false);
      notifyMedia();
      return;
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Navegador sem suporte a câmera (use HTTPS/localhost)');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      if (!track) throw new Error('Nenhuma trilha de vídeo retornada');
      ensureSendStreams();
      camTrackRef.current = track;
      setLocalCam(new MediaStream([track]));
      setCameraOn(true);
      peersRef.current.forEach((pc) => attachAllTracks(pc));
      notifyMedia();
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      setMediaError(
        name === 'NotAllowedError'
          ? 'Permissão de câmera negada. Libere no navegador e tente de novo.'
          : 'Câmera indisponível neste dispositivo/navegador.'
      );
    }
  }, [attachAllTracks, notifyMedia]);

  // --- Compartilhamento de tela (transmite para todos) ---
  const toggleScreenShare = useCallback(async () => {
    setMediaError(null);
    if (screenTracksRef.current.length > 0) {
      peersRef.current.forEach((pc) => {
        pc.getSenders()
          .filter((s) => s.track && screenTracksRef.current.includes(s.track))
          .forEach((s) => pc.removeTrack(s));
      });
      screenTracksRef.current.forEach((t) => t.stop());
      screenTracksRef.current = [];
      setLocalScreen(null);
      setScreenOn(false);
      notifyMedia();
      return;
    }
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error('Navegador sem suporte a compartilhamento (use Chrome/Edge HTTPS)');
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      if (!stream.getVideoTracks().length) {
        throw new Error('Nenhuma trilha de vídeo retornada');
      }
      ensureSendStreams();
      screenTracksRef.current = stream.getTracks();
      setLocalScreen(stream);
      setScreenOn(true);
      stream.getVideoTracks()[0].onended = () => {
        if (screenTracksRef.current.length === 0) return;
        peersRef.current.forEach((pc) => {
          pc.getSenders()
            .filter((s) => s.track && screenTracksRef.current.includes(s.track))
            .forEach((s) => pc.removeTrack(s));
        });
        screenTracksRef.current.forEach((t) => t.stop());
        screenTracksRef.current = [];
        setLocalScreen(null);
        setScreenOn(false);
        notifyMedia();
      };
      peersRef.current.forEach((pc) => attachAllTracks(pc));
      notifyMedia();
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      if (name === 'NotAllowedError' || name === 'AbortError') return;
      setMediaError('Falha ao compartilhar tela. Use Chrome/Edge em HTTPS ou localhost.');
    }
  }, [attachAllTracks, notifyMedia]);

  // --- Detecção de fala dos remotos (anel verde) ---
  useEffect(() => {
    if (!remotes.length) {
      setSpeakingIds([]);
      return;
    }
    let ctx: AudioContext | null = null;
    let anim = 0;
    let stopped = false;
    try {
      ctx = new AudioContext();
    } catch {
      return;
    }
    const analysers = remotes
      .map((r) => {
        const a = ctx!.createAnalyser();
        a.fftSize = 512;
        try {
          ctx!.createMediaStreamSource(r.stream).connect(a);
        } catch {
          return null;
        }
        const buf = new Uint8Array(a.fftSize);
        return { id: r.user_id, analyser: a, buf };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const loop = () => {
      if (stopped) return;
      const talking: string[] = [];
      analysers.forEach(({ id, analyser, buf }) => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        if (Math.sqrt(sum / buf.length) > 0.03) talking.push(id);
      });
      setSpeakingIds((prev) => {
        const a = prev.slice().sort().join(',');
        const b = talking.slice().sort().join(',');
        return a === b ? prev : talking;
      });
      anim = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      stopped = true;
      cancelAnimationFrame(anim);
      ctx?.close().catch(() => {});
    };
  }, [remotes]);

  return {
    micStream,
    micError,
    localCam,
    localScreen,
    cameraOn,
    screenOn,
    mediaError,
    toggleCamera,
    toggleScreenShare,
    remotes,
    remoteVideos,
    speakingIds,
  };
}
