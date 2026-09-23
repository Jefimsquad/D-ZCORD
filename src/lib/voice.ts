// Voz em tempo real (WebRTC mesh + sinalização via Supabase Realtime).
// Sem servidor extra: presença mostra quem está na call e o áudio
// trafega peer-to-peer (Opus) com STUN público para atravessar NAT.

export interface VoicePeerInfo {
  user_id: string;
  display_name: string;
  avatar_url: string;
  muted: boolean;
  video?: boolean;
  screensharing?: boolean;
  camStreamId?: string;
  screenStreamId?: string;
}

export interface LocalMediaFlags {
  video: boolean;
  screensharing: boolean;
  camStreamId: string;
  screenStreamId: string;
}

export const NO_MEDIA: LocalMediaFlags = {
  video: false,
  screensharing: false,
  camStreamId: '',
  screenStreamId: '',
};

// Celular = captura e bitrates menores para não travar
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) return true;
  try {
    return (
      !!window.matchMedia?.('(pointer: coarse)').matches &&
      Math.min(window.screen.width, window.screen.height) < 768
    );
  } catch {
    return false;
  }
}

export const RTC_CONFIG: RTCConfiguration = (() => {
  const iceServers: RTCIceServer[] = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ];
  // TURN opcional (atravessa NATs simétricos onde só STUN não conecta).
  // Sem isso, em algumas redes PC↔PC o vídeo/áudio nem estabelece.
  try {
    const urls = (import.meta as unknown as { env?: Record<string, string> })?.env
      ?.VITE_TURN_URLS;
    const username = (import.meta as unknown as { env?: Record<string, string> })?.env
      ?.VITE_TURN_USERNAME;
    const credential = (import.meta as unknown as { env?: Record<string, string> })?.env
      ?.VITE_TURN_CREDENTIAL;
    if (urls && username && credential) {
      iceServers.push({ urls: urls.split(',').map((u) => u.trim()), username, credential });
    } else {
      // Fallback público gratuito: quando os dois PCs estão atrás de NAT
      // restrito, só STUN não atravessa e a call fica muda/preta eternamente.
      // O TURN relaya a mídia nesse caso. Se estiver fora do ar, o ICE
      // simplesmente ignora e tenta direto como antes (sem quebrar nada).
      iceServers.push({
        urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443'],
        username: 'openrelayproject',
        credential: 'openrelayproject',
      });
    }
  } catch {
    /* env indisponível: segue só com STUN */
  }
  return { iceServers };
})();

export interface SignalPayload {
  to: string;
  from: string;
  kind: 'offer' | 'answer' | 'ice';
  sdp?: string;
  sdpType?: RTCSdpType;
  candidate?: RTCIceCandidateInit;
}
