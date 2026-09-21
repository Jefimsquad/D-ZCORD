import { useEffect, useRef, useState } from 'react';
import type { Channel, UserProfile } from '../types';
import type { RemoteAudio, RemoteVideo } from '../hooks/useVoiceCall';
import type { VoicePeerInfo } from '../lib/voice';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  PhoneOff,
  Volume2,
  Maximize,
  Minimize,
  Menu
} from 'lucide-react';

interface VoiceRoomProps {
  channel: Channel;
  currentUser: UserProfile;
  isMuted: boolean;
  onToggleMute: () => void;
  onDisconnect: () => void;
  onOpenChannelList?: () => void;
  participants?: VoicePeerInfo[];
  isSupabaseConnected?: boolean;
  callMicStream?: MediaStream | null;
  callMicError?: boolean;
  callRemotes?: RemoteAudio[];
  callSpeakingIds?: string[];
  callCam?: MediaStream | null;
  callScreen?: MediaStream | null;
  cameraOn?: boolean;
  screenOn?: boolean;
  callMediaError?: string | null;
  callRemoteVideos?: RemoteVideo[];
  onToggleCamera?: () => void;
  onToggleScreen?: () => void;
}

export const RemoteAudioEl = ({ stream }: { stream: MediaStream }) => {
  const ref = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.srcObject = stream;
      el.play().catch(() => {});
    }
    return () => {
      if (el) el.srcObject = null;
    };
  }, [stream]);
  return <audio ref={ref} autoPlay playsInline />;
};

export const RemoteVideoEl = ({
  stream,
  audio,
  className,
}: {
  stream: MediaStream;
  audio?: boolean;
  className?: string;
}) => {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.srcObject = stream;
      el.play().catch(() => {
        // Autoplay com áudio bloqueado: garante ao menos o vídeo
        if (audio && el) {
          el.muted = true;
          el.play().catch(() => {});
        }
      });
    }
    return () => {
      if (el) el.srcObject = null;
    };
  }, [stream, audio]);
  return <video ref={ref} autoPlay playsInline muted={!audio} className={className} />;
};

const RemoteScreenTile = ({ peerName, stream }: { peerName: string; stream: MediaStream }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [fs, setFs] = useState(false);
  useEffect(() => {
    const onFs = () => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);
  return (
    <div
      ref={containerRef}
      className="relative bg-black rounded-xl aspect-video flex flex-col items-center justify-center p-2 border border-[#23a55a] shadow-lg overflow-hidden col-span-2"
    >
      <RemoteVideoEl stream={stream} audio className="w-full h-full object-contain rounded" />
      <div className="absolute bottom-3 left-3 bg-[#111214]/80 backdrop-blur px-3 py-1 rounded text-xs text-white">
        Transmissão de Tela de {peerName} • ao vivo
      </div>
      <button
        onClick={async () => {
          try {
            if (!document.fullscreenElement) await containerRef.current?.requestFullscreen();
            else await document.exitFullscreen();
          } catch {
            /* ignorado */
          }
        }}
        className="absolute top-3 right-3 p-2 rounded-lg bg-[#111214]/80 hover:bg-[#5865f2] text-white transition"
        title={fs ? 'Sair da tela cheia' : 'Ver em tela cheia'}
      >
        {fs ? <Minimize size={18} /> : <Maximize size={18} />}
      </button>
    </div>
  );
};

export const VoiceRoom: React.FC<VoiceRoomProps> = ({
  channel,
  currentUser,
  isMuted,
  onToggleMute,
  onDisconnect,
  onOpenChannelList,
  participants = [],
  isSupabaseConnected = false,
  callMicStream = null,
  callMicError = false,
  callRemotes = [],
  callSpeakingIds = [],
  callCam = null,
  callScreen = null,
  cameraOn = false,
  screenOn = false,
  callMediaError = null,
  callRemoteVideos = [],
  onToggleCamera,
  onToggleScreen,
}) => {
  const remotePeers = participants.filter((p) => p.user_id !== currentUser.id);
  const canShareScreen =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    'getDisplayMedia' in navigator.mediaDevices;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isScreenFullscreen, setIsScreenFullscreen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const screenRef = useRef<HTMLVideoElement | null>(null);
  const screenContainerRef = useRef<HTMLDivElement | null>(null);

  // Microphonic voice detection (reusa o mic da call quando conectado)
  useEffect(() => {
    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let ownStream: MediaStream | null = null;
    let animId: number;
    let stopped = false;

    const external = isSupabaseConnected ? callMicStream : null;

    const attach = (stream: MediaStream) => {
      try {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch {
        return;
      }
      analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkSpeaking = () => {
        if (stopped) return;
        if (analyser) {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const average = sum / bufferLength;
          setIsSpeaking(average > 18);
        }
        animId = requestAnimationFrame(checkSpeaking);
      };
      checkSpeaking();
    };

    if (external) {
      attach(external);
    } else if (!isMuted) {
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
        .then((stream) => {
          if (stopped) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          ownStream = stream;
          attach(stream);
        })
        .catch(() => {
          // Microphone permission not granted or available, fallback to idle
          setIsSpeaking(false);
        });
    } else {
      setIsSpeaking(false);
    }

    return () => {
      stopped = true;
      cancelAnimationFrame(animId);
      ownStream?.getTracks().forEach((t) => t.stop());
      audioCtx?.close().catch(() => {});
    };
  }, [isMuted, isSupabaseConnected, callMicStream]);

  // Anexa câmera/tela vindas do hook (transmitidas para a call)
  useEffect(() => {
    if (cameraOn && videoRef.current && callCam) {
      videoRef.current.srcObject = callCam;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraOn, callCam]);

  useEffect(() => {
    if (screenOn && screenRef.current && callScreen) {
      screenRef.current.srcObject = callScreen;
      screenRef.current.play().catch(() => {});
    }
  }, [screenOn, callScreen]);

  // Track fullscreen changes (ESC sai sozinho, precisa sincronizar o ícone)
  useEffect(() => {
    const onFsChange = () => {
      setIsScreenFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Tela cheia no container do compartilhamento
  const toggleScreenFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await screenContainerRef.current?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen falhou:', err);
      setError('Não foi possível entrar em tela cheia neste navegador.');
    }
  };

  // Câmera/tela vêm do hook (transmitem para a call); toggles via props
  const handleDisconnect = () => {
    onDisconnect();
  };

  return (
    <div className="flex-1 min-w-0 bg-[#313338] flex flex-col h-full overflow-hidden">
      {/* Voice Header */}
      <div className="h-12 px-3 md:px-6 border-b border-[#1f2023] flex items-center justify-between gap-2 text-white shadow-sm bg-[#2b2d31]">
        <div className="flex items-center gap-2 font-bold text-base min-w-0">
          {onOpenChannelList && (
            <button
              onClick={onOpenChannelList}
              title="Lista de canais"
              className="md:hidden text-[#b5bac1] hover:text-white transition shrink-0"
            >
              <Menu size={22} />
            </button>
          )}
          <Volume2 size={20} className="text-[#23a55a] shrink-0" />
          <span className="truncate">{channel.name}</span>
          <span className="hidden sm:inline text-xs font-normal text-[#949ba4] bg-[#1e1f22] px-2 py-0.5 rounded-full shrink-0">
            Canal de Voz
          </span>
          {isSupabaseConnected && remotePeers.length > 0 && (
            <span className="text-xs font-normal text-[#23a55a] bg-[#1e1f22] px-2 py-0.5 rounded-full shrink-0">
              👥 {remotePeers.length + 1} na call
            </span>
          )}
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-[#23a55a] shrink-0">
          <span className="w-2 h-2 rounded-full bg-[#23a55a] animate-ping" />
          <span>Captura HD 48kHz • Eco cancelado</span>
        </div>
      </div>

      {/* Participants Video / Grid View */}
      <div className="flex-1 p-6 overflow-y-auto flex flex-col items-center justify-center gap-4">
        {(error || callMediaError) && (
          <div className="max-w-5xl w-full bg-[#f23f43]/15 border border-[#f23f43]/40 text-[#ffa7a9] text-sm px-4 py-2 rounded-lg">
            {error || callMediaError}
          </div>
        )}
        {isSupabaseConnected && callMicError && (
          <div className="max-w-5xl w-full bg-[#f0b232]/15 border border-[#f0b232]/40 text-[#f0b232] text-sm px-4 py-2 rounded-lg">
            Microfone bloqueado: libere a permissão no navegador para falar na call. Você ainda vê quem está nela.
          </div>
        )}
        {!isSupabaseConnected && (
          <div className="max-w-5xl w-full bg-[#3c331e] border border-[#f0b232]/30 text-[#f0b232] text-sm px-4 py-2 rounded-lg">
            Modo demonstração: conecte o Supabase para voz em tempo real com outros usuários.
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl w-full">
          {/* Current User Tile */}
          <div className="relative bg-[#1e1f22] rounded-xl aspect-video flex flex-col items-center justify-center p-4 border border-[#35373c] shadow-lg overflow-hidden group">
            {cameraOn && callCam ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div
                  className={`w-24 h-24 rounded-full overflow-hidden transition-all duration-150 ${
                    isSpeaking ? 'speaking-ring' : 'ring-2 ring-transparent'
                  }`}
                >
                  <img
                    src={currentUser.avatar_url}
                    alt={currentUser.username}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}

            {/* Speaking Status Pill */}
            <div className="absolute bottom-3 left-3 bg-[#111214]/80 backdrop-blur-md px-3 py-1 rounded-md text-xs font-medium text-white flex items-center gap-2">
              <span className="truncate max-w-[120px]">{currentUser.display_name}</span>
              {isMuted && <MicOff size={14} className="text-[#f23f43]" />}
            </div>

            {isSpeaking && !isMuted && (
              <div className="absolute top-3 right-3 bg-[#23a55a]/90 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                Falando
              </div>
            )}
          </div>

          {/* Screen Share Tile if active (transmite para a call) */}
          {screenOn && callScreen && (
            <div
              ref={screenContainerRef}
              className="relative bg-black rounded-xl aspect-video flex flex-col items-center justify-center p-2 border border-[#5865f2] shadow-lg overflow-hidden col-span-2"
            >
              <video
                ref={screenRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain rounded"
              />
              <div className="absolute bottom-3 left-3 bg-[#111214]/80 backdrop-blur px-3 py-1 rounded text-xs text-white">
                Transmissão de Tela de {currentUser.display_name}
                {isSupabaseConnected && ' • ao vivo para a call'}
              </div>
              <button
                onClick={toggleScreenFullscreen}
                className="absolute top-3 right-3 p-2 rounded-lg bg-[#111214]/80 hover:bg-[#5865f2] text-white transition"
                title={isScreenFullscreen ? 'Sair da tela cheia' : 'Ver em tela cheia'}
              >
                {isScreenFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
              </button>
            </div>
          )}

          {/* Remote Peers (tempo real via WebRTC) */}
          {remotePeers.map((peer) => {
            const remote = callRemotes.find((r) => r.user_id === peer.user_id);
            const speaking = callSpeakingIds.includes(peer.user_id);
            const camVideo = callRemoteVideos.find(
              (v) => v.user_id === peer.user_id && peer.camStreamId && v.streamId === peer.camStreamId
            );
            const screenVideo = callRemoteVideos.find(
              (v) => v.user_id === peer.user_id && peer.screenStreamId && v.streamId === peer.screenStreamId
            );
            const showCam = !!peer.video || !!camVideo;
            const showScreen = !!peer.screensharing || !!screenVideo;
            return (
              <div key={peer.user_id} className="contents">
                <div className="relative bg-[#1e1f22] rounded-xl aspect-video flex flex-col items-center justify-center p-4 border border-[#35373c] shadow-lg overflow-hidden">
                  {showCam && camVideo ? (
                    <RemoteVideoEl stream={camVideo.stream} className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <div
                      className={`w-24 h-24 rounded-full overflow-hidden transition-all duration-150 ${
                        speaking ? 'speaking-ring' : 'ring-2 ring-transparent'
                      }`}
                    >
                      <img
                        src={peer.avatar_url || 'https://via.placeholder.com/96'}
                        alt={peer.display_name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="absolute bottom-3 left-3 bg-[#111214]/80 backdrop-blur-md px-3 py-1 rounded-md text-xs font-medium text-white flex items-center gap-2">
                    <span className="truncate max-w-[120px]">{peer.display_name}</span>
                    {peer.muted && <MicOff size={14} className="text-[#f23f43]" />}
                    {peer.video && <Video size={14} className="text-[#23a55a]" />}
                  </div>
                  {!remote && (
                    <div className="absolute top-3 right-3 bg-[#1e1f22]/90 text-[#949ba4] text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                      Conectando...
                    </div>
                  )}
                  {speaking && (
                    <div className="absolute top-3 right-3 bg-[#23a55a]/90 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                      Falando
                    </div>
                  )}
                </div>
                {showScreen && screenVideo && (
                  <RemoteScreenTile peerName={peer.display_name} stream={screenVideo.stream} />
                )}
              </div>
            );
          })}

          {/* Simulated Peer (DÉZ BOT) — só quando sozinho/offline */}
          {remotePeers.length === 0 && (
            <div className="relative bg-[#1e1f22] rounded-xl aspect-video flex flex-col items-center justify-center p-4 border border-[#35373c] shadow-lg">
              <div className="w-20 h-20 rounded-full overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80"
                  alt="DÉZ BOT"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute bottom-3 left-3 bg-[#111214]/80 backdrop-blur-md px-3 py-1 rounded-md text-xs font-medium text-white flex items-center gap-2">
                <span>DÉZ BOT 🤖</span>
                <span className="text-[10px] bg-[#5865f2] px-1 rounded">BOT</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Voice Controls Bar */}
      <div className="min-h-20 py-3 bg-[#1e1f22] border-t border-[#1f2023] px-4 md:px-8 flex items-center justify-center gap-3 md:gap-4">
        {/* Toggle Mic */}
        <button
          onClick={onToggleMute}
          className={`p-3.5 rounded-full transition ${
            isMuted
              ? 'bg-[#f23f43] text-white hover:bg-[#da373b]'
              : 'bg-[#313338] text-white hover:bg-[#35373c]'
          }`}
          title={isMuted ? 'Desmutar Microfone' : 'Mutar Microfone'}
        >
          {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>

        {/* Toggle Camera (transmite para a call) */}
        <button
          onClick={onToggleCamera}
          className={`p-3.5 rounded-full transition ${
            cameraOn
              ? 'bg-[#23a55a] text-white hover:bg-[#1f9350]'
              : 'bg-[#313338] text-white hover:bg-[#35373c]'
          }`}
          title={cameraOn ? 'Desativar Câmera' : 'Ativar Câmera'}
        >
          {cameraOn ? <Video size={22} /> : <VideoOff size={22} />}
        </button>

        {/* Share Screen (transmite para a call) */}
        <button
          onClick={onToggleScreen}
          disabled={!screenOn && !canShareScreen}
          className={`p-3.5 rounded-full transition disabled:opacity-40 ${
            screenOn
              ? 'bg-[#5865f2] text-white hover:bg-[#4752c4]'
              : 'bg-[#313338] text-white hover:bg-[#35373c]'
          }`}
          title={
            screenOn
              ? 'Parar Compartilhamento'
              : canShareScreen
                ? 'Compartilhar Tela'
                : 'Compartilhamento indisponível neste navegador'
          }
        >
          <ScreenShare size={22} />
        </button>

        {/* Disconnect Call */}
        <button
          onClick={handleDisconnect}
          className="p-3.5 rounded-full bg-[#f23f43] hover:bg-[#da373b] text-white transition ml-4"
          title="Desconectar do canal de voz"
        >
          <PhoneOff size={22} />
        </button>
      </div>
    </div>
  );
};
