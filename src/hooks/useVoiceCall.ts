import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { UserProfile } from '../types';
import { getSupabase } from '../lib/supabase';
import { RTC_CONFIG, getExtraIceServers, ensureTurnServers, type LocalMediaFlags, type SignalPayload, type VoicePeerInfo } from '../lib/voice';
import { isMobileDevice } from '../lib/voice';

export interface RemoteAudio {
  user_id: string;
  streamId: string;
  stream: MediaStream;
  /** Áudio do sistema que vem junto do compartilhamento de tela (PC) */
  screenAudio?: boolean;
}

export interface RemoteVideo {
  user_id: string;
  streamId: string;
  stream: MediaStream;
}

// Diagnóstico por peer (painel "Saúde da call"): diz EXATAMENTE onde trava
// (sinalização? rede/NAT? bytes chegando?) em vez de "conectando" eterno.
export interface PeerDebugInfo {
  user_id: string;
  connectionState: string;
  iceState: string;
  signalingState: string;
  /** bytes de áudio recebidos (-1 = ainda sem medição) */
  audioBytes: number;
  /** bytes de vídeo recebidos (-1 = ainda sem medição) */
  videoBytes: number;
  /** contadores de sinalização (oferta/resposta/gelo enviados/recebidos) */
  offerSent: number;
  offerRecv: number;
  answerSent: number;
  answerRecv: number;
  iceSent: number;
  iceRecv: number;
  lastSignal: string;
}

// Escada automática da tela (cai sozinha quando a rede/CPU não aguenta)
const SCREEN_LADDER = [
  { downBy: 1, fps: 30, bitrate: 5_000_000, label: '1080p' },
  { downBy: 1.5, fps: 20, bitrate: 2_500_000, label: '720p' },
  { downBy: 2, fps: 15, bitrate: 1_200_000, label: '540p' },
  { downBy: 4, fps: 10, bitrate: 600_000, label: '360p' },
];

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
  remoteScreenAudios: RemoteAudio[];
  remoteVideos: RemoteVideo[];
  speakingIds: string[];
  screenQuality: string;
  signalReady: boolean;
  peerDebug: Record<string, PeerDebugInfo>;
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
  const [remoteScreenAudios, setRemoteScreenAudios] = useState<RemoteAudio[]>([]);
  const [remoteVideos, setRemoteVideos] = useState<RemoteVideo[]>([]);
  const [speakingIds, setSpeakingIds] = useState<string[]>([]);
  const [signalReady, setSignalReady] = useState(false);
  const [peerDebug, setPeerDebug] = useState<Record<string, PeerDebugInfo>>({});
  const [screenLevel, setScreenLevel] = useState(0);
  const screenLevelRef = useRef(0);

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
  // Presença mais recente (para separar áudio do mic do áudio do sistema da tela)
  const participantsRef = useRef(participants);
  participantsRef.current = participants;
  // Streams de vídeo já vistos por peer (streamId -> user_id): o áudio que
  // chega no MESMO stream do vídeo é o áudio do sistema da tela, não o mic.
  const videoStreamIdsRef = useRef(new Map<string, string>());
  // Fechamentos adiados (graça de 5s p/ sync parcial da presença)
  const pendingCloseRef = useRef(new Map<string, number>());
  // Tentativas de ICE restart por peer (falha de rede transitória)
  const iceRetryRef = useRef(new Map<string, number>());
  // Contadores de sinalização por peer (diagnóstico definitivo)
  const signalCountersRef = useRef<
    Record<string, { offerSent: number; offerRecv: number; answerSent: number; answerRecv: number; iceSent: number; iceRecv: number; lastSignal: string }>
  >({});
  const bumpSignal = useCallback((id: string, field: 'offerSent' | 'offerRecv' | 'answerSent' | 'answerRecv' | 'iceSent' | 'iceRecv', label: string) => {
    const cur =
      signalCountersRef.current[id] || { offerSent: 0, offerRecv: 0, answerSent: 0, answerRecv: 0, iceSent: 0, iceRecv: 0, lastSignal: '' };
    cur[field] += 1;
    cur.lastSignal = `${label} ${new Date().toLocaleTimeString()}`;
    signalCountersRef.current[id] = cur;
  }, []);

  // --- Qualidade: limita bitrate/fps por tipo (trava menos, adapta à rede) ---
  const tuneSender = useCallback(async (pc: RTCPeerConnection, track: MediaStreamTrack, kind: 'audio' | 'camera' | 'screen') => {    try {
      const sender = pc.getSenders().find((s) => s.track === track);
      if (!sender) return;
      const mobile = isMobileDevice();
      const params = sender.getParameters() as RTCRtpSendParameters & {
        degradationPreference?: 'maintain-framerate' | 'maintain-resolution' | 'balanced';
      };
      if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
      const enc = params.encodings[0];
      if (kind === 'audio') {
        enc.maxBitrate = 64000;
      } else if (kind === 'camera') {
        enc.maxBitrate = mobile ? 700_000 : 1_200_000;
        enc.maxFramerate = mobile ? 24 : 30;
        params.degradationPreference = 'maintain-framerate';
      } else if (kind === 'screen' && isMobileDevice()) {
        // Celular: sempre 720p 30fps fixos
        enc.maxBitrate = 3_000_000;
        enc.maxFramerate = 30;
        params.degradationPreference = 'maintain-resolution';
      } else if (kind === 'screen') {
        // Tela segue a escada automática (screenLevelRef); cai sozinha se travar.
        // Sem maxFramerate aqui de propósito: a captura já limita a 30fps e o
        // Chromium tem bugs conhecidos aplicando maxFramerate em display-capture
        // (vídeo congela/preto no PC). Bitrate + escala resolvem sem esse risco.
        const lvl = SCREEN_LADDER[screenLevelRef.current] || SCREEN_LADDER[0];
        enc.maxBitrate = lvl.bitrate;
        delete (enc as { maxFramerate?: number }).maxFramerate;
        if (lvl.downBy !== 1) enc.scaleResolutionDownBy = lvl.downBy;
        else delete (enc as { scaleResolutionDownBy?: number }).scaleResolutionDownBy;
        params.degradationPreference = 'maintain-resolution';
      }
      await sender.setParameters(params);
    } catch {
      /* navegador sem suporte: segue com padrão */
    }
  }, []);

  const setTrackHint = (track: MediaStreamTrack | null, hint: string) => {
    try {
      if (track) (track as MediaStreamTrack & { contentHint?: string }).contentHint = hint;
    } catch {
      /* sem suporte */
    }
  };

  // Ordem de codec preferida por aparelho (não mexe no comportamento do celular):
  // celular = H264 na tela (hardware = menos trava, já funcionava);
  // PC = VP8 na tela (decodificação universal; evita buraco negro de
  // decode com VP9/AV1 por aceleração de hardware no Windows = tela preta).
  const preferCodec = (pc: RTCPeerConnection, track: MediaStreamTrack, mime: string) => {
    try {
      const sender = pc.getSenders().find((s) => s.track === track);
      const transceiver = pc.getTransceivers().find((t) => t.sender === sender);
      const caps = RTCRtpSender.getCapabilities('video');
      const preferred = (caps?.codecs || []).filter(
        (c) => c.mimeType.toLowerCase() === mime.toLowerCase()
      );
      if (transceiver?.setCodecPreferences && preferred.length) {
        const rest = (caps?.codecs || []).filter((c) => !preferred.includes(c));
        transceiver.setCodecPreferences([...preferred, ...rest]);
      }
    } catch {
      /* sem suporte */
    }
  };

  const preferScreenCodec = (pc: RTCPeerConnection, track: MediaStreamTrack) => {
    if (isMobileDevice()) preferCodec(pc, track, 'video/h264');
    else preferCodec(pc, track, 'video/vp8');
  };

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

  // Aplica o nível atual da escada em todos os senders de tela
  const applyScreenLevel = useCallback(async (level: number) => {
    screenLevelRef.current = level;
    setScreenLevel(level);
    const lvl = SCREEN_LADDER[level] || SCREEN_LADDER[0];
    for (const pc of peersRef.current.values()) {
      for (const sender of pc.getSenders()) {
        if (sender.track && screenTracksRef.current.includes(sender.track)) {
          try {
            const params = sender.getParameters() as RTCRtpSendParameters & {
              degradationPreference?: 'maintain-framerate' | 'maintain-resolution' | 'balanced';
            };
            if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
            const enc = params.encodings[0];
            enc.maxBitrate = lvl.bitrate;
            delete (enc as { maxFramerate?: number }).maxFramerate;
            if (lvl.downBy !== 1) enc.scaleResolutionDownBy = lvl.downBy;
            else delete (enc as { scaleResolutionDownBy?: number }).scaleResolutionDownBy;
            params.degradationPreference = 'maintain-resolution';
            await sender.setParameters(params);
          } catch {
            /* sem suporte */
          }
        }
      }
    }
  }, []);

  // Controlador automático: monitora stats e desce/sobe a escada
  const screenCtlRef = useRef({ lastChange: 0, goodStreak: 0, framesSent: -1, ts: 0 });
  useEffect(() => {
    if (!enabled || !screenOn || isMobileDevice()) return;
    const id = setInterval(async () => {
      const videoTrackId = screenTracksRef.current.find((t) => t.kind === 'video')?.id;
      if (!videoTrackId) return;
      const ctl = screenCtlRef.current;
      const level = screenLevelRef.current;
      const targetFps = SCREEN_LADDER[level]?.fps || 30;
      let worst: 'bandwidth' | 'cpu' | 'other' | 'none' | null = null;
      let fps = -1;
      for (const pc of peersRef.current.values()) {
        try {
          const stats = await pc.getStats();
          stats.forEach((r: unknown) => {
            const s = r as Record<string, unknown>;
            if (s.type === 'outbound-rtp' && (s.kind === 'video' || s.mediaType === 'video') && s.trackIdentifier === videoTrackId) {
              const lim = s.qualityLimitationReason as string | undefined;
              if (lim === 'bandwidth' || lim === 'cpu' || lim === 'other') worst = lim;
              else if (worst === null && lim === 'none') worst = 'none';
              const f = s.framesPerSecond as number | undefined;
              if (typeof f === 'number' && (fps < 0 || f < fps)) fps = f;
            }
          });
        } catch {
          /* ignora */
        }
      }
      const now = Date.now();
      const struggling = worst === 'bandwidth' || worst === 'cpu' || (fps >= 0 && fps < targetFps * 0.5);
      if (struggling && level < SCREEN_LADDER.length - 1 && now - ctl.lastChange > 5000) {
        ctl.lastChange = now;
        ctl.goodStreak = 0;
        await applyScreenLevel(level + 1);
      } else if (!struggling && worst !== null) {
        ctl.goodStreak += 1;
        if (ctl.goodStreak >= 5 && level > 0 && now - ctl.lastChange > 15000) {
          ctl.lastChange = now;
          ctl.goodStreak = 0;
          await applyScreenLevel(level - 1);
        }
      }
    }, 3000);
    return () => clearInterval(id);
  }, [enabled, screenOn, applyScreenLevel]);
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
    videoStreamIdsRef.current.forEach((owner, sid) => {
      if (owner === id) videoStreamIdsRef.current.delete(sid);
    });
    setRemotes((prev) => prev.filter((r) => r.user_id !== id));
    setRemoteScreenAudios((prev) => prev.filter((r) => r.user_id !== id));
    setRemoteVideos((prev) => prev.filter((r) => r.user_id !== id));
  }, []);

  const sendSignal = useCallback(
    (to: string, payload: Omit<SignalPayload, 'to' | 'from'>) => {
      const ch = signalChRef.current;
      if (!ch) return;
      const kind = payload.kind;
      bumpSignal(to, kind === 'offer' ? 'offerSent' : kind === 'answer' ? 'answerSent' : 'iceSent', `enviou ${kind}`);
      // Fire-and-forget de propósito: o broadcast com ack:true confirma 'ok';
      // NUNCA recriar o canal por causa de ack (loop de resubscribe derruba
      // o ICE em 'checking' eterno). Oferta perdida se cura no re-offer.
      try {
        const res = ch.send({
          type: 'broadcast',
          event: 'signal',
          payload: { ...payload, to, from: userId } as SignalPayload,
        }) as unknown as Promise<string> | undefined;
        res?.then?.((r) => {
          if (r !== 'ok') console.warn('[voz] sinal sem ack:', kind, r);
        }).catch?.(() => {});
      } catch {
        /* canal trocando: re-offer cobre */
      }
    },
    [userId, bumpSignal]
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
        // Falha transitória (ex: oferta remota chegou junto): retry se ainda
        // houver algo pendente (estável ou aguardando resposta = re-oferta)
        if (attempt < 2) {
          setTimeout(() => {
            const cur = peersRef.current.get(id);
            if (
              cur &&
              (cur.signalingState === 'stable' || cur.signalingState === 'have-local-offer')
            ) {
              negotiate(id, attempt + 1);
            }
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
          void tuneSender(pc, track, 'audio');
        } catch {
          /* duplicada */
        }
      }
    });
    if (camTrackRef.current && sendLiveRef.current) {
      if (!pc.getSenders().some((s) => s.track === camTrackRef.current)) {
        try {
          pc.addTrack(camTrackRef.current, sendLiveRef.current);
          void tuneSender(pc, camTrackRef.current, 'camera');
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
            if (track.kind === 'video') preferScreenCodec(pc, track);
            void tuneSender(pc, track, track.kind === 'video' ? 'screen' : 'audio');
          } catch {
            /* duplicada */
          }
        }
      });
    }
  }, [tuneSender]);

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
          // No PC o getDisplayMedia costuma trazer o áudio do sistema junto.
          // Antes ele sobrescrevia o mic do peer (mesma chave user_id) e o
          // <video> da tela disputava autoplay com som -> tela preta.
          // Agora: áudio da tela vai para lista própria; mic nunca é perdido.
          const peer = participantsRef.current.find((p) => p.user_id === id);
          const knownVideoOwner = videoStreamIdsRef.current.get(stream.id);
          const isScreenAudio =
            (!!peer?.screenStreamId && stream.id === peer.screenStreamId) ||
            knownVideoOwner === id;
          const entry: RemoteAudio = { user_id: id, streamId: stream.id, stream };
          if (isScreenAudio) {
            setRemoteScreenAudios((prev) =>
              prev.some((r) => r.user_id === id && r.streamId === stream.id)
                ? prev.map((r) => (r.user_id === id && r.streamId === stream.id ? entry : r))
                : [...prev, { ...entry, screenAudio: true }]
            );
            track.onended = () => {
              setRemoteScreenAudios((prev) =>
                prev.filter((r) => !(r.user_id === id && r.streamId === stream.id))
              );
            };
          } else {
            setRemotes((prev) =>
              prev.some((r) => r.user_id === id && r.streamId === stream.id)
                ? prev.map((r) => (r.user_id === id && r.streamId === stream.id ? entry : r))
                : [...prev, entry]
            );
          }
        } else {
          videoStreamIdsRef.current.set(stream.id, id);
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
        if (pc.connectionState === 'connected') {
          iceRetryRef.current.delete(id);
        } else if (pc.connectionState === 'failed') {
          // Antes: destruía a conexão de cara e ficava mudo/preto eternamente
          // (nada recriava o peer até alguém mexer na presença). Agora tenta
          // ICE restart (novo ufrag + nova oferta) até 3x antes de desistir.
          const n = (iceRetryRef.current.get(id) || 0) + 1;
          if (n <= 3) {
            iceRetryRef.current.set(id, n);
            try {
              pc.restartIce();
            } catch {
              /* segue para renegociar mesmo assim */
            }
            negotiate(id);
          } else {
            iceRetryRef.current.delete(id);
            closePeer(id);
          }
        } else if (pc.connectionState === 'closed') {
          iceRetryRef.current.delete(id);
          closePeer(id);
        }
      };
    },
    [closePeer, negotiate, sendSignal]
  );

  const createPeer = useCallback(
    (id: string) => {
      if (peersRef.current.has(id)) return peersRef.current.get(id)!;
      // STUN fixo + TURN buscado (Metered) se já carregado nesta sessão
      const pc = new RTCPeerConnection({
        iceServers: [...(RTC_CONFIG.iceServers || []), ...getExtraIceServers()],
      });
      peersRef.current.set(id, pc);
      bindPeer(id, pc);
      attachAllTracks(pc);
      return pc;
    },
    [attachAllTracks, bindPeer]
  );

  // Ao entrar na call, busca credenciais TURN (uma vez por sessão).
  // Peers criados depois disso já incluem o relay.
  useEffect(() => {
    if (!enabled || !userId) return;
    void ensureTurnServers();
  }, [enabled, userId, channelId]);

  // --- Sinalização ---
  useEffect(() => {
    const supabase: SupabaseClient | null = getSupabase();
    if (!supabase || !enabled || !userId || !channelId) return;

    const onSignal = async (p: SignalPayload) => {
      if (!p || p.to !== userId || !p.from) return;
      const polite = userId < p.from;
      if (p.kind === 'offer' && p.sdp) {
        bumpSignal(p.from, 'offerRecv', 'recebeu oferta');
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
        bumpSignal(p.from, 'answerRecv', 'recebeu resposta');
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
        bumpSignal(p.from, 'iceRecv', 'recebeu rede');
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
      // ack:true = o servidor confirma cada broadcast ('ok'). Sem isso o
      // send() nunca confirma e qualquer checagem de entrega vira falso erro.
      config: { broadcast: { self: false, ack: true } },
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, userId, channelId, createPeer, sendSignal, closePeer, bumpSignal]);

  // --- Descoberta: cria PC com quem está na call / limpa quem saiu ---
  // (só após sinalização pronta; oferta antes disso seria descartada)
  // Quem some da presença por alguns segundos (sync parcial do Realtime) NÃO
  // tem a conexão destruída na hora: espera 5s e só fecha se continuar fora.
  useEffect(() => {
    if (!enabled || !signalReady) return;
    participants.forEach((p) => {
      if (p.user_id !== userId && !peersRef.current.has(p.user_id)) {
        createPeer(p.user_id);
        negotiate(p.user_id);
      }
      const t = pendingCloseRef.current.get(p.user_id);
      if (t !== undefined) {
        window.clearTimeout(t);
        pendingCloseRef.current.delete(p.user_id);
      }
    });
    const ids = new Set(participants.map((p) => p.user_id));
    peersRef.current.forEach((_pc, id) => {
      if (!ids.has(id) && !pendingCloseRef.current.has(id)) {
        const timer = window.setTimeout(() => {
          pendingCloseRef.current.delete(id);
          const stillGone = !participantsRef.current.some((p) => p.user_id === id);
          if (stillGone) closePeer(id);
        }, 5000);
        pendingCloseRef.current.set(id, timer);
      }
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
      pendingCloseRef.current.forEach((t) => window.clearTimeout(t));
      pendingCloseRef.current.clear();
      lastReofferRef.current.clear();
      iceRetryRef.current.clear();
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();
      makingOfferRef.current.clear();
      pendingIceRef.current.clear();
      videoStreamIdsRef.current.clear();
      setRemotes([]);
      setRemoteScreenAudios([]);
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
      const mobile = isMobileDevice();
      let stream: MediaStream;
      try {
        // 720p fluído (câmera frontal no celular)
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: mobile ? 960 : 1280 },
            height: { ideal: mobile ? 540 : 720 },
            frameRate: { ideal: mobile ? 24 : 30 },
            facingMode: 'user',
          },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      const track = stream.getVideoTracks()[0];
      if (!track) throw new Error('Nenhuma trilha de vídeo retornada');
      setTrackHint(track, 'motion');
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
      const mobile = isMobileDevice();
      // Celular: exatamente como antes (720p 30fps fixos — já está perfeito).
      // PC: tenta com dicas de superfície primeiro; se o navegador/monitor
      // recusar (ultrawide/4K, driver, política), cai para pedidos simples
      // em vez de falhar ou entregar trilha sem frames (tela preta).
      let stream: MediaStream | null = null;
      if (mobile) {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { max: 1280 },
            height: { max: 720 },
            frameRate: { max: 30 },
          },
          audio: true,
        });
      } else {
        const attempts: Array<DisplayMediaStreamOptions> = [
          {
            video: {
              width: { max: 1920 },
              height: { max: 1080 },
              frameRate: { ideal: 30, max: 30 },
              displaySurface: 'monitor',
              surfaceSwitching: 'include',
              selfBrowserSurface: 'exclude',
              systemAudio: 'include',
            } as MediaTrackConstraints,
            audio: true,
          },
          {
            video: {
              width: { max: 1920 },
              height: { max: 1080 },
              frameRate: { max: 30 },
            },
            audio: true,
          },
          { video: true, audio: true },
        ];
        let lastErr: unknown = null;
        for (const opts of attempts) {
          try {
            stream = await navigator.mediaDevices.getDisplayMedia(opts);
            break;
          } catch (err) {
            lastErr = err;
            const name = (err as { name?: string })?.name;
            // Usuário cancelou: não tenta os fallbacks
            if (name === 'NotAllowedError' || name === 'AbortError') throw err;
          }
        }
        if (!stream) throw lastErr || new Error('Nenhuma trilha de vídeo retornada');
      }
      if (!stream.getVideoTracks().length) {
        throw new Error('Nenhuma trilha de vídeo retornada');
      }
      stream.getVideoTracks().forEach((t) => setTrackHint(t, 'detail'));
      ensureSendStreams();
      screenTracksRef.current = stream.getTracks();
      setLocalScreen(stream);
      setScreenOn(true);
      // Começa em 720p (nível 1) e SOBE para 1080p se a rede aguentar:
      // imagem aparece na hora em vez de travar/preta nos primeiros segundos
      // tentando 5 Mbps de cara. O controlador sobe sozinho em ~15s estáveis.
      const startLevel = 1;
      screenLevelRef.current = startLevel;
      setScreenLevel(startLevel);
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

  // Cura ofertas/respostas perdidas: se ficamos em 'have-local-offer' é
  // porque nossa oferta (ou a resposta dela) se perdeu no broadcast.
  // Reofertar aqui reconecta sozinho em segundos, sem mexer em nada.
  // Também alimenta o painel de diagnóstico (bytes recebidos por peer).
  // Espaçado (6s por peer): sem isso vira tempestade de ofertas que
  // reinicia o ICE sem parar e ele nunca sai do 'checking'.
  const lastReofferRef = useRef(new Map<string, number>());
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(async () => {
      const now = Date.now();
      peersRef.current.forEach((pc, pid) => {
        if (pc.signalingState === 'have-local-offer' && !makingOfferRef.current.get(pid)) {
          const last = lastReofferRef.current.get(pid) || 0;
          if (now - last > 6000) {
            lastReofferRef.current.set(pid, now);
            negotiate(pid);
          }
        }
      });
      const next: Record<string, PeerDebugInfo> = {};
      for (const [pid, pc] of peersRef.current) {
        let audioBytes = -1;
        let videoBytes = -1;
        try {
          const stats = await pc.getStats();
          stats.forEach((r: unknown) => {
            const s = r as Record<string, unknown>;
            if (s.type !== 'inbound-rtp') return;
            const bytes = s.bytesReceived as number | undefined;
            const kind = (s.kind || s.mediaType) as string | undefined;
            if (typeof bytes !== 'number') return;
            if (kind === 'audio') audioBytes = Math.max(audioBytes, bytes);
            else if (kind === 'video') videoBytes = Math.max(videoBytes, bytes);
          });
        } catch {
          /* stats indisponíveis: mantém -1 */
        }
        next[pid] = {
          user_id: pid,
          connectionState: pc.connectionState,
          iceState: pc.iceConnectionState,
          signalingState: pc.signalingState,
          audioBytes,
          videoBytes,
          offerSent: signalCountersRef.current[pid]?.offerSent || 0,
          offerRecv: signalCountersRef.current[pid]?.offerRecv || 0,
          answerSent: signalCountersRef.current[pid]?.answerSent || 0,
          answerRecv: signalCountersRef.current[pid]?.answerRecv || 0,
          iceSent: signalCountersRef.current[pid]?.iceSent || 0,
          iceRecv: signalCountersRef.current[pid]?.iceRecv || 0,
          lastSignal: signalCountersRef.current[pid]?.lastSignal || '—',
        };
      }
      setPeerDebug(next);
    }, 3000);
    return () => clearInterval(id);
  }, [enabled, negotiate]);

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
        if (Math.sqrt(sum / buf.length) > 0.03 && !talking.includes(id)) talking.push(id);
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
    remoteScreenAudios,
    remoteVideos,
    speakingIds,
    screenQuality: (SCREEN_LADDER[screenLevel] || SCREEN_LADDER[0]).label,
    signalReady,
    peerDebug,
  };
}
