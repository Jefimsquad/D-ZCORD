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
  // TURN próprio via env (atravessa NATs simétricos/CGNAT onde só STUN falha).
  // Formato: VITE_TURN_URLS="turn:host:3478" + USERNAME + CREDENTIAL.
  try {
    const env = (import.meta as unknown as { env?: Record<string, string> })?.env;
    const urls = env?.VITE_TURN_URLS;
    const username = env?.VITE_TURN_USERNAME;
    const credential = env?.VITE_TURN_CREDENTIAL;
    if (urls && username && credential) {
      // Normaliza: sem esquema na frente, assume turn: (URL sem esquema
      // faz o new RTCPeerConnection LANÇAR exceção e derruba o app inteiro
      // em tela cinza). Entradas inválidas são descartadas, nunca quebram.
      const list = urls
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean)
        .map((u) => (/^(stun|turn|turns):/i.test(u) ? u : `turn:${u}`));
      if (list.length) iceServers.push({ urls: list, username, credential });
    }
    // (Sem fallback público hardcoded: o OpenRelay removeu as credenciais
    // estáticas — user/senha fixos só geram 401 e atrasam o ICE à toa.)
  } catch {
    /* env indisponível: segue só com STUN */
  }
  return { iceServers };
})();

// Monta a config filtrando URLs inválidas (uma URL ruim derruba o
// construtor do RTCPeerConnection e o app inteiro junto).
export function buildRtcConfig(): RTCConfiguration {
  const valid = (s: RTCIceServer) => {
    const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
    return urls.some((u) => /^(stun|turn|turns):[^/]+/i.test(String(u || '').trim()));
  };
  const iceServers = [...(RTC_CONFIG.iceServers || []), ...getExtraIceServers()].filter(valid);
  return {
    iceServers: iceServers.length ? iceServers : [{ urls: ['stun:stun.l.google.com:19302'] }],
  };
}
// TURN gratuito via Metered OpenRelay (20 GB/mês): exige conta gratuita.
// Vercel → Environment Variables: VITE_METERED_APP + VITE_METERED_KEY.
// Busca uma vez por sessão; sem elas, a call tenta P2P direto (STUN).
let meteredServers: RTCIceServer[] | null = null;
let meteredFetching: Promise<RTCIceServer[]> | null = null;

export function getExtraIceServers(): RTCIceServer[] {
  return meteredServers || [];
}

export function ensureTurnServers(): Promise<RTCIceServer[]> {
  if (meteredServers) return Promise.resolve(meteredServers);
  if (meteredFetching) return meteredFetching;
  meteredFetching = (async () => {
    try {
      const env = (import.meta as unknown as { env?: Record<string, string> })?.env;
      const app = (env?.VITE_METERED_APP || '').trim();
      const key = (env?.VITE_METERED_KEY || '').trim();
      if (!app || !key) return [];
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(
        `https://${app}.metered.live/api/v1/turn/credentials?apiKey=${encodeURIComponent(key)}`,
        { signal: ctrl.signal }
      );
      clearTimeout(timer);
      if (!res.ok) return [];
      const arr = (await res.json()) as Array<{ urls?: string | string[]; url?: string; username?: string; credential?: string }>;
      meteredServers = (Array.isArray(arr) ? arr : [])
        .map((s) => ({
          urls: s.urls || s.url || [],
          username: s.username,
          credential: s.credential,
        }))
        .filter((s) => (Array.isArray(s.urls) ? s.urls.length : !!s.urls)) as RTCIceServer[];
      return meteredServers;
    } catch {
      return [];
    } finally {
      meteredFetching = null;
    }
  })();
  return meteredFetching;
}

export interface SignalPayload {
  to: string;
  from: string;
  kind: 'offer' | 'answer' | 'ice';
  sdp?: string;
  sdpType?: RTCSdpType;
  candidate?: RTCIceCandidateInit;
}
