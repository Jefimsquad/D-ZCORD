import { useEffect, useRef, useState } from 'react';
import type { Channel, UserProfile } from '../types';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  PhoneOff,
  Volume2
} from 'lucide-react';

interface VoiceRoomProps {
  channel: Channel;
  currentUser: UserProfile;
  isMuted: boolean;
  onToggleMute: () => void;
  onDisconnect: () => void;
}

export const VoiceRoom: React.FC<VoiceRoomProps> = ({
  channel,
  currentUser,
  isMuted,
  onToggleMute,
  onDisconnect,
}) => {
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const screenRef = useRef<HTMLVideoElement | null>(null);

  // Microphonic voice detection using Web Audio API
  useEffect(() => {
    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let micStream: MediaStream | null = null;
    let animId: number;

    if (!isMuted) {
      navigator.mediaDevices
        ?.getUserMedia({ audio: true })
        .then((stream) => {
          micStream = stream;
          audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          analyser = audioCtx.createAnalyser();
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);
          analyser.fftSize = 256;
          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);

          const checkSpeaking = () => {
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
        })
        .catch(() => {
          // Microphone permission not granted or available, fallback to idle
          setIsSpeaking(false);
        });
    } else {
      setIsSpeaking(false);
    }

    return () => {
      cancelAnimationFrame(animId);
      micStream?.getTracks().forEach((t) => t.stop());
      audioCtx?.close();
    };
  }, [isMuted]);

  // Handle Video Camera toggle
  const toggleCamera = async () => {
    if (!isVideoOn) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setIsVideoOn(true);
      } catch (err) {
        console.warn('Câmera indisponível:', err);
      }
    } else {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
        videoRef.current.srcObject = null;
      }
      setIsVideoOn(false);
    }
  };

  // Handle Screen Share toggle
  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
        if (screenRef.current) {
          screenRef.current.srcObject = stream;
        }
        stream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
        };
        setIsScreenSharing(true);
      } catch (err) {
        console.warn('Compartilhamento cancelado:', err);
      }
    } else {
      if (screenRef.current && screenRef.current.srcObject) {
        const stream = screenRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
        screenRef.current.srcObject = null;
      }
      setIsScreenSharing(false);
    }
  };

  return (
    <div className="flex-1 bg-[#313338] flex flex-col h-full overflow-hidden">
      {/* Voice Header */}
      <div className="h-12 px-6 border-b border-[#1f2023] flex items-center justify-between text-white shadow-sm bg-[#2b2d31]">
        <div className="flex items-center gap-2 font-bold text-base">
          <Volume2 size={20} className="text-[#23a55a]" />
          <span>{channel.name}</span>
          <span className="text-xs font-normal text-[#949ba4] bg-[#1e1f22] px-2 py-0.5 rounded-full">
            Canal de Voz
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#23a55a]">
          <span className="w-2 h-2 rounded-full bg-[#23a55a] animate-ping" />
          <span>Qualidade de Áudio 64kbps</span>
        </div>
      </div>

      {/* Participants Video / Grid View */}
      <div className="flex-1 p-6 overflow-y-auto flex items-center justify-center">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl w-full">
          {/* Current User Tile */}
          <div className="relative bg-[#1e1f22] rounded-xl aspect-video flex flex-col items-center justify-center p-4 border border-[#35373c] shadow-lg overflow-hidden group">
            {isVideoOn ? (
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

          {/* Screen Share Tile if active */}
          {isScreenSharing && (
            <div className="relative bg-[#1e1f22] rounded-xl aspect-video flex flex-col items-center justify-center p-2 border border-[#5865f2] shadow-lg overflow-hidden col-span-2">
              <video
                ref={screenRef}
                autoPlay
                playsInline
                className="w-full h-full object-contain rounded"
              />
              <div className="absolute bottom-3 left-3 bg-[#111214]/80 backdrop-blur px-3 py-1 rounded text-xs text-white">
                Transmissão de Tela de {currentUser.display_name}
              </div>
            </div>
          )}

          {/* Simulated Peer (DÉZ BOT) in Voice Channel */}
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
        </div>
      </div>

      {/* Voice Controls Bar */}
      <div className="h-20 bg-[#1e1f22] border-t border-[#1f2023] px-8 flex items-center justify-center gap-4">
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

        {/* Toggle Camera */}
        <button
          onClick={toggleCamera}
          className={`p-3.5 rounded-full transition ${
            isVideoOn
              ? 'bg-[#23a55a] text-white hover:bg-[#1f9350]'
              : 'bg-[#313338] text-white hover:bg-[#35373c]'
          }`}
          title={isVideoOn ? 'Desativar Câmera' : 'Ativar Câmera'}
        >
          {isVideoOn ? <Video size={22} /> : <VideoOff size={22} />}
        </button>

        {/* Share Screen */}
        <button
          onClick={toggleScreenShare}
          className={`p-3.5 rounded-full transition ${
            isScreenSharing
              ? 'bg-[#5865f2] text-white hover:bg-[#4752c4]'
              : 'bg-[#313338] text-white hover:bg-[#35373c]'
          }`}
          title={isScreenSharing ? 'Parar Compartilhamento' : 'Compartilhar Tela'}
        >
          <ScreenShare size={22} />
        </button>

        {/* Disconnect Call */}
        <button
          onClick={onDisconnect}
          className="p-3.5 rounded-full bg-[#f23f43] hover:bg-[#da373b] text-white transition ml-4"
          title="Desconectar do canal de voz"
        >
          <PhoneOff size={22} />
        </button>
      </div>
    </div>
  );
};
