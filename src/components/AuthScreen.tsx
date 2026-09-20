import { useState, useRef } from 'react';
import { Mail, Lock, Eye, EyeOff, LogIn, UserPlus, User, Check, Upload } from 'lucide-react';
import { signInWithPassword, signUpWithPassword } from '../lib/supabase';

interface AuthScreenProps {
  onAuth: () => void;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
];

interface AuthScreenProps {
  onAuth: () => void;
}

export const AuthScreen = ({ onAuth }: AuthScreenProps) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(PRESET_AVATARS[0]);
  const [avatarError, setAvatarError] = useState('');
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState('');

  const handleAvatarUpload = (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAvatarError('Escolha um arquivo de imagem.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('Imagem até 2MB.');
      return;
    }
    setAvatarError('');
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(reader.result as string);
    reader.onerror = () => setAvatarError('Falha ao ler a imagem.');
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || password.length < 6) {
      setFeedback('Use um e-mail válido e senha com 6+ caracteres.');
      return;
    }
    if (mode === 'register' && !nickname.trim()) {
      setFeedback('Escolha seu nickname.');
      return;
    }
    setLoading(true);
    setFeedback('');
    const res = mode === 'login'
      ? await signInWithPassword(email, password)
      : await signUpWithPassword(email, password, { displayName: nickname, avatarUrl });
    setLoading(false);
    setFeedback(res.message);
    if (res.success && !res.needsConfirm) {
      onAuth();
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#1e1f22] p-4">
      <div className="w-full max-w-sm bg-[#313338] rounded-xl border border-[#232428] shadow-2xl overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-[#5865f2] to-[#4752c4] flex items-center justify-center">
          <span className="text-white text-2xl font-bold tracking-wide">DÉZCORD</span>
        </div>
        <div className="p-6">
          <h2 className="text-white text-lg font-bold text-center">
            {mode === 'login' ? 'Entrar no DÉZCORD' : 'Criar sua conta'}
          </h2>
          <p className="text-xs text-[#949ba4] text-center mt-1 mb-4">
            Login obrigatório por e-mail e senha. A sessão fica salva.
          </p>

          <div className="flex bg-[#1e1f22] rounded p-0.5 text-xs mb-4">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-1.5 rounded transition ${mode === 'login' ? 'bg-[#35373c] text-white font-semibold' : 'text-[#949ba4] hover:text-white'}`}
            >
              Entrar
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 py-1.5 rounded transition ${mode === 'register' ? 'bg-[#35373c] text-white font-semibold' : 'text-[#949ba4] hover:text-white'}`}
            >
              Criar conta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-2.5 text-[#949ba4]" />
                  <input
                    type="text"
                    required
                    placeholder="Seu nickname (ex: Pedro Dev)"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="w-full bg-[#1e1f22] text-white pl-9 pr-3 py-2 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#5865f2]"
                  />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-[#b5bac1] uppercase mb-1.5">
                    Escolha sua foto
                  </div>
                  <div className="flex items-center gap-3">
                    <img
                      src={avatarUrl}
                      alt="Prévia"
                      className="w-12 h-12 rounded-full object-cover border-2 border-[#5865f2] shrink-0 bg-[#1e1f22]"
                    />
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="flex items-center gap-1.5 bg-[#2b2d31] hover:bg-[#35373c] text-white text-xs font-semibold px-3 py-2 rounded transition shrink-0"
                    >
                      <Upload size={14} />
                      <span>Enviar foto</span>
                    </button>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleAvatarUpload(e.target.files)}
                    />
                  </div>
                  {avatarError && <p className="text-[11px] text-[#f23f43] mt-1">{avatarError}</p>}
                  <div className="flex items-center gap-2 overflow-x-auto py-1 mt-1.5">
                    {PRESET_AVATARS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setAvatarUrl(preset)}
                        className={`relative w-10 h-10 rounded-full overflow-hidden shrink-0 border-2 transition ${
                          avatarUrl === preset ? 'border-[#5865f2] scale-110' : 'border-transparent hover:opacity-80'
                        }`}
                      >
                        <img src={preset} alt={`Avatar ${idx}`} className="w-full h-full object-cover" />
                        {avatarUrl === preset && (
                          <div className="absolute inset-0 bg-[#5865f2]/40 flex items-center justify-center">
                            <Check size={14} className="text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    placeholder="Ou cole a URL da sua foto (opcional)"
                    value={avatarUrl.startsWith('http') && !PRESET_AVATARS.includes(avatarUrl) ? avatarUrl : ''}
                    onChange={(e) => setAvatarUrl(e.target.value.trim() || PRESET_AVATARS[0])}
                    className="w-full bg-[#1e1f22] text-white px-3 py-1.5 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#5865f2] mt-1.5 font-mono placeholder-[#949ba4]"
                  />
                </div>
              </>
            )}
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-2.5 text-[#949ba4]" />
              <input
                type="email"
                required
                placeholder="voce@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#1e1f22] text-white pl-9 pr-3 py-2 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#5865f2]"
              />
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-2.5 text-[#949ba4]" />
              <input
                type={showPass ? 'text' : 'password'}
                required
                minLength={6}
                placeholder="Senha (6+ caracteres)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#1e1f22] text-white pl-9 pr-10 py-2 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#5865f2]"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-2 top-2 text-[#949ba4] hover:text-white"
                title={showPass ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded transition flex items-center justify-center gap-2"
            >
              {mode === 'login' ? <LogIn size={16} /> : <UserPlus size={16} />}
              <span>{loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta e entrar'}</span>
            </button>
          </form>

          {feedback && <p className="text-xs text-[#dbdee1] mt-3 text-center">{feedback}</p>}
        </div>
      </div>
    </div>
  );
};
