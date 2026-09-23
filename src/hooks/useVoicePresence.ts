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
  // Inclui o canal da call ativa mesmo se trocar de servidor/navegar —
  // senão a inscrição some e ninguém mais te vê (e você não vê ninguém).
  const effectiveIds = [
    ...new Set([...(channelIds || []), ...(joinedChannelId ? [joinedChannelId] : [])].filter(Boolean)),
  ];
  const key = effectiveIds.slice().sort().join(',');
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
    if (!supabase || !enabled || !userId) {
      setPresence({});
      return;
    }
    // Sem canais: mantém a última lista em vez de piscar tudo para vazio
    if (!key) return;
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
      // Mescla em vez de substituir: nunca apaga canais que ainda existem por
      // causa de um sync parcial; remove só os que não estão mais inscritos.
      setPresence((prev) => {
        const merged: Record<string, VoicePeerInfo[]> = { ...prev, ...next };
        Object.keys(merged).forEach((k) => {
          if (!chans.has(k)) delete merged[k];
        });
        return merged;
      });
    };

    effectiveIds.forEach((cid) => {
      const ch = supabase.channel(`voice-presence:${cid}`, {
        config: { presence: { key: userId } },
      });
      chans.set(cid, ch);
      ch.on('presence', { event: 'sync' }, rebuild)
        .on('presence', { event: 'join' }, (payload) => {
          // Força rebuild no próximo tick: presenceState já inclui quem entrou
          setTimeout(rebuild, 0);
          void payload;
        })
        .on('presence', { event: 'leave' }, rebuild)
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            rebuild();
            // Só publica presença no canal que entrou (inscrição escuta todos)
            if (cid === joinedRef.current) {
              try {
                await ch.track({
                  user_id: userId,
                  display_name: profileRef.current.display_name,
                  avatar_url: profileRef.current.avatar_url,
                  muted: isMutedRef.current,
                  video: !!mediaRef.current?.video,
                  screensharing: !!mediaRef.current?.screensharing,
                  camStreamId: mediaRef.current?.camStreamId || '',
                  screenStreamId: mediaRef.current?.screenStreamId || '',
                });
              } catch {
                /* retry no efeito de tracking abaixo */
              }
              // Garante que a lista local reflita imediatamente
              setTimeout(rebuild, 300);
            }
          }
        });
    });
    channelsRef.current = chans;

    // Rede de segurança: o Realtime às vezes perde eventos de join/sync.
    // Releitura periódica + republicação (heartbeat) convergem sozinhas em
    // segundos: gente na call volta a aparecer e flag de tela atualiza.
    const safetyId = setInterval(() => {
      if (cancelled) return;
      rebuild();
      const joined = joinedRef.current;
      const ch = (joined && chans.get(joined)) || null;
      if (ch && userId) {
        ch.track({
          user_id: userId,
          display_name: profileRef.current.display_name,
          avatar_url: profileRef.current.avatar_url,
          muted: isMutedRef.current,
          video: !!mediaRef.current?.video,
          screensharing: !!mediaRef.current?.screensharing,
          camStreamId: mediaRef.current?.camStreamId || '',
          screenStreamId: mediaRef.current?.screenStreamId || '',
        }).catch(() => {});
      }
    }, 10000);

    return () => {
      cancelled = true;
      clearInterval(safetyId);
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
        }).catch(() => {});
      } else {
        // Só sai se estava dentro — evita broadcast de leave desnecessário
        try {
          const state = ch.presenceState() as Record<string, Array<Record<string, unknown>>>;
          const stillThere = Object.values(state).some((metas) =>
            metas.some((m) => String((m as Record<string, unknown>)?.user_id) === String(userId))
          );
          if (stillThere) ch.untrack().catch(() => {});
        } catch {
          /* ignora */
        }
      }
    });
  }, [joinedChannelId, isMuted, userId, localUser.display_name, localUser.avatar_url, media?.video, media?.screensharing, media?.camStreamId, media?.screenStreamId]);

  return presence;
}
