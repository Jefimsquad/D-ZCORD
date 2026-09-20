import { useState, useRef, useEffect } from 'react';
import type { Channel, Message, UserProfile } from '../types';
import {
  Hash,
  Bell,
  Pin,
  Users,
  Search,
  PlusCircle,
  Smile,
  Send,
  Trash2,
  Reply,
  Database,
  Bot,
  Sparkles
} from 'lucide-react';

interface ChatAreaProps {
  channel: Channel;
  messages: Message[];
  currentUser: UserProfile;
  onSendMessage: (content: string, attachments?: string[]) => void;
  onAddReaction: (messageId: string, emoji: string) => void;
  onDeleteMessage: (messageId: string) => void;
  showMemberList: boolean;
  onToggleMemberList: () => void;
  isSupabaseConnected: boolean;
  onOpenSupabaseConfig: () => void;
  onOpenFilesView?: () => void;
  isBotTyping?: boolean;
}

const EMOJI_GROUPS: { name: string; emojis: string[] }[] = [
  { name: 'Rostos', emojis: ['😀', '😁', '😂', '🤣', '😊', '😍', '😎', '🤔', '😴', '😭', '😡', '🥳', '😱', '🤖', '👻', '💀'] },
  { name: 'Gestos', emojis: ['👍', '👎', '👏', '🙏', '💪', '👀', '🫡', '✌️', '🤝', '👋', '🫶', '👌'] },
  { name: 'Corações', emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '✨', '💯', '💥'] },
  { name: 'Festa', emojis: ['🎉', '🔥', '🚀', '⚡', '🎮', '🏆', '🎧', '🎬', '⚽', '🍕', '☕', '🍺'] },
  { name: 'Símbolos', emojis: ['✅', '❌', '⭐', '❓', '❗', '💡', '📌', '🎯', '🚫', '🔔', '💤', '♻️'] },
];

export const ChatArea = ({
  channel,
  messages,
  currentUser,
  onSendMessage,
  onAddReaction,
  onDeleteMessage,
  showMemberList,
  onToggleMemberList,
  isSupabaseConnected,
  onOpenSupabaseConfig,
  onOpenFilesView,
  isBotTyping = false,
}: ChatAreaProps) => {
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [showInputPicker, setShowInputPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom on new message or bot typing
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isBotTyping]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() && !previewAttachment) return;

    const attachments = previewAttachment ? [previewAttachment] : undefined;
    onSendMessage(inputText.trim(), attachments);
    setInputText('');
    setPreviewAttachment(null);
    setReplyingTo(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewAttachment(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Format message text for markdown (bold, code blocks, quotes)
  const renderFormattedContent = (content: string) => {
    // Code block detection
    if (content.startsWith('```') && content.endsWith('```')) {
      const lines = content.slice(3, -3).trim().split('\n');
      const lang = lines[0].match(/^[a-zA-Z0-9_-]+$/) ? lines[0] : '';
      const code = lang ? lines.slice(1).join('\n') : lines.join('\n');

      return (
        <pre className="bg-[#1e1f22] p-3 rounded-md border border-[#2b2d31] font-mono text-xs overflow-x-auto text-[#dbdee1] my-1">
          {code}
        </pre>
      );
    }

    // Standard markdown rendering
    const parts = content.split(/(\*\*.*?\*\*|`.*?`)/g);
    return (
      <span>
        {parts.map((part, index) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={index} className="font-bold text-white">
                {part.slice(2, -2)}
              </strong>
            );
          }
          if (part.startsWith('`') && part.endsWith('`')) {
            return (
              <code
                key={index}
                className="bg-[#2b2d31] px-1.5 py-0.5 rounded text-xs font-mono text-[#e0e1e5]"
              >
                {part.slice(1, -1)}
              </code>
            );
          }
          return part;
        })}
      </span>
    );
  };

  return (
    <div className="flex-1 bg-[#313338] flex flex-col h-full overflow-hidden">
      {/* Channel Header */}
      <div className="h-14 px-4 border-b border-[#1f2023] flex items-center justify-between text-white shadow-sm bg-[#313338] z-10">
        <div className="flex items-center gap-3 overflow-hidden">
          <Hash size={24} className="text-[#80848e] shrink-0" />
          <span className="font-bold text-base text-white truncate">{channel.name}</span>
          {channel.topic && (
            <>
              <div className="w-[1px] h-4 bg-[#4e5058] shrink-0" />
              <span className="text-xs text-[#949ba4] truncate font-normal">
                {channel.topic}
              </span>
            </>
          )}
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-3 text-[#b5bac1]">
          {/* Quick Files Access Button */}
          {onOpenFilesView && (
            <button
              onClick={onOpenFilesView}
              className="text-xs font-medium bg-[#1e1f22] hover:bg-[#2b2d31] text-[#949ba4] hover:text-white px-2.5 py-1 rounded transition"
              title="Acessar Arquivos do Projeto"
            >
              📁 Arquivos
            </button>
          )}

          {/* Supabase Status Pill */}
          <button
            onClick={onOpenSupabaseConfig}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition ${
              isSupabaseConnected
                ? 'bg-[#1c3829] text-[#3ecf8e] hover:bg-[#224734]'
                : 'bg-[#3c331e] text-[#f0b232] hover:bg-[#4d4126]'
            }`}
            title="Status do Banco Supabase"
          >
            <Database size={12} />
            <span>{isSupabaseConnected ? 'Supabase Conectado' : 'Supabase (Demo)'}</span>
          </button>

          <button title="Notificações" className="hover:text-white transition">
            <Bell size={18} />
          </button>
          <button title="Mensagens Fixadas" className="hover:text-white transition">
            <Pin size={18} />
          </button>
          <button
            onClick={onToggleMemberList}
            title={showMemberList ? 'Ocultar Lista de Usuários' : 'Exibir Lista de Usuários'}
            className={`p-1.5 rounded transition ${
              showMemberList ? 'text-white bg-[#404249]' : 'text-[#b5bac1] hover:bg-[#35373c] hover:text-white'
            }`}
          >
            <Users size={18} />
          </button>

          {/* Search Bar */}
          <div className="relative flex items-center">
            <input
              type="text"
              placeholder="Buscar no canal..."
              className="w-32 focus:w-48 bg-[#1e1f22] text-xs px-2.5 py-1 pr-6 rounded text-white placeholder-[#949ba4] focus:outline-none transition-all duration-200"
            />
            <Search size={13} className="absolute right-2 text-[#949ba4] pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Welcome Channel Banner */}
        <div className="pt-6 pb-4 border-b border-[#35373c]/40">
          <div className="w-14 h-14 rounded-full bg-[#404249] flex items-center justify-center mb-3">
            <Hash size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">
            Bem-vindo ao #{channel.name}!
          </h2>
          <p className="text-[#949ba4] text-xs mt-1">
            Este é o canal oficial de comunicação de #{channel.name}. Use <code className="text-[#5865f2]">/ia</code> para perguntar ao Dézcord Bot!
          </p>
        </div>

        {/* Message Items */}
        {messages.map((message) => {
          const isCurrentUser = message.user_id === currentUser.id;
          const timeString = new Date(message.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <div
              key={message.id}
              className="group relative flex gap-3 px-2 py-1.5 -mx-2 rounded hover:bg-[#2e3035] transition duration-150"
            >
              {/* Message Actions Toolbar (Hover) */}
              <div className="absolute right-3 -top-3 hidden group-hover:flex items-center bg-[#313338] border border-[#232428] rounded-md shadow-md overflow-hidden z-10">
                {/* Add Emoji */}
                <div className="relative">
                  <button
                    onClick={() =>
                      setShowEmojiPicker(showEmojiPicker === message.id ? null : message.id)
                    }
                    className="p-1.5 text-[#b5bac1] hover:text-white hover:bg-[#35373c] transition"
                    title="Adicionar Reação"
                  >
                    <Smile size={16} />
                  </button>

                  {/* Quick Reaction Popup */}
                  {showEmojiPicker === message.id && (
                    <div className="absolute right-0 top-8 bg-[#2b2d31] border border-[#1f2023] rounded-lg p-2 shadow-2xl z-30 w-72 max-h-64 overflow-y-auto">
                      {EMOJI_GROUPS.map((group) => (
                        <div key={group.name} className="mb-1.5">
                          <div className="text-[10px] font-bold text-[#949ba4] uppercase px-1 mb-1">
                            {group.name}
                          </div>
                          <div className="grid grid-cols-8 gap-0.5">
                            {group.emojis.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => {
                                  onAddReaction(message.id, emoji);
                                  setShowEmojiPicker(null);
                                }}
                                className="hover:bg-[#35373c] hover:scale-125 transition text-lg p-1 rounded"
                                title={emoji}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Reply */}
                <button
                  onClick={() => setReplyingTo(message)}
                  className="p-1.5 text-[#b5bac1] hover:text-white hover:bg-[#35373c] transition"
                  title="Responder"
                >
                  <Reply size={16} />
                </button>

                {/* Delete if author */}
                {isCurrentUser && (
                  <button
                    onClick={() => onDeleteMessage(message.id)}
                    className="p-1.5 text-[#b5bac1] hover:text-[#f23f43] hover:bg-[#35373c] transition"
                    title="Excluir Mensagem"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              {/* Author Avatar */}
              <div className="shrink-0 mt-0.5">
                <img
                  src={message.author.avatar_url || 'https://via.placeholder.com/40'}
                  alt={message.author.username}
                  className="w-10 h-10 rounded-full object-cover cursor-pointer hover:opacity-85 transition"
                />
              </div>

              {/* Message Body */}
              <div className="flex-1 overflow-hidden">
                {/* Replying banner */}
                {message.reply_to && (
                  <div className="flex items-center gap-1 text-xs text-[#949ba4] mb-1">
                    <span className="text-[#5865f2]">⤷ Respondendo a</span>
                    <span className="font-semibold text-white">
                      {message.reply_to.author_name}:
                    </span>
                    <span className="truncate italic max-w-sm">
                      {message.reply_to.content}
                    </span>
                  </div>
                )}

                {/* Author Info & Timestamp */}
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-sm text-white hover:underline cursor-pointer">
                    {message.author.display_name}
                  </span>
                  {message.author.username.includes('bot') && (
                    <span className="bg-[#5865f2] text-white text-[9px] font-bold px-1 rounded uppercase flex items-center gap-0.5">
                      <Bot size={10} />
                      <span>BOT IA</span>
                    </span>
                  )}
                  <span className="text-[11px] text-[#949ba4]">{timeString}</span>
                </div>

                {/* Content */}
                <div className="text-sm text-[#dbdee1] leading-relaxed mt-0.5 break-words select-text">
                  {renderFormattedContent(message.content)}
                </div>

                {/* Attachments */}
                {message.attachments && message.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {message.attachments.map((att, idx) => (
                      <div
                        key={idx}
                        className="max-w-md max-h-72 rounded-lg overflow-hidden border border-[#2b2d31] bg-[#1e1f22]"
                      >
                        <img
                          src={att}
                          alt="Anexo"
                          className="w-full h-full object-contain cursor-pointer hover:opacity-95 transition"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Reactions */}
                {message.reactions && message.reactions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {message.reactions.map((react, i) => {
                      const hasReacted = react.users.includes(currentUser.id);
                      return (
                        <button
                          key={i}
                          onClick={() => onAddReaction(message.id, react.emoji)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border transition ${
                            hasReacted
                              ? 'bg-[#3c4270] border-[#5865f2] text-white'
                              : 'bg-[#2b2d31] border-transparent text-[#b5bac1] hover:bg-[#35373c]'
                          }`}
                        >
                          <span>{react.emoji}</span>
                          <span>{react.count}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Bot Typing Indicator */}
        {isBotTyping && (
          <div className="flex items-center gap-2 text-xs text-[#949ba4] italic py-1">
            <Bot size={14} className="text-[#5865f2] animate-spin" />
            <span>DÉZ BOT IA está digitando...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Replying Notice Bar */}
      {replyingTo && (
        <div className="bg-[#2b2d31] px-4 py-1.5 flex items-center justify-between text-xs text-[#949ba4] border-t border-[#1f2023]">
          <div className="flex items-center gap-2 truncate">
            <span>Respondendo a <strong className="text-white">@{replyingTo.author.display_name}</strong></span>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="hover:text-white transition"
          >
            ✕
          </button>
        </div>
      )}

      {/* Attachment Preview */}
      {previewAttachment && (
        <div className="bg-[#2b2d31] px-4 py-2 border-t border-[#1f2023] flex items-center gap-3">
          <div className="w-14 h-14 rounded bg-[#1e1f22] overflow-hidden relative">
            <img src={previewAttachment} alt="Preview" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 text-xs text-[#dbdee1]">Imagem anexada pronta para enviar</div>
          <button
            onClick={() => setPreviewAttachment(null)}
            className="text-xs text-[#f23f43] hover:underline"
          >
            Remover
          </button>
        </div>
      )}

      {/* Quick Bot Prompt Chips */}
      <div className="px-4 pt-1 flex items-center gap-2 text-[11px] text-[#949ba4] overflow-x-auto no-scrollbar">
        <span className="flex items-center gap-1 text-[#5865f2] font-semibold shrink-0">
          <Sparkles size={12} /> Sugestões:
        </span>
        <button
          onClick={() => setInputText('/ia Como organizar os arquivos deste projeto?')}
          className="bg-[#2b2d31] hover:bg-[#35373c] text-[#dbdee1] px-2 py-0.5 rounded truncate transition shrink-0"
        >
          💡 /ia Dicas de organização
        </button>
        <button
          onClick={() => setInputText('/resumo')}
          className="bg-[#2b2d31] hover:bg-[#35373c] text-[#dbdee1] px-2 py-0.5 rounded truncate transition shrink-0"
        >
          📊 /resumo do projeto
        </button>
        <button
          onClick={() => setInputText('/ajuda')}
          className="bg-[#2b2d31] hover:bg-[#35373c] text-[#dbdee1] px-2 py-0.5 rounded truncate transition shrink-0"
        >
          ❓ /ajuda
        </button>
      </div>

      {/* Message Input Box */}
      <div className="px-4 pb-5 pt-2 relative">
        <div className="bg-[#383a40] rounded-lg flex items-center px-4 py-2.5 gap-3">
          {/* File Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Enviar uma imagem ou anexo"
            className="text-[#b5bac1] hover:text-white transition shrink-0"
          >
            <PlusCircle size={22} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Text Input */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Conversar em #${channel.name} (ou /ia para assistência)`}
            className="flex-1 bg-transparent text-sm text-[#dbdee1] placeholder-[#80848e] focus:outline-none"
          />

          {/* Emoji Button */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowInputPicker((v) => !v)}
              title="Adicionar Emoji"
              className={`transition shrink-0 ${showInputPicker ? 'text-[#f0b232]' : 'text-[#b5bac1] hover:text-[#f0b232]'}`}
            >
              <Smile size={22} />
            </button>
            {showInputPicker && (
              <div className="absolute bottom-9 right-0 bg-[#2b2d31] border border-[#1f2023] rounded-lg p-2 shadow-2xl z-30 w-72 max-h-64 overflow-y-auto">
                {EMOJI_GROUPS.map((group) => (
                  <div key={group.name} className="mb-1.5">
                    <div className="text-[10px] font-bold text-[#949ba4] uppercase px-1 mb-1">
                      {group.name}
                    </div>
                    <div className="grid grid-cols-8 gap-0.5">
                      {group.emojis.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            setInputText((prev) => prev + emoji);
                            setShowInputPicker(false);
                          }}
                          className="hover:bg-[#35373c] hover:scale-125 transition text-lg p-1 rounded"
                          title={emoji}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Send Button */}
          {(inputText.trim() || previewAttachment) && (
            <button
              onClick={() => handleSend()}
              title="Enviar Mensagem"
              className="bg-[#5865f2] hover:bg-[#4752c4] text-white p-1.5 rounded-full transition shrink-0"
            >
              <Send size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
