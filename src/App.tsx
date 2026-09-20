import { useState, useEffect } from 'react';
import type { Server, Channel, Message, UserProfile, FileFolder, ProjectFile, ProjectTask } from './types';
import {
  currentUser as initialCurrentUser,
  initialServers,
  initialMessages,
  sampleUsers,
  initialFolders,
  initialFiles,
  initialTasks,
} from './mockData';
import { getSupabase, testSupabaseConnection, getStoredSupabaseConfig, syncProfileToSupabase } from './lib/supabase';
import { ServerSidebar } from './components/ServerSidebar';
import { ChannelSidebar } from './components/ChannelSidebar';
import { ChatArea } from './components/ChatArea';
import { VoiceRoom } from './components/VoiceRoom';
import { MemberListSidebar } from './components/MemberListSidebar';
import { DirectMessagesView } from './components/DirectMessagesView';
import { UserSettingsModal } from './components/UserSettingsModal';
import { CreateChannelModal } from './components/CreateChannelModal';
import { CreateServerModal } from './components/CreateServerModal';
import { FileStorageView } from './components/FileStorageView';
import { ProjectTaskBoard } from './components/ProjectTaskBoard';
import { LoginModal } from './components/LoginModal';
import { AuthScreen } from './components/AuthScreen';

export function App() {
  // Current user (editable locally)
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('dezcord_current_user');
    return saved ? JSON.parse(saved) : initialCurrentUser;
  });

  // Projects / Servers
  const [servers, setServers] = useState<Server[]>(() => {
    const saved = localStorage.getItem('dezcord_servers');
    if (!saved) return initialServers;
    try {
      const parsed: Server[] = JSON.parse(saved);
      const dezcord = parsed.find((s) => s.id === 'srv_dezcord');
      if (dezcord) {
        initialServers[0].channels.forEach((ch) => {
          if (!dezcord.channels.some((c) => c.id === ch.id || c.name === ch.name)) {
            dezcord.channels.push(ch);
          }
        });
      }
      return parsed;
    } catch {
      return initialServers;
    }
  });

  const [activeServerId, setActiveServerId] = useState<string | null>('srv_dezcord');
  const [activeChannelId, setActiveChannelId] = useState<string>('c_geral');
  const [activeVoiceChannel, setActiveVoiceChannel] = useState<Channel | null>(null);

  // Active View Mode inside Project: 'channel' | 'files' | 'tasks'
  const [activeView, setActiveView] = useState<'channel' | 'files' | 'tasks'>('channel');

  // Messages map by channel ID
  const [messagesMap, setMessagesMap] = useState<Record<string, Message[]>>(() => {
    const saved = localStorage.getItem('dezcord_messages');
    if (!saved) return initialMessages;
    try {
      const parsed = JSON.parse(saved);
      return { ...initialMessages, ...parsed };
    } catch {
      return initialMessages;
    }
  });

  // Project Folders & Files
  const [folders, setFolders] = useState<FileFolder[]>(() => {
    const saved = localStorage.getItem('dezcord_folders');
    return saved ? JSON.parse(saved) : initialFolders;
  });

  const [files, setFiles] = useState<ProjectFile[]>(() => {
    const saved = localStorage.getItem('dezcord_files');
    return saved ? JSON.parse(saved) : initialFiles;
  });

  // Project Tasks
  const [tasks, setTasks] = useState<ProjectTask[]>(() => {
    const saved = localStorage.getItem('dezcord_tasks');
    return saved ? JSON.parse(saved) : initialTasks;
  });

  // Audio / UI State
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [showMemberList, setShowMemberList] = useState(true);
  const [isBotTyping, setIsBotTyping] = useState(false);

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [createChannelType, setCreateChannelType] = useState<'text' | 'voice'>('text');
  const [isCreateServerOpen, setIsCreateServerOpen] = useState(false);

  // Supabase state
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);

  // Persist local state
  useEffect(() => {
    localStorage.setItem('dezcord_servers', JSON.stringify(servers));
  }, [servers]);

  useEffect(() => {
    localStorage.setItem('dezcord_messages', JSON.stringify(messagesMap));
  }, [messagesMap]);

  useEffect(() => {
    localStorage.setItem('dezcord_folders', JSON.stringify(folders));
  }, [folders]);

  useEffect(() => {
    localStorage.setItem('dezcord_files', JSON.stringify(files));
  }, [files]);

  useEffect(() => {
    localStorage.setItem('dezcord_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('dezcord_current_user', JSON.stringify(currentUser));
    if (authed) {
      const t = setTimeout(() => {
        syncProfileToSupabase(currentUser);
      }, 800);
      return () => clearTimeout(t);
    }
  }, [currentUser, authed]);

  // Check Supabase connection on startup + restore real auth session
  useEffect(() => {
    const { url, anonKey } = getStoredSupabaseConfig();
    if (url && anonKey) {
      testSupabaseConnection(url, anonKey).then((res) => {
        setIsSupabaseConnected(res.success);
      });
    }
    const supabase = getSupabase();
    if (!supabase) return;
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user;
      setAuthed(!!user?.id);
      setAuthChecked(true);
      if (!user?.id || !user.email) return;
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      setCurrentUser((prev) => ({
        ...prev,
        id: user.id,
        email: user.email!,
        username: (profile as any)?.username || prev.username,
        display_name: (profile as any)?.display_name || prev.display_name,
        avatar_url: (profile as any)?.avatar_url || prev.avatar_url,
      }));
    });
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        setAuthed(false);
        return;
      }
      setAuthed(true);
      const user = session?.user;
      if (!user?.id || !user.email) return;
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      setCurrentUser((prev) => ({
        ...prev,
        id: user.id,
        email: user.email!,
        username: (profile as any)?.username || prev.username,
        display_name: (profile as any)?.display_name || prev.display_name,
        avatar_url: (profile as any)?.avatar_url || prev.avatar_url,
      }));
    });
    return () => listener.subscription.unsubscribe();
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

  // Handle Send Message & Smart AI DézBot Automation
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

    // Update message stream locally
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

    // DézBot IA Automation Trigger
    const lower = content.toLowerCase().trim();
    if (lower.startsWith('/ia') || lower.startsWith('/ajuda') || lower.startsWith('/resumo') || lower.startsWith('/tarefa') || lower.includes('@déz bot')) {
      setIsBotTyping(true);

      setTimeout(() => {
        let botResponse = '';
        const botUser = sampleUsers[1]; // DÉZ BOT

        if (lower.startsWith('/ajuda')) {
          botResponse = `🤖 **Comandos Rápidos do DÉZCORD:**
- \`/ia [pergunta]\` : Tira dúvidas sobre desenvolvimento, arquitetura e organização do projeto.
- \`/resumo\` : Exibe um resumo dos canais, tarefas e arquivos do projeto atual.
- \`/tarefa [título]\` : Cria uma nova tarefa automaticamente no quadro do projeto!
- Acesse também as abas laterais **📁 Arquivos & Documentos** e **📋 Quadro de Tarefas**.`;
        } else if (lower.startsWith('/resumo')) {
          const currentProjectTasks = tasks.filter((t) => t.project_id === activeServerId);
          const currentProjectFiles = files.filter((f) => f.project_id === activeServerId);
          botResponse = `📊 **Resumo do Projeto: ${activeServer?.name}**
- **Canais:** ${activeServer?.channels.length || 0} canais configurados
- **Arquivos no Drive:** ${currentProjectFiles.length} arquivos organizados em pastas
- **Tarefas:** ${currentProjectTasks.filter((t) => t.status === 'done').length} concluídas de ${currentProjectTasks.length} totais.`;
        } else if (lower.startsWith('/tarefa')) {
          const taskTitle = content.replace(/^\/tarefa\s*/i, '').trim() || 'Nova tarefa rápida';
          const newTask: ProjectTask = {
            id: `tsk_${Date.now()}`,
            project_id: activeServerId || 'srv_dezcord',
            title: taskTitle,
            status: 'todo',
            priority: 'medium',
            assigned_to: currentUser,
            created_at: new Date().toISOString(),
          };
          setTasks((prev) => [newTask, ...prev]);
          botResponse = `✅ **Tarefa criada no Quadro com sucesso:** "${taskTitle}"! Você pode visualizá-la na aba **📋 Quadro de Tarefas**.`;
        } else {
          // General /ia prompt
          const query = content.replace(/^\/ia\s*/i, '').replace(/@déz bot/gi, '').trim();
          botResponse = `🤖 **DÉZ BOT IA:** Analisei sua solicitação *" ${query || 'como organizar o projeto'} "*!
Recomendo dividir o fluxo em:
1. **Discussão nos Canais de Texto:** Para alinhamento rápido e decisões técnicas.
2. **Armazenamento de Documentos:** Salvar assets e especificações na aba **📁 Arquivos & Documentos**.
3. **Acompanhamento no Quadro de Tarefas:** Mover tarefas para *Concluído* conforme finalizadas!`;
        }

        const botMsg: Message = {
          id: `bot_msg_${Date.now()}`,
          channel_id: activeChannel.id,
          user_id: botUser.id,
          author: botUser,
          content: botResponse,
          created_at: new Date().toISOString(),
          reactions: [{ emoji: '⚡', count: 1, users: [currentUser.id] }],
        };

        setMessagesMap((prev) => ({
          ...prev,
          [activeChannel.id]: [...(prev[activeChannel.id] || []), botMsg],
        }));

        setIsBotTyping(false);
      }, 700);
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
            react.users = react.users.filter((id) => id !== currentUser.id);
            react.count -= 1;
          } else {
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
    setActiveView('channel');
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
    setActiveView('channel');
    if (type === 'voice') {
      setActiveVoiceChannel(newChannel);
    }
  };

  // Handle Create Server / Project
  const handleCreateServer = (name: string, iconUrl: string) => {
    const newServerId = `srv_${Date.now()}`;
    const defaultChannels: Channel[] = [
      { id: `c_${Date.now()}_1`, server_id: newServerId, name: 'geral', type: 'text', category: 'TEXTO' },
      { id: `c_${Date.now()}_2`, server_id: newServerId, name: 'Reunião do Projeto 🎙️', type: 'voice', category: 'VOZ' },
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
    setActiveView('channel');
  };

  // Storage Handlers
  const handleCreateFolder = (name: string, parentId: string | null) => {
    const newFolder: FileFolder = {
      id: `f_${Date.now()}`,
      project_id: activeServerId || 'srv_dezcord',
      name,
      parent_id: parentId,
      created_at: new Date().toISOString(),
    };
    setFolders((prev) => [...prev, newFolder]);
  };

  const handleDeleteFolder = (folderId: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    setFiles((prev) => prev.filter((file) => file.folder_id !== folderId));
  };

  const handleUploadFile = (fileData: {
    name: string;
    size: number;
    mimeType: string;
    url: string;
    folderId: string | null;
  }) => {
    const newFile: ProjectFile = {
      id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      project_id: activeServerId || 'srv_dezcord',
      folder_id: fileData.folderId,
      name: fileData.name,
      size: fileData.size,
      mime_type: fileData.mimeType,
      url: fileData.url,
      uploaded_by: currentUser,
      created_at: new Date().toISOString(),
    };
    setFiles((prev) => [newFile, ...prev]);
  };

  const handleDeleteFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handleShareFileToChat = (file: ProjectFile) => {
    const isImage = file.mime_type.startsWith('image/');
    const content = `📁 Compartilhou o arquivo **${file.name}** do armazenamento interno do projeto!`;
    const attachments = isImage ? [file.url] : undefined;

    handleSendMessage(content, attachments);
    setActiveView('channel');
  };

  // Task Handlers
  const handleCreateTask = (newTaskData: Omit<ProjectTask, 'id' | 'created_at'>) => {
    const newTask: ProjectTask = {
      id: `tsk_${Date.now()}`,
      ...newTaskData,
      created_at: new Date().toISOString(),
    };
    setTasks((prev) => [newTask, ...prev]);
  };

  const handleUpdateTaskStatus = (taskId: string, status: 'todo' | 'in_progress' | 'done') => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  // Active channel messages
  const currentMessages = activeChannel ? messagesMap[activeChannel.id] || [] : [];

  if (!authChecked) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#1e1f22] text-[#949ba4] text-sm">
        Carregando DÉZCORD...
      </div>
    );
  }

  if (!authed) {
    return <AuthScreen onAuth={() => setAuthed(true)} />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#313338] text-[#dbdee1] font-sans antialiased">
      {/* 1. Project / Server Sidebar (Far Left) */}
      <ServerSidebar
        servers={servers}
        activeServerId={activeServerId}
        onSelectServer={(id) => {
          setActiveServerId(id);
          setActiveView('channel');
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

      {/* 2. Channel & Project Tools Sidebar (Left Middle) */}
      <ChannelSidebar
        server={activeServer}
        activeChannelId={activeChannelId}
        activeView={activeView}
        onSelectChannel={handleSelectChannel}
        onSelectView={(v) => setActiveView(v)}
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
        onOpenLogin={() => setIsLoginOpen(true)}
      />

      {/* 3. Main Center Content Area */}
      {activeServerId === null ? (
        // Direct Messages / Friends Hub View
        <DirectMessagesView
          friends={sampleUsers}
          currentUser={currentUser}
          onStartChat={(_user) => {
            setActiveServerId('srv_dezcord');
            setActiveChannelId('c_geral');
            setActiveView('channel');
          }}
        />
      ) : activeServer && activeView === 'files' ? (
        // Internal Storage View (Files, Folders, Previews)
        <FileStorageView
          projectId={activeServer.id}
          projectName={activeServer.name}
          folders={folders}
          files={files}
          currentUser={currentUser}
          onCreateFolder={handleCreateFolder}
          onDeleteFolder={handleDeleteFolder}
          onUploadFile={handleUploadFile}
          onDeleteFile={handleDeleteFile}
          onShareToChat={handleShareFileToChat}
          showMemberList={showMemberList}
          onToggleMemberList={() => setShowMemberList(!showMemberList)}
        />
      ) : activeServer && activeView === 'tasks' ? (
        // Project Task Board (Kanban organization)
        <ProjectTaskBoard
          projectId={activeServer.id}
          projectName={activeServer.name}
          tasks={tasks}
          currentUser={currentUser}
          onCreateTask={handleCreateTask}
          onUpdateTaskStatus={handleUpdateTaskStatus}
          onDeleteTask={handleDeleteTask}
          showMemberList={showMemberList}
          onToggleMemberList={() => setShowMemberList(!showMemberList)}
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
            const firstText = activeServer?.channels.find((c) => c.type === 'text');
            if (firstText) setActiveChannelId(firstText.id);
          }}
        />
      ) : activeChannel ? (
        // Text Channel Chat Area with Realtime
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
          onOpenFilesView={() => setActiveView('files')}
          isBotTyping={isBotTyping}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-[#949ba4]">
          Selecione um canal ou ferramenta de projeto para começar
        </div>
      )}

      {/* 4. Server Member List Sidebar (Far Right - Optional & Toggleable) */}
      {activeServerId !== null && showMemberList && (
        <MemberListSidebar
          members={sampleUsers}
          ownerId={activeServer?.owner_id || ''}
        />
      )}

      {/* MODALS */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        currentUser={currentUser}
        onSaveUser={(updated) => setCurrentUser(updated)}
      />

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
