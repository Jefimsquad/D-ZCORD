import { useState, useEffect } from 'react';
import type { Server, Channel, Message, UserProfile } from './types';
import {
  currentUser as initialCurrentUser,
  initialServers,
  initialMessages,
  sampleUsers,
} from './mockData';
import { getSupabase, testSupabaseConnection, getStoredSupabaseConfig } from './lib/supabase';
import { ServerSidebar } from './components/ServerSidebar';
import { ChannelSidebar } from './components/ChannelSidebar';
import { ChatArea } from './components/ChatArea';
import { VoiceRoom } from './components/VoiceRoom';
import { MemberListSidebar } from './components/MemberListSidebar';
import { DirectMessagesView } from './components/DirectMessagesView';
import { UserSettingsModal } from './components/UserSettingsModal';
import { CreateChannelModal } from './components/CreateChannelModal';
import { CreateServerModal } from './components/CreateServerModal';

export function App() {
  // State
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('dezcord_current_user');
    return saved ? JSON.parse(saved) : initialCurrentUser;
  });

  const [servers, setServers] = useState<Server[]>(() => {
    const saved = localStorage.getItem('dezcord_servers');
    return saved ? JSON.parse(saved) : initialServers;
  });

  const [activeServerId, setActiveServerId] = useState<string | null>('srv_dezcord');
  const [activeChannelId, setActiveChannelId] = useState<string>('c_geral');
  const [activeVoiceChannel, setActiveVoiceChannel] = useState<Channel | null>(null);

  const [messagesMap, setMessagesMap] = useState<Record<string, Message[]>>(() => {
    const saved = localStorage.getItem('dezcord_messages');
    return saved ? JSON.parse(saved) : initialMessages;
  });

  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [showMemberList, setShowMemberList] = useState(true);

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [createChannelType, setCreateChannelType] = useState<'text' | 'voice'>('text');
  const [isCreateServerOpen, setIsCreateServerOpen] = useState(false);

  // Supabase state
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);

  // Persist local state
  useEffect(() => {
    localStorage.setItem('dezcord_servers', JSON.stringify(servers));
  }, [servers]);

  useEffect(() => {
    localStorage.setItem('dezcord_messages', JSON.stringify(messagesMap));
  }, [messagesMap]);

  useEffect(() => {
    localStorage.setItem('dezcord_current_user', JSON.stringify(currentUser));
  }, [currentUser]);

  // Check Supabase connection on startup
  useEffect(() => {
    const { url, anonKey } = getStoredSupabaseConfig();
    if (url && anonKey) {
      testSupabaseConnection(url, anonKey).then((res) => {
        setIsSupabaseConnected(res.success);
      });
    }
  }, []);

  // Supabase Realtime Listener for messages
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !isSupabaseConnected) return;

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload: any) => {
          const newMsg: Message = {
            id: payload.new.id,
            channel_id: payload.new.channel_id,
            user_id: payload.new.user_id,
            author: sampleUsers.find((u) => u.id === payload.new.user_id) || currentUser,
            content: payload.new.content,
            attachments: payload.new.attachments || [],
            created_at: payload.new.created_at,
          };

          setMessagesMap((prev) => {
            const list = prev[newMsg.channel_id] || [];
            if (list.some((m) => m.id === newMsg.id)) return prev;
            return {
              ...prev,
              [newMsg.channel_id]: [...list, newMsg],
            };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isSupabaseConnected, currentUser]);

  // Find active server and channel
  const activeServer = servers.find((s) => s.id === activeServerId) || null;
  const activeChannel = activeServer?.channels.find((c) => c.id === activeChannelId) || null;

  // Handle Send Message
  const handleSendMessage = async (content: string, attachments?: string[]) => {
    if (!activeChannel) return;

    const newMsg: Message = {
      id: `msg_${Date.now()}`,
      channel_id: activeChannel.id,
      user_id: currentUser.id,
      author: currentUser,
      content,
      attachments,
      created_at: new Date().toISOString(),
      reactions: [],
    };

    // Update locally immediately
    setMessagesMap((prev) => ({
      ...prev,
      [activeChannel.id]: [...(prev[activeChannel.id] || []), newMsg],
    }));

    // If Supabase is connected, persist to Supabase
    const supabase = getSupabase();
    if (supabase && isSupabaseConnected) {
      try {
        await supabase.from('messages').insert({
          id: newMsg.id,
          channel_id: activeChannel.id,
          user_id: currentUser.id,
          content,
          attachments: attachments || [],
          created_at: newMsg.created_at,
        });
      } catch (err) {
        console.warn('Falha ao sincronizar com Supabase:', err);
      }
    }
  };

  // Handle Add/Toggle Reaction
  const handleAddReaction = (messageId: string, emoji: string) => {
    if (!activeChannel) return;

    setMessagesMap((prev) => {
      const channelMsgs = prev[activeChannel.id] || [];
      const updated = channelMsgs.map((msg) => {
        if (msg.id !== messageId) return msg;

        const reactions = msg.reactions ? [...msg.reactions] : [];
        const existingIndex = reactions.findIndex((r) => r.emoji === emoji);

        if (existingIndex > -1) {
          const react = { ...reactions[existingIndex] };
          const userIdx = react.users.indexOf(currentUser.id);
          if (userIdx > -1) {
            // Remove reaction
            react.users = react.users.filter((id) => id !== currentUser.id);
            react.count -= 1;
          } else {
            // Add reaction
            react.users = [...react.users, currentUser.id];
            react.count += 1;
          }

          if (react.count <= 0) {
            reactions.splice(existingIndex, 1);
          } else {
            reactions[existingIndex] = react;
          }
        } else {
          reactions.push({
            emoji,
            count: 1,
            users: [currentUser.id],
          });
        }

        return { ...msg, reactions };
      });

      return {
        ...prev,
        [activeChannel.id]: updated,
      };
    });
  };

  // Handle Delete Message
  const handleDeleteMessage = (messageId: string) => {
    if (!activeChannel) return;

    setMessagesMap((prev) => ({
      ...prev,
      [activeChannel.id]: (prev[activeChannel.id] || []).filter((m) => m.id !== messageId),
    }));

    const supabase = getSupabase();
    if (supabase && isSupabaseConnected) {
      supabase.from('messages').delete().eq('id', messageId);
    }
  };

  // Handle Select Channel
  const handleSelectChannel = (channel: Channel) => {
    setActiveChannelId(channel.id);
    if (channel.type === 'voice') {
      setActiveVoiceChannel(channel);
    }
  };

  // Handle Create Channel
  const handleCreateChannel = (name: string, type: 'text' | 'voice') => {
    if (!activeServer) return;

    const newChannel: Channel = {
      id: `c_${Date.now()}`,
      server_id: activeServer.id,
      name,
      type,
      category: type === 'text' ? 'TEXTO' : 'VOZ',
    };

    setServers((prev) =>
      prev.map((s) => (s.id === activeServer.id ? { ...s, channels: [...s.channels, newChannel] } : s))
    );
    setActiveChannelId(newChannel.id);
    if (type === 'voice') {
      setActiveVoiceChannel(newChannel);
    }
  };

  // Handle Create Server
  const handleCreateServer = (name: string, iconUrl: string) => {
    const newServerId = `srv_${Date.now()}`;
    const defaultChannels: Channel[] = [
      { id: `c_${Date.now()}_1`, server_id: newServerId, name: 'geral', type: 'text', category: 'TEXTO' },
      { id: `c_${Date.now()}_2`, server_id: newServerId, name: 'Voz Geral', type: 'voice', category: 'VOZ' },
    ];

    const newServer: Server = {
      id: newServerId,
      name,
      icon_url: iconUrl,
      owner_id: currentUser.id,
      channels: defaultChannels,
    };

    setServers((prev) => [...prev, newServer]);
    setActiveServerId(newServerId);
    setActiveChannelId(defaultChannels[0].id);
  };

  // Active channel messages
  const currentMessages = activeChannel ? messagesMap[activeChannel.id] || [] : [];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#313338] text-[#dbdee1] font-sans antialiased">
      {/* 1. Server Sidebar (Far Left) */}
      <ServerSidebar
        servers={servers}
        activeServerId={activeServerId}
        onSelectServer={(id) => {
          setActiveServerId(id);
          if (id) {
            const srv = servers.find((s) => s.id === id);
            if (srv && srv.channels.length > 0) {
              setActiveChannelId(srv.channels[0].id);
            }
          }
        }}
        onOpenCreateServer={() => setIsCreateServerOpen(true)}
        onOpenSupabaseConfig={() => setIsSettingsOpen(true)}
        isSupabaseConnected={isSupabaseConnected}
      />

      {/* 2. Channel Sidebar (Left Middle) */}
      <ChannelSidebar
        server={activeServer}
        activeChannelId={activeChannelId}
        onSelectChannel={handleSelectChannel}
        currentUser={currentUser}
        activeVoiceChannel={activeVoiceChannel}
        isMuted={isMuted}
        isDeafened={isDeafened}
        onToggleMute={() => setIsMuted(!isMuted)}
        onToggleDeafen={() => setIsDeafened(!isDeafened)}
        onDisconnectVoice={() => setActiveVoiceChannel(null)}
        onOpenCreateChannel={(type) => {
          setCreateChannelType(type);
          setIsCreateChannelOpen(true);
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* 3. Main Center Content Area */}
      {activeServerId === null ? (
        // Direct Messages / Friends Hub View
        <DirectMessagesView
          friends={sampleUsers}
          currentUser={currentUser}
          onStartChat={(_user) => {
            // Select official server to chat or future DM
            setActiveServerId('srv_dezcord');
            setActiveChannelId('c_geral');
          }}
        />
      ) : activeChannel?.type === 'voice' ? (
        // Active Voice Channel Room (WebRTC / Grid View)
        <VoiceRoom
          channel={activeChannel}
          currentUser={currentUser}
          isMuted={isMuted}
          onToggleMute={() => setIsMuted(!isMuted)}
          onDisconnect={() => {
            setActiveVoiceChannel(null);
            // Revert to first text channel
            const firstText = activeServer?.channels.find((c) => c.type === 'text');
            if (firstText) setActiveChannelId(firstText.id);
          }}
        />
      ) : activeChannel ? (
        // Text Channel Chat Area
        <ChatArea
          channel={activeChannel}
          messages={currentMessages}
          currentUser={currentUser}
          onSendMessage={handleSendMessage}
          onAddReaction={handleAddReaction}
          onDeleteMessage={handleDeleteMessage}
          showMemberList={showMemberList}
          onToggleMemberList={() => setShowMemberList(!showMemberList)}
          isSupabaseConnected={isSupabaseConnected}
          onOpenSupabaseConfig={() => setIsSettingsOpen(true)}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-[#949ba4]">
          Selecione um canal para começar
        </div>
      )}

      {/* 4. Server Member List Sidebar (Far Right) */}
      {activeServerId !== null && activeChannel?.type === 'text' && showMemberList && (
        <MemberListSidebar
          members={sampleUsers}
          ownerId={activeServer?.owner_id || ''}
        />
      )}

      {/* MODALS */}
      <UserSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentUser={currentUser}
        onUpdateUser={(updated) => setCurrentUser((prev) => ({ ...prev, ...updated }))}
        onSupabaseStatusChange={(status) => setIsSupabaseConnected(status)}
      />

      <CreateChannelModal
        isOpen={isCreateChannelOpen}
        onClose={() => setIsCreateChannelOpen(false)}
        onCreate={handleCreateChannel}
        defaultType={createChannelType}
      />

      <CreateServerModal
        isOpen={isCreateServerOpen}
        onClose={() => setIsCreateServerOpen(false)}
        onCreateServer={handleCreateServer}
      />
    </div>
  );
}

export default App;
