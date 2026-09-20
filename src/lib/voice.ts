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

export const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ],
};

export interface SignalPayload {
  to: string;
  from: string;
  kind: 'offer' | 'answer' | 'ice';
  sdp?: string;
  sdpType?: RTCSdpType;
  candidate?: RTCIceCandidateInit;
}
