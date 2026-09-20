import { useState } from 'react';
import type { Server, Channel, UserProfile } from '../types';
import type { VoicePeerInfo } from '../lib/voice';
import {
  Hash,
  Volume2,
  ChevronDown,
  Plus,
  Mic,
  MicOff,
  Headphones,
  Settings,
  PhoneOff,
  Radio,
  UserPlus,
  Shield,
  HardDrive,
  CheckSquare,
  Edit3,
  Video,
  ScreenShare
} from 'lucide-react';

interface ChannelSidebarProps {
  server: Server | null;
  activeChannelId: string;
  activeView: 'channel' | 'files' | 'tasks';
  onSelectChannel: (channel: Channel) => void;
  onSelectView: (view: 'channel' | 'files' | 'tasks') => void;
  currentUser: UserProfile;
  activeVoiceChannel: Channel | null;
  isMuted: boolean;
  isDeafened: boolean;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onDisconnectVoice: () => void;
  onOpenCreateChannel: (type: 'text' | 'voice') => void;
  onOpenSettings: () => void;
  onOpenLogin: () => void;
  voicePresence?: Record<string, VoicePeerInfo[]>;
}

export const ChannelSidebar = ({
  server,
  activeChannelId,
  activeView,
  onSelectChannel,
  onSelectView,
  currentUser,
  activeVoiceChannel,
  isMuted,
  isDeafened,
  onToggleMute,
  onToggleDeafen,
  onDisconnectVoice,
  onOpenCreateChannel,
  onOpenSettings,
  onOpenLogin,
  voicePresence,
}: ChannelSidebarProps) => {
  const [isServerMenuOpen, setIsServerMenuOpen] = useState(false);

  if (!server) {
    // Direct Messages Sidebar View
    return (
      <div className="w-60 bg-[#2b2d31] flex flex-col h-full border-r border-[#1f2023] select-none">
        <div className="h-12 px-4 flex items-center border-b border-[#1f2023] shadow-sm">
          <input
            type="text"
            placeholder="Encontre ou comece uma conversa"
            className="w-full bg-[#1e1f22] text-[#dbdee1] placeholder-[#949ba4] text-xs px-2 py-1.5 rounded focus:outline-none"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          <div className="flex items-center gap-3 px-3 py-2 rounded text-[#dbdee1] bg-[#404249] font-medium text-sm cursor-pointer">
            <UserPlus size={18} className="text-[#b5bac1]" />
            <span>Amigos</span>
          </div>

          <div className="pt-4 px-2 text-xs font-bold text-[#949ba4] tracking-wider uppercase">
            MENSAGENS DIRETAS
          </div>

          <div className="flex items-center gap-3 px-2 py-2 rounded text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1] cursor-pointer transition">
            <div className="relative">
              <img
                src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=80&auto=format&fit=crop&q=80"
                alt="Bot"
                className="w-8 h-8 rounded-full object-cover"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#23a55a] rounded-full border-2 border-[#2b2d31]" />
            </div>
            <div className="flex-1 truncate">
              <div className="text-sm font-semibold text-white">DÉZ BOT 🤖</div>
              <div className="text-xs text-[#949ba4] truncate">Tocando Lo-Fi 24/7</div>
            </div>
          </div>
        </div>

        {/* User bar at bottom */}
        {renderUserBar(currentUser, isMuted, isDeafened, onToggleMute, onToggleDeafen, onOpenSettings, onOpenLogin)}
      </div>
    );
  }

  // Categorize channels
  const textChannels = server.channels.filter((c) => c.type === 'text');
  const voiceChannels = server.channels.filter((c) => c.type === 'voice');

  return (
    <div className="w-60 bg-[#2b2d31] flex flex-col h-full border-r border-[#1f2023] select-none relative">
      {/* Server Header */}
      <button
        onClick={() => setIsServerMenuOpen(!isServerMenuOpen)}
        className="h-12 px-4 flex items-center justify-between border-b border-[#1f2023] hover:bg-[#35373c] transition font-bold text-white shadow-sm"
      >
        <span className="truncate">{server.name}</span>
        <ChevronDown
          size={18}
          className={`transition-transform duration-200 ${isServerMenuOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Server Dropdown Menu */}
      {isServerMenuOpen && (
        <div className="absolute top-14 left-2 right-2 bg-[#111214] rounded-md p-1.5 z-30 shadow-2xl border border-[#2b2d31] space-y-1">
          <button
            onClick={() => {
              setIsServerMenuOpen(false);
              onOpenCreateChannel('text');
            }}
            className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-[#5865f2] hover:bg-[#5865f2] hover:text-white rounded transition font-medium"
          >
            <span>Criar Canal</span>
            <Plus size={16} />
          </button>
          <button
            onClick={() => {
              setIsServerMenuOpen(false);
              onOpenSettings();
            }}
            className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-[#949ba4] hover:bg-[#35373c] hover:text-white rounded transition"
          >
            <span>Configurações do Projeto</span>
            <Shield size={14} />
          </button>
        </div>
      )}

      {/* Channels & Project Tools List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {/* PROJECT ORGANIZATION CATEGORY */}
        <div>
          <div className="px-2 mb-1 text-[11px] font-bold tracking-wider uppercase text-[#949ba4]">
            ORGANIZAÇÃO DO PROJETO
          </div>
          <div className="space-y-0.5">
            <button
              onClick={() => onSelectView('files')}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition group ${
                activeView === 'files'
                  ? 'bg-[#404249] text-white font-medium'
                  : 'text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1]'
              }`}
            >
              <HardDrive size={18} className={activeView === 'files' ? 'text-[#3ecf8e]' : 'text-[#80848e]'} />
              <span className="truncate">Arquivos & Documentos</span>
            </button>

            <button
              onClick={() => onSelectView('tasks')}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition group ${
                activeView === 'tasks'
                  ? 'bg-[#404249] text-white font-medium'
                  : 'text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1]'
              }`}
            >
              <CheckSquare size={18} className={activeView === 'tasks' ? 'text-[#5865f2]' : 'text-[#80848e]'} />
              <span className="truncate">Quadro de Tarefas</span>
            </button>
          </div>
        </div>

        {/* TEXT CHANNELS CATEGORY */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1 group text-[#949ba4] hover:text-[#dbdee1] cursor-pointer">
            <span className="text-[11px] font-bold tracking-wider uppercase">CANAIS DE TEXTO</span>
            <button
              onClick={() => onOpenCreateChannel('text')}
              title="Criar Canal de Texto"
              className="opacity-0 group-hover:opacity-100 hover:text-white transition"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="space-y-0.5">
            {textChannels.map((channel) => {
              const isActive = activeView === 'channel' && activeChannelId === channel.id;
              return (
                <button
                  key={channel.id}
                  onClick={() => onSelectChannel(channel)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition group ${
                    isActive
                      ? 'bg-[#404249] text-white font-medium'
                      : 'text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1]'
                  }`}
                >
                  <Hash size={18} className={isActive ? 'text-white' : 'text-[#80848e]'} />
                  <span className="truncate">{channel.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* VOICE CHANNELS CATEGORY */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1 group text-[#949ba4] hover:text-[#dbdee1] cursor-pointer">
            <span className="text-[11px] font-bold tracking-wider uppercase">CANAIS DE VOZ</span>
            <button
              onClick={() => onOpenCreateChannel('voice')}
              title="Criar Canal de Voz"
              className="opacity-0 group-hover:opacity-100 hover:text-white transition"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="space-y-0.5">
            {voiceChannels.map((channel) => {
              const isVoiceConnected = activeVoiceChannel?.id === channel.id;
              const peers = (voicePresence?.[channel.id] || []).filter(
                (p) => p.user_id !== currentUser.id
              );
              return (
                <div key={channel.id}>
                  <button
                    onClick={() => onSelectChannel(channel)}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition ${
                      isVoiceConnected
                        ? 'bg-[#35373c] text-[#23a55a] font-medium'
                        : 'text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1]'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Volume2 size={18} className={isVoiceConnected ? 'text-[#23a55a]' : 'text-[#80848e]'} />
                      <span className="truncate">{channel.name}</span>
                    </div>
                    {isVoiceConnected ? (
                      <span className="w-2 h-2 rounded-full bg-[#23a55a] animate-ping" />
                    ) : (
                      peers.length > 0 && (
                        <span className="text-[10px] font-bold text-[#23a55a] bg-[#23a55a]/15 px-1.5 py-0.5 rounded-full">
                          {peers.length}
                        </span>
                      )
                    )}
                  </button>

                  {/* Connected User Tile under channel */}
                  {isVoiceConnected && (
                    <div className="pl-6 pr-2 py-1 flex items-center gap-2 text-xs text-[#dbdee1]">
                      <img
                        src={currentUser.avatar_url}
                        alt="User"
                        className="w-5 h-5 rounded-full object-cover"
                      />
                      <span className="truncate flex-1">{currentUser.display_name}</span>
                      {isMuted && <MicOff size={12} className="text-[#f23f43]" />}
                    </div>
                  )}

                  {/* Outros usuários na call (tempo real) */}
                  {peers.map((peer) => (
                    <div key={peer.user_id} className="pl-6 pr-2 py-1 flex items-center gap-2 text-xs text-[#dbdee1]">
                      <img
                        src={peer.avatar_url || 'https://via.placeholder.com/20'}
                        alt={peer.display_name}
                        className="w-5 h-5 rounded-full object-cover"
                      />
                      <span className="truncate flex-1">{peer.display_name}</span>
                      {peer.video && <Video size={12} className="text-[#23a55a]" />}
                      {peer.screensharing && <ScreenShare size={12} className="text-[#23a55a]" />}
                      {peer.muted && <MicOff size={12} className="text-[#f23f43]" />}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Voice Connection Status Card */}
      {activeVoiceChannel && (
        <div className="bg-[#232428] border-b border-[#1f2023] px-3 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Radio size={16} className="text-[#23a55a] animate-pulse" />
            <div>
              <div className="text-[#23a55a] font-semibold flex items-center gap-1">
                Voz Conectada
              </div>
              <div className="text-[#949ba4] text-[10px] truncate">
                {activeVoiceChannel.name} / RTC 28ms
              </div>
            </div>
          </div>
          <button
            onClick={onDisconnectVoice}
            title="Desconectar da chamada"
            className="p-1.5 rounded text-[#949ba4] hover:text-[#f23f43] hover:bg-[#35373c] transition"
          >
            <PhoneOff size={16} />
          </button>
        </div>
      )}

      {/* User bar at bottom */}
      {renderUserBar(currentUser, isMuted, isDeafened, onToggleMute, onToggleDeafen, onOpenSettings, onOpenLogin)}
    </div>
  );
};

function renderUserBar(
  currentUser: UserProfile,
  isMuted: boolean,
  isDeafened: boolean,
  onToggleMute: () => void,
  onToggleDeafen: () => void,
  onOpenSettings: () => void,
  onOpenLogin: () => void
) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-[#23a55a]';
      case 'idle':
        return 'bg-[#f0b232]';
      case 'dnd':
        return 'bg-[#f23f43]';
      default:
        return 'bg-[#80848e]';
    }
  };

  return (
    <div className="h-[54px] bg-[#232428] px-2 flex items-center justify-between border-t border-[#1f2023]">
      {/* Profile & Avatar (Clicking opens Quick Login / Profile Edit) */}
      <div
        onClick={onOpenLogin}
        className="flex items-center gap-2 p-1 rounded hover:bg-[#35373c] cursor-pointer transition max-w-[130px] group"
        title="Clique para entrar / editar perfil"
      >
        <div className="relative shrink-0">
          <img
            src={currentUser.avatar_url}
            alt={currentUser.username}
            className="w-8 h-8 rounded-full object-cover"
          />
          <span
            className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#232428] ${getStatusColor(
              currentUser.status
            )}`}
          />
        </div>
        <div className="truncate">
          <div className="text-xs font-semibold text-white leading-tight truncate flex items-center gap-1">
            <span>{currentUser.display_name}</span>
            <Edit3 size={10} className="opacity-0 group-hover:opacity-100 text-[#5865f2] shrink-0 transition" />
          </div>
          <div className="text-[11px] text-[#949ba4] leading-tight truncate">
            {currentUser.custom_status || `@${currentUser.username}`}
          </div>
        </div>
      </div>

      {/* Voice & Settings Controls */}
      <div className="flex items-center gap-0.5 text-[#b5bac1]">
        <button
          onClick={onToggleMute}
          title={isMuted ? 'Desmutar Microfone' : 'Mutar Microfone'}
          className={`p-1.5 rounded hover:bg-[#35373c] hover:text-white transition ${
            isMuted ? 'text-[#f23f43]' : ''
          }`}
        >
          {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
        </button>

        <button
          onClick={onToggleDeafen}
          title={isDeafened ? 'Ensurdecer Desativado' : 'Ensurdecer'}
          className={`p-1.5 rounded hover:bg-[#35373c] hover:text-white transition ${
            isDeafened ? 'text-[#f23f43]' : ''
          }`}
        >
          <Headphones size={18} />
        </button>

        <button
          onClick={onOpenSettings}
          title="Configurações do Usuário"
          className="p-1.5 rounded hover:bg-[#35373c] hover:text-white transition hover:rotate-15"
        >
          <Settings size={20} />
        </button>
      </div>
    </div>
  );
}
