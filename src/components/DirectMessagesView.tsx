import { useState } from 'react';
import type { UserProfile } from '../types';
import { UserPlus, MessageSquare, Phone, Video, Search, Check, Menu } from 'lucide-react';

interface DirectMessagesViewProps {
  friends: UserProfile[];
  currentUser: UserProfile;
  onStartChat: (user: UserProfile) => void;
  onOpenChannelList?: () => void;
}

type FriendTab = 'online' | 'all' | 'pending' | 'add';

export const DirectMessagesView: React.FC<DirectMessagesViewProps> = ({
  friends,
  currentUser,
  onStartChat,
  onOpenChannelList,
}) => {
  const [tab, setTab] = useState<FriendTab>('online');
  const [searchQuery, setSearchQuery] = useState('');
  const [addFriendInput, setAddFriendInput] = useState('');
  const [addSuccess, setAddSuccess] = useState(false);

  const onlineFriends = friends.filter(
    (f) => f.id !== currentUser.id && f.status !== 'offline'
  );
  const allFriends = friends.filter((f) => f.id !== currentUser.id);

  const displayedFriends = (tab === 'online' ? onlineFriends : allFriends).filter((f) =>
    f.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddFriend = (e: React.FormEvent) => {
    e.preventDefault();
    if (addFriendInput.trim()) {
      setAddSuccess(true);
      setTimeout(() => setAddSuccess(false), 3000);
      setAddFriendInput('');
    }
  };

  return (
    <div className="flex-1 min-w-0 bg-[#313338] flex flex-col h-full overflow-hidden">
      {/* Top Header */}
      <div className="h-12 px-3 md:px-6 border-b border-[#1f2023] flex items-center justify-between gap-2 shadow-sm bg-[#313338]">
        <div className="flex items-center gap-3 md:gap-6 min-w-0">
          {onOpenChannelList && (
            <button
              onClick={onOpenChannelList}
              title="Lista de conversas"
              className="md:hidden text-[#b5bac1] hover:text-white transition shrink-0"
            >
              <Menu size={22} />
            </button>
          )}
          <div className="flex items-center gap-2 font-semibold text-white">
            <UserPlus size={20} className="text-[#80848e]" />
            <span>Amigos</span>
          </div>

          <div className="w-[1px] h-4 bg-[#4e5058]" />

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 md:gap-3 text-sm font-medium overflow-x-auto min-w-0">
            <button
              onClick={() => setTab('online')}
              className={`px-2 py-1 rounded transition whitespace-nowrap shrink-0 ${
                tab === 'online'
                  ? 'bg-[#404249] text-white'
                  : 'text-[#b5bac1] hover:bg-[#35373c] hover:text-[#dbdee1]'
              }`}
            >
              Disponível ({onlineFriends.length})
            </button>
            <button
              onClick={() => setTab('all')}
              className={`px-2 py-1 rounded transition whitespace-nowrap shrink-0 ${
                tab === 'all'
                  ? 'bg-[#404249] text-white'
                  : 'text-[#b5bac1] hover:bg-[#35373c] hover:text-[#dbdee1]'
              }`}
            >
              Todos ({allFriends.length})
            </button>
            <button
              onClick={() => setTab('add')}
              className={`px-2.5 py-1 rounded transition font-semibold whitespace-nowrap shrink-0 ${
                tab === 'add'
                  ? 'bg-[#23a55a] text-white'
                  : 'bg-[#23a55a]/20 text-[#23a55a] hover:bg-[#23a55a] hover:text-white'
              }`}
            >
              Adicionar Amigo
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Pane */}
      <div className="flex-1 p-6 overflow-y-auto">
        {tab === 'add' ? (
          <div className="max-w-xl">
            <h3 className="text-base font-bold text-white uppercase tracking-wide">
              ADICIONAR AMIGO
            </h3>
            <p className="text-xs text-[#949ba4] mt-1">
              Você pode adicionar amigos com o nome de usuário do DÉZCORD.
            </p>

            <form onSubmit={handleAddFriend} className="mt-4">
              <div className="bg-[#1e1f22] p-3 rounded-lg border border-[#111214] flex items-center justify-between">
                <input
                  type="text"
                  placeholder="Você pode adicionar amigos com o nome de usuário"
                  value={addFriendInput}
                  onChange={(e) => setAddFriendInput(e.target.value)}
                  className="bg-transparent text-sm text-white focus:outline-none flex-1 placeholder-[#949ba4]"
                />
                <button
                  type="submit"
                  disabled={!addFriendInput.trim()}
                  className="bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded transition"
                >
                  Enviar Pedido
                </button>
              </div>
            </form>

            {addSuccess && (
              <div className="mt-3 text-xs text-[#23a55a] flex items-center gap-1.5 font-medium">
                <Check size={16} />
                <span>Pedido de amizade enviado com sucesso!</span>
              </div>
            )}
          </div>
        ) : (
          <div>
            {/* Search Input */}
            <div className="relative mb-6">
              <input
                type="text"
                placeholder="Buscar"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#1e1f22] text-white text-sm px-4 py-2 rounded border border-[#1f2023] focus:outline-none focus:border-[#5865f2] placeholder-[#949ba4]"
              />
              <Search size={18} className="absolute right-3 top-2.5 text-[#949ba4]" />
            </div>

            {/* Friend List */}
            <div className="text-xs font-bold text-[#949ba4] uppercase tracking-wider mb-2">
              {tab === 'online' ? `DISPONÍVEL — ${displayedFriends.length}` : `TODOS OS AMIGOS — ${displayedFriends.length}`}
            </div>

            <div className="space-y-1">
              {displayedFriends.map((friend) => (
                <div
                  key={friend.id}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-[#35373c] border-t border-[#35373c]/30 group transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={friend.avatar_url}
                        alt={friend.username}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <span
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#313338] ${
                          friend.status === 'online'
                            ? 'bg-[#23a55a]'
                            : friend.status === 'idle'
                            ? 'bg-[#f0b232]'
                            : friend.status === 'dnd'
                            ? 'bg-[#f23f43]'
                            : 'bg-[#80848e]'
                        }`}
                      />
                    </div>
                    <div>
                      <div className="font-semibold text-white text-sm">
                        {friend.display_name}
                      </div>
                      <div className="text-xs text-[#949ba4]">
                        {friend.custom_status || `@${friend.username}`}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onStartChat(friend)}
                      title="Enviar Mensagem"
                      className="w-9 h-9 rounded-full bg-[#2b2d31] hover:bg-[#111214] text-[#b5bac1] hover:text-white flex items-center justify-center transition"
                    >
                      <MessageSquare size={18} />
                    </button>
                    <button
                      title="Chamada de Voz"
                      className="w-9 h-9 rounded-full bg-[#2b2d31] hover:bg-[#111214] text-[#b5bac1] hover:text-white flex items-center justify-center transition"
                    >
                      <Phone size={18} />
                    </button>
                    <button
                      title="Chamada de Vídeo"
                      className="w-9 h-9 rounded-full bg-[#2b2d31] hover:bg-[#111214] text-[#b5bac1] hover:text-white flex items-center justify-center transition"
                    >
                      <Video size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
