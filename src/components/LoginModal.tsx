import { useState } from 'react';
import type { UserProfile } from '../types';
import { User, Sparkles, Check, Mail, LogOut } from 'lucide-react';
import { getSupabase, signInWithEmail, verifyEmailCode, signOut, ensureProfile } from '../lib/supabase';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onSaveUser: (updatedUser: UserProfile) => void;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
];

export const LoginModal = ({
  isOpen,
  onClose,
  currentUser,
  onSaveUser,
}: LoginModalProps) => {
  const [email, setEmail] = useState(currentUser.email || '');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [displayName, setDisplayName] = useState(currentUser.display_name);
  const [username, setUsername] = useState(currentUser.username);
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatar_url);
  const [customStatus, setCustomStatus] = useState(currentUser.custom_status || '');

  if (!isOpen) return null;

  const finishLogin = async (authEmail: string) => {
    const supabase = getSupabase();
    const { data } = supabase ? await supabase.auth.getUser() : { data: null as any };
    const authId = data?.user?.id;
    if (!authId) {
      setFeedback('Sessão ainda não confirmada. Clique no link do e-mail ou digite o código.');
      return;
    }
    const profile: any = await ensureProfile(authId, authEmail, displayName.trim() || undefined);
    onSaveUser({
      ...currentUser,
      id: authId,
      email: authEmail,
      username: profile?.username || username,
      display_name: profile?.display_name || displayName.trim() || 'usuario',
      avatar_url: avatarUrl || profile?.avatar_url || PRESET_AVATARS[0],
      custom_status: customStatus.trim(),
    });
    setFeedback('Logado com e-mail!');
    onClose();
  };

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback('');
    const res = await signInWithEmail(email);
    setLoading(false);
    setFeedback(res.message);
    if (res.success) setStep('code');
  };

  const handleVerify = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    setFeedback('');
    const res = await verifyEmailCode(email, code);
    setLoading(false);
    if (!res.success) {
      setFeedback(res.message);
      return;
    }
    await finishLogin(email.trim());
  };

  const handleLogout = async () => {
    await signOut();
    setStep('email');
    setCode('');
    setFeedback('Deslogado.');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (displayName.trim()) {
      onSaveUser({
        ...currentUser,
        display_name: displayName.trim(),
        username: username.trim().toLowerCase().replace(/\s+/g, '_') || 'usuario',
        avatar_url: avatarUrl.trim() || PRESET_AVATARS[0],
        custom_status: customStatus.trim(),
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111214]/80 backdrop-blur-xs">
      <div className="w-full max-w-md bg-[#313338] rounded-xl shadow-2xl border border-[#232428] overflow-hidden animate-scale-up">
        <div className="h-20 bg-gradient-to-r from-[#5865f2] to-[#4752c4] relative flex items-end justify-center">
          <div className="absolute -bottom-8">
            <div className="relative">
              <img
                src={avatarUrl}
                alt="Avatar"
                className="w-20 h-20 rounded-full border-4 border-[#313338] object-cover bg-[#1e1f22]"
              />
              <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-[#313338] bg-[#23a55a]" />
            </div>
          </div>
        </div>

        <div className="pt-10 px-6 pb-6">
          <div className="text-center mb-4">
            <h3 className="text-xl font-bold text-white flex items-center justify-center gap-1.5">
              <span>Entrar no DÉZCORD</span>
              <Sparkles size={18} className="text-[#f0b232]" />
            </h3>
            <p className="text-xs text-[#949ba4] mt-0.5">
              Login real por e-mail via Supabase. Sem senha.
            </p>
          </div>

          <form onSubmit={handleSendLink} className="space-y-3 bg-[#2b2d31] p-3 rounded-lg border border-[#3f4147]">
            <label className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider flex items-center gap-1">
              <Mail size={14} /> E-mail
            </label>
            <input
              type="email"
              required
              placeholder="voce@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#1e1f22] text-white px-3 py-2 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#5865f2]"
            />
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-50 text-white text-xs font-semibold py-2.5 rounded transition"
            >
              {loading ? 'Enviando...' : step === 'code' ? 'Reenviar link / código' : 'Enviar link de login'}
            </button>

            {step === 'code' && (
              <div className="space-y-2 pt-1">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Código de 6 dígitos do e-mail"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full bg-[#1e1f22] text-white px-3 py-2 rounded text-sm tracking-widest text-center focus:outline-none focus:ring-1 focus:ring-[#23a55a]"
                />
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={loading || !code.trim()}
                  className="w-full bg-[#23a55a] hover:bg-[#1f9350] disabled:opacity-50 text-white text-xs font-semibold py-2 rounded transition"
                >
                  Confirmar código
                </button>
              </div>
            )}

            {feedback && <p className="text-xs text-[#dbdee1]">{feedback}</p>}
            <button type="button" onClick={handleLogout} className="flex items-center gap-1 text-xs text-[#949ba4] hover:text-white">
              <LogOut size={14} /> Sair da conta
            </button>
          </form>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <label className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider">
                NOME DE EXIBIÇÃO
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Pedro Dev"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-[#1e1f22] text-white px-3 py-2 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#5865f2] mt-1"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider">
                NOME DE USUÁRIO (@TAG)
              </label>
              <div className="relative flex items-center mt-1">
                <span className="absolute left-3 text-xs text-[#949ba4]">@</span>
                <input
                  type="text"
                  placeholder="pedro_dev"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-[#1e1f22] text-white pl-7 pr-3 py-2 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#5865f2]"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider">
                STATUS PERSONALIZADO
              </label>
              <input
                type="text"
                placeholder="Ex: Trabalhando no DÉZCORD ⚡"
                value={customStatus}
                onChange={(e) => setCustomStatus(e.target.value)}
                className="w-full bg-[#1e1f22] text-white px-3 py-2 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#5865f2] mt-1"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider">
                ESCOLHER AVATAR
              </label>
              <div className="flex items-center gap-2 mt-1.5 overflow-x-auto py-1">
                {PRESET_AVATARS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAvatarUrl(preset)}
                    className={`relative w-10 h-10 rounded-full overflow-hidden shrink-0 border-2 transition ${
                      avatarUrl === preset ? 'border-[#5865f2] scale-110' : 'border-transparent hover:opacity-80'
                    }`}
                  >
                    <img src={preset} alt={`Preset ${idx}`} className="w-full h-full object-cover" />
                    {avatarUrl === preset && (
                      <div className="absolute inset-0 bg-[#5865f2]/40 flex items-center justify-center">
                        <Check size={14} className="text-white font-bold" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider">
                OU URL DE IMAGEM PERSONALIZADA
              </label>
              <input
                type="text"
                placeholder="https://exemplo.com/avatar.jpg"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className="w-full bg-[#1e1f22] text-white px-3 py-1.5 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#5865f2] mt-1 font-mono text-[#949ba4]"
              />
            </div>

            <div className="pt-3 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-[#2b2d31] hover:bg-[#35373c] text-white text-xs font-semibold py-2.5 rounded transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!displayName.trim()}
                className="flex-1 bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-50 text-white text-xs font-semibold py-2.5 rounded transition shadow flex items-center justify-center gap-1.5"
              >
                <User size={16} />
                <span>Salvar & Entrar</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
