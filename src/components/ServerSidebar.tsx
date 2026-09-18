import type { Server } from '../types';
import { Plus, Compass, Database } from 'lucide-react';

interface ServerSidebarProps {
  servers: Server[];
  activeServerId: string | null;
  onSelectServer: (id: string | null) => void;
  onOpenCreateServer: () => void;
  onOpenSupabaseConfig: () => void;
  isSupabaseConnected: boolean;
}

export const ServerSidebar: React.FC<ServerSidebarProps> = ({
  servers,
  activeServerId,
  onSelectServer,
  onOpenCreateServer,
  onOpenSupabaseConfig,
  isSupabaseConnected,
}) => {
  return (
    <div className="w-[72px] bg-[#1e1f22] flex flex-col items-center py-3 gap-2 select-none h-full z-20 border-r border-[#191b1d]">
      {/* Discord / DÉZCORD Home button (DMs) */}
      <div className="relative group flex items-center justify-center w-full">
        {/* Active Pill Indicator */}
        <div
          className={`absolute left-0 w-1 bg-white rounded-r-full transition-all duration-200 ${
            activeServerId === null
              ? 'h-10'
              : 'h-0 group-hover:h-5'
          }`}
        />
        <button
          onClick={() => onSelectServer(null)}
          title="Mensagens Diretas"
          className={`w-12 h-12 flex items-center justify-center transition-all duration-200 ${
            activeServerId === null
              ? 'bg-[#5865f2] rounded-[16px] text-white shadow-lg'
              : 'bg-[#313338] hover:bg-[#5865f2] rounded-full hover:rounded-[16px] text-[#dbdee1] hover:text-white'
          }`}
        >
          {/* Stylized 'D' Icon for DÉZCORD */}
          <span className="font-extrabold text-xl tracking-tighter">DÉZ</span>
        </button>
      </div>

      {/* Separator */}
      <div className="w-8 h-[2px] bg-[#35363c] rounded-full my-1" />

      {/* Server List */}
      <div className="flex-1 w-full overflow-y-auto flex flex-col items-center gap-2 no-scrollbar">
        {servers.map((server) => {
          const isActive = activeServerId === server.id;
          return (
            <div key={server.id} className="relative group flex items-center justify-center w-full">
              {/* Active Pill Indicator */}
              <div
                className={`absolute left-0 w-1 bg-white rounded-r-full transition-all duration-200 ${
                  isActive ? 'h-10' : 'h-0 group-hover:h-5'
                }`}
              />
              <button
                onClick={() => onSelectServer(server.id)}
                title={server.name}
                className={`w-12 h-12 flex items-center justify-center overflow-hidden transition-all duration-200 ${
                  isActive
                    ? 'rounded-[16px] ring-2 ring-white/20'
                    : 'rounded-full hover:rounded-[16px] bg-[#313338] hover:bg-[#5865f2]'
                }`}
              >
                {server.icon_url ? (
                  <img
                    src={server.icon_url}
                    alt={server.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="font-bold text-white text-sm">
                    {server.name
                      .split(' ')
                      .map((word) => word[0])
                      .join('')
                      .slice(0, 3)
                      .toUpperCase()}
                  </span>
                )}
              </button>
            </div>
          );
        })}

        {/* Add Server Button */}
        <div className="relative group flex items-center justify-center w-full">
          <div className="absolute left-0 w-1 bg-white rounded-r-full h-0 group-hover:h-5 transition-all duration-200" />
          <button
            onClick={onOpenCreateServer}
            title="Adicionar um Servidor/Projeto"
            className="w-12 h-12 rounded-full hover:rounded-[16px] bg-[#313338] hover:bg-[#23a55a] text-[#23a55a] hover:text-white flex items-center justify-center transition-all duration-200"
          >
            <Plus size={24} />
          </button>
        </div>

        {/* Explore Servers */}
        <div className="relative group flex items-center justify-center w-full">
          <div className="absolute left-0 w-1 bg-white rounded-r-full h-0 group-hover:h-5 transition-all duration-200" />
          <button
            title="Explorar Projetos"
            className="w-12 h-12 rounded-full hover:rounded-[16px] bg-[#313338] hover:bg-[#23a55a] text-[#dbdee1] hover:text-white flex items-center justify-center transition-all duration-200"
          >
            <Compass size={22} />
          </button>
        </div>
      </div>

      {/* Bottom Integrations (Supabase & GitHub) */}
      <div className="w-full flex flex-col items-center gap-2 pt-2 border-t border-[#2e3035]">
        {/* Supabase status / config button */}
        <button
          onClick={onOpenSupabaseConfig}
          title={
            isSupabaseConnected
              ? 'Supabase Conectado (Clique para gerenciar)'
              : 'Conectar ao Supabase'
          }
          className={`relative w-11 h-11 rounded-[16px] flex items-center justify-center transition-all duration-200 ${
            isSupabaseConnected
              ? 'bg-[#1c3829] text-[#3ecf8e] border border-[#3ecf8e]/40 hover:bg-[#23a55a] hover:text-white'
              : 'bg-[#313338] text-[#f0b232] hover:bg-[#f0b232] hover:text-black'
          }`}
        >
          <Database size={20} />
          <span
            className={`absolute top-1 right-1 w-2.5 h-2.5 rounded-full border-2 border-[#1e1f22] ${
              isSupabaseConnected ? 'bg-[#23a55a]' : 'bg-[#f0b232]'
            }`}
          />
        </button>

        {/* GitHub link button */}
        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          title="Repositório GitHub"
          className="w-11 h-11 rounded-[16px] bg-[#313338] hover:bg-[#24292e] text-[#dbdee1] hover:text-white flex items-center justify-center transition-all duration-200"
        >
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
          </svg>
        </a>
      </div>
    </div>
  );
};
