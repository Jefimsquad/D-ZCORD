import React, { useState } from 'react';
import { Hash, Volume2, X } from 'lucide-react';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, type: 'text' | 'voice') => void;
  defaultType?: 'text' | 'voice';
}

export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  defaultType = 'text',
}) => {
  const [type, setType] = useState<'text' | 'voice'>(defaultType);
  const [channelName, setChannelName] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formatted = channelName.trim().toLowerCase().replace(/\s+/g, '-');
    if (formatted) {
      onCreate(formatted, type);
      setChannelName('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111214]/75 backdrop-blur-xs">
      <div className="w-full max-w-md bg-[#313338] rounded-md shadow-2xl border border-[#232428] overflow-hidden animate-scale-up">
        {/* Modal Header */}
        <div className="px-6 pt-6 pb-2 flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">Criar Canal</h3>
          <button onClick={onClose} className="text-[#949ba4] hover:text-white transition">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            {/* Channel Type Selector */}
            <div>
              <label className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider">
                TIPO DE CANAL
              </label>
              <div className="mt-2 space-y-2">
                {/* Text Channel Option */}
                <div
                  onClick={() => setType('text')}
                  className={`flex items-center gap-3 p-3 rounded-md cursor-pointer transition border ${
                    type === 'text'
                      ? 'bg-[#2b2d31] border-[#5865f2]'
                      : 'bg-[#2b2d31]/50 border-transparent hover:bg-[#35373c]'
                  }`}
                >
                  <Hash size={24} className={type === 'text' ? 'text-white' : 'text-[#949ba4]'} />
                  <div>
                    <div className="text-sm font-semibold text-white">Texto</div>
                    <div className="text-xs text-[#949ba4]">
                      Poste mensagens, imagens, memes e opiniões
                    </div>
                  </div>
                </div>

                {/* Voice Channel Option */}
                <div
                  onClick={() => setType('voice')}
                  className={`flex items-center gap-3 p-3 rounded-md cursor-pointer transition border ${
                    type === 'voice'
                      ? 'bg-[#2b2d31] border-[#5865f2]'
                      : 'bg-[#2b2d31]/50 border-transparent hover:bg-[#35373c]'
                  }`}
                >
                  <Volume2 size={24} className={type === 'voice' ? 'text-[#23a55a]' : 'text-[#949ba4]'} />
                  <div>
                    <div className="text-sm font-semibold text-white">Voz</div>
                    <div className="text-xs text-[#949ba4]">
                      Converse em tempo real por voz, vídeo e tela
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Channel Name Input */}
            <div>
              <label className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider">
                NOME DO CANAL
              </label>
              <div className="relative flex items-center mt-2">
                <span className="absolute left-3 text-[#949ba4]">
                  {type === 'text' ? '#' : '🔊'}
                </span>
                <input
                  type="text"
                  required
                  placeholder="novo-canal"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  className="w-full bg-[#1e1f22] text-white pl-8 pr-3 py-2.5 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#5865f2]"
                />
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="bg-[#2b2d31] px-6 py-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="text-white hover:underline text-sm font-medium px-4 py-2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!channelName.trim()}
              className="bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-50 text-white text-sm font-semibold px-6 py-2 rounded transition"
            >
              Criar Canal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
