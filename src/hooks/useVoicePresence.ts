import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { UserProfile } from '../types';
import { getSupabase } from '../lib/supabase';
import type { VoicePeerInfo, LocalMediaFlags } from '../lib/voice';

// Presença por canal de voz: quem está em cada call (tempo real).
// Usado na lista de canais e dentro da call. Não toca em áudio.
export function useVoicePresence(
  channelIds: string[],
  localUser: UserProfile,
  isMuted: boolean,
  enabled: boolean,
  joinedChannelId?: string | null,
  media?: LocalMediaFlags
): Record<string, VoicePeerInfo[]> {
  const [presence, setPresence] = useState<Record<string, VoicePeerInfo[]>>({});
  const channelsRef = useRef<Map<string, RealtimeChannel>>(new Map());
  const key = channelIds.slice().sort().join(',');
  const userId = localUser.id;

  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;
  const joinedRef = useRef(joinedChannelId);
  joinedRef.current = joinedChannelId;
  const mediaRef = useRef(media);
  mediaRef.current = media;
  const profileRef = useRef({ display_name: localUser.display_name, avatar_url: localUser.avatar_url });
  profileRef.current = { display_name: localUser.display_name, avatar_url: localUser.avatar_url };

  useEffect(() => {
    const supabase: SupabaseClient | null = getSupabase();
    if (!supabase || !enabled || !key || !userId) {
      setPresence({});
      return;
    }
    let cancelled = false;
    const chans = new Map<string, RealtimeChannel>();

    const rebuild = () => {
      if (cancelled) return;
      const next: Record<string, VoicePeerInfo[]> = {};
      chans.forEach((ch, cid) => {
        const state = ch.presenceState() as Record<string, Array<Record<string, unknown>>>;
        const list: VoicePeerInfo[] = [];
        Object.values(state).forEach((metas) => {
          const m = metas[0] as Record<string, unknown> | undefined;
          if (m?.user_id) {
            list.push({
              user_id: String(m.user_id),
              display_name: String(m.display_name || 'Usuário'),
              avatar_url: String(m.avatar_url || ''),
              muted: !!m.muted,
              video: !!m.video,
              screensharing: !!m.screensharing,
              camStreamId: String(m.camStreamId || ''),
              screenStreamId: String(m.screenStreamId || ''),
            });
          }
        });
        next[cid] = list;
      });
      setPresence(next);
    };

    channelIds.forEach((cid) => {
      const ch = supabase.channel(`voice-presence:${cid}`, {
        config: { presence: { key: userId } },
      });
      chans.set(cid, ch);
      ch.on('presence', { event: 'sync' }, rebuild)
        .on('presence', { event: 'join' }, rebuild)
        .on('presence', { event: 'leave' }, rebuild)
        .subscribe((status) => {
          // Só publica presença no canal que entrou (inscrição escuta todos)
          if (status === 'SUBSCRIBED' && cid === joinedRef.current) {
            ch.track({
              user_id: userId,
              display_name: profileRef.current.display_name,
              avatar_url: profileRef.current.avatar_url,
              muted: isMutedRef.current,
              video: !!mediaRef.current?.video,
              screensharing: !!mediaRef.current?.screensharing,
              camStreamId: mediaRef.current?.camStreamId || '',
              screenStreamId: mediaRef.current?.screenStreamId || '',
            });
          }
        });
    });
    channelsRef.current = chans;

    return () => {
      cancelled = true;
      chans.forEach((ch) => {
        supabase.removeChannel(ch);
      });
      channelsRef.current = new Map();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, userId, enabled]);

  // Publica presença SÓ no canal que entrou; atualiza mute/nome/foto/mídia
  useEffect(() => {
    channelsRef.current.forEach((ch, cid) => {
      if (cid === joinedChannelId && userId) {
        ch.track({
          user_id: userId,
          display_name: localUser.display_name,
          avatar_url: localUser.avatar_url,
          muted: isMuted,
          video: !!media?.video,
          screensharing: !!media?.screensharing,
          camStreamId: media?.camStreamId || '',
          screenStreamId: media?.screenStreamId || '',
        });
      } else {
        ch.untrack();
      }
    });
  }, [joinedChannelId, isMuted, userId, localUser.display_name, localUser.avatar_url, media?.video, media?.screensharing, media?.camStreamId, media?.screenStreamId]);

  return presence;
}
