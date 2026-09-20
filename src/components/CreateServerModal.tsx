import React, { useState } from 'react';
import { X, Upload } from 'lucide-react';

interface CreateServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateServer: (name: string, iconUrl: string) => void;
}

export const CreateServerModal: React.FC<CreateServerModalProps> = ({
  isOpen,
  onClose,
  onCreateServer,
}) => {
  const [serverName, setServerName] = useState('');
  const [iconUrl, setIconUrl] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (serverName.trim()) {
      onCreateServer(
        serverName.trim(),
        iconUrl.trim() ||
          'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80'
      );
      setServerName('');
      setIconUrl('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111214]/75 backdrop-blur-xs p-4">
      <div className="w-full max-w-md bg-[#313338] rounded-md shadow-2xl border border-[#232428] overflow-hidden animate-scale-up">
        {/* Modal Header */}
        <div className="px-6 pt-6 pb-2 text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-[#949ba4] hover:text-white transition"
          >
            <X size={20} />
          </button>
          <h3 className="text-2xl font-bold text-white">Crie seu servidor</h3>
          <p className="text-xs text-[#949ba4] mt-1">
            Seu servidor é onde você e seus amigos passam tempo juntos. Crie o seu e comece a conversar.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            {/* Server Icon Selector */}
            <div className="flex flex-col items-center justify-center">
              <div className="w-20 h-20 rounded-full border-2 border-dashed border-[#5865f2] flex flex-col items-center justify-center cursor-pointer hover:bg-[#2b2d31] transition overflow-hidden relative">
                {iconUrl ? (
                  <img src={iconUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <Upload size={24} className="text-[#5865f2]" />
                    <span className="text-[10px] text-[#949ba4] mt-1 font-semibold uppercase">Ícone</span>
                  </>
                )}
              </div>
            </div>

            {/* Icon URL Input */}
            <div>
              <label className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider">
                URL DO ÍCONE (OPCIONAL)
              </label>
              <input
                type="text"
                placeholder="https://exemplo.com/icone.png"
                value={iconUrl}
                onChange={(e) => setIconUrl(e.target.value)}
                className="w-full bg-[#1e1f22] text-white px-3 py-2 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#5865f2] mt-1"
              />
            </div>

            {/* Server Name Input */}
            <div>
              <label className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider">
                NOME DO SERVIDOR
              </label>
              <input
                type="text"
                required
                placeholder="Servidor do Peppa"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                className="w-full bg-[#1e1f22] text-white px-3 py-2 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#5865f2] mt-1"
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="bg-[#2b2d31] px-6 py-4 flex justify-between items-center">
            <button
              type="button"
              onClick={onClose}
              className="text-white hover:underline text-sm font-medium"
            >
              Voltar
            </button>
            <button
              type="submit"
              disabled={!serverName.trim()}
              className="bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-50 text-white text-sm font-semibold px-6 py-2 rounded transition"
            >
              Criar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
