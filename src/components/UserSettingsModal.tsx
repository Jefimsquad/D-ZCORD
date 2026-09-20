import { useState, useEffect, useRef } from 'react';
import type { UserProfile } from '../types';
import {
  getStoredSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection,
  getSupabase,
  syncProfileToSupabase
} from '../lib/supabase';
import {
  X,
  User,
  Database,
  Mic,
  CheckCircle2,
  AlertCircle,
  Copy,
  Camera,
  Trash2,
} from 'lucide-react';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onUpdateUser: (updated: Partial<UserProfile>) => void;
  onSupabaseStatusChange: (connected: boolean) => void;
}

type TabType = 'account' | 'supabase' | 'github' | 'voice';

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateUser,
  onSupabaseStatusChange,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('account');
  const [displayName, setDisplayName] = useState(currentUser.display_name);
  const [customStatus, setCustomStatus] = useState(currentUser.custom_status || '');
  const [bio, setBio] = useState(currentUser.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatar_url);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarFeedback, setAvatarFeedback] = useState('');
  const [accountFeedback, setAccountFeedback] = useState('');
  const [accountSaving, setAccountSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  // Supabase state
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [testingSupabase, setTestingSupabase] = useState(false);
  const [supabaseTestResult, setSupabaseTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // GitHub state
  const [gitRepoUrl, setGitRepoUrl] = useState(
    localStorage.getItem('dezcord_github_repo') || ''
  );
  const [copiedCode, setCopiedCode] = useState(false);

  // Microphone audio meter state
  const [micVolume, setMicVolume] = useState(0);
  const [isTestingMic, setIsTestingMic] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    const config = getStoredSupabaseConfig();
    setSupabaseUrl(config.url);
    setSupabaseAnonKey(config.anonKey);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setDisplayName(currentUser.display_name);
      setCustomStatus(currentUser.custom_status || '');
      setBio(currentUser.bio || '');
      setAvatarUrl(currentUser.avatar_url);
      setAvatarFeedback('');
    }
  }, [isOpen]);

  // Mic test logic
  useEffect(() => {
    if (isTestingMic) {
      navigator.mediaDevices
        ?.getUserMedia({ audio: true })
        .then((stream) => {
          micStreamRef.current = stream;
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          audioContextRef.current = ctx;
          const analyser = ctx.createAnalyser();
          const source = ctx.createMediaStreamSource(stream);
          source.connect(analyser);
          analyser.fftSize = 256;
          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);

          const updateVolume = () => {
            analyser.getByteFrequencyData(dataArray);
            let total = 0;
            for (let i = 0; i < bufferLength; i++) {
              total += dataArray[i];
            }
            const avg = total / bufferLength;
            setMicVolume(Math.min(100, Math.round((avg / 128) * 100)));
            animFrameRef.current = requestAnimationFrame(updateVolume);
          };
          updateVolume();
        })
        .catch(() => {
          setIsTestingMic(false);
        });
    } else {
      cancelAnimationFrame(animFrameRef.current);
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioContextRef.current?.close();
      setMicVolume(0);
    }

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioContextRef.current?.close();
    };
  }, [isTestingMic]);

  if (!isOpen) return null;

  const handleSaveAccount = async () => {
    const updated = {
      display_name: displayName,
      custom_status: customStatus,
      bio,
      avatar_url: avatarUrl,
    };
    onUpdateUser(updated);
    setAccountSaving(true);
    setAccountFeedback('');
    try {
      const ok = await syncProfileToSupabase({ ...currentUser, ...updated });
      setAccountFeedback(ok ? 'Perfil salvo permanentemente!' : 'Salvo localmente. Verifique login e conexão Supabase.');
    } catch {
      setAccountFeedback('Salvo localmente. Falha ao sincronizar.');
    } finally {
      setAccountSaving(false);
    }
  };

  const persistAvatar = async (url: string) => {
    onUpdateUser({ avatar_url: url });
    const supabase = getSupabase();
    if (!supabase) return;
    const { data } = await supabase.auth.getUser();
    const authId = data.user?.id;
    if (!authId) return;
    // UPDATE primeiro (preserva username/display_name NOT NULL); upsert completo se não existir
    const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', authId);
    if (error) {
      await syncProfileToSupabase({ ...currentUser, avatar_url: url, id: authId });
    }
  };

  const handleAvatarFile = (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAvatarFeedback('Escolha um arquivo de imagem.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarFeedback('Imagem até 2MB.');
      return;
    }
    setAvatarUploading(true);
    setAvatarFeedback('');
    const reader = new FileReader();
    reader.onload = async () => {
      const url = reader.result as string;
      setAvatarUrl(url);
      await persistAvatar(url);
      setAvatarUploading(false);
      setAvatarFeedback('Foto atualizada!');
    };
    reader.onerror = () => {
      setAvatarUploading(false);
      setAvatarFeedback('Falha ao ler a imagem.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = async () => {
    setAvatarUrl('');
    await persistAvatar('');
    setAvatarFeedback('Foto removida.');
  };

  const handleTestSupabase = async () => {
    setTestingSupabase(true);
    setSupabaseTestResult(null);
    const result = await testSupabaseConnection(supabaseUrl, supabaseAnonKey);
    setTestingSupabase(false);
    setSupabaseTestResult(result);
    if (result.success) {
      saveSupabaseConfig(supabaseUrl, supabaseAnonKey);
      onSupabaseStatusChange(true);
    }
  };

  const handleSaveSupabase = () => {
    saveSupabaseConfig(supabaseUrl, supabaseAnonKey);
    handleTestSupabase();
  };

  const handleSaveGitRepo = () => {
    localStorage.setItem('dezcord_github_repo', gitRepoUrl.trim());
  };

  const gitCommands = `# 1. No seu repositório local do DÉZCORD:
git add .
git commit -m "feat: DÉZCORD clone com React, Supabase e WebRTC"

# 2. Conecte ao seu repositório remoto no GitHub:
git remote add origin ${gitRepoUrl || 'https://github.com/SEU-USUARIO/dezcord.git'}
git branch -M main
git push -u origin main`;

  const copyGitCommands = () => {
    navigator.clipboard.writeText(gitCommands);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-[#111214]/80 backdrop-blur-sm animate-fade-in p-2 sm:p-4">
      <div className="flex flex-col md:flex-row w-full h-full max-w-5xl mx-auto my-auto max-h-[850px] bg-[#313338] rounded-xl overflow-hidden shadow-2xl border border-[#232428]">
        {/* Left Settings Navigation */}
        <div className="w-full md:w-60 shrink-0 bg-[#2b2d31] p-2 md:p-6 flex flex-row md:flex-col gap-1 md:gap-0 md:justify-between border-b md:border-b-0 md:border-r border-[#1f2023] select-none overflow-x-auto">
          <div className="flex flex-row md:flex-col gap-1 md:space-y-4 items-center md:items-stretch">
            <div className="shrink-0">
              <div className="hidden md:block text-[11px] font-bold text-[#949ba4] tracking-wider uppercase px-2 mb-2">
                CONFIGURAÇÕES DE USUÁRIO
              </div>
              <button
                onClick={() => setActiveTab('account')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition whitespace-nowrap ${
                  activeTab === 'account'
                    ? 'bg-[#404249] text-white'
                    : 'text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1]'
                }`}
              >
                <User size={18} />
                <span>Minha Conta</span>
              </button>
            </div>

            <div className="shrink-0">
              <div className="hidden md:block text-[11px] font-bold text-[#949ba4] tracking-wider uppercase px-2 mb-2">
                INTEGRAÇÕES PRINCIPAIS
              </div>
              <button
                onClick={() => setActiveTab('supabase')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition whitespace-nowrap ${
                  activeTab === 'supabase'
                    ? 'bg-[#1c3829] text-[#3ecf8e]'
                    : 'text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1]'
                }`}
              >
                <Database size={18} />
                <span>Supabase</span>
              </button>

              <button
                onClick={() => setActiveTab('github')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition whitespace-nowrap mt-1 ${
                  activeTab === 'github'
                    ? 'bg-[#404249] text-white'
                    : 'text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1]'
                }`}
              >
                <svg className="w-[18px] h-[18px] fill-current" viewBox="0 0 24 24">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
                <span>GitHub</span>
              </button>
            </div>

            <div className="shrink-0">
              <div className="hidden md:block text-[11px] font-bold text-[#949ba4] tracking-wider uppercase px-2 mb-2">
                APLICATIVO & ÁUDIO
              </div>
              <button
                onClick={() => setActiveTab('voice')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition whitespace-nowrap ${
                  activeTab === 'voice'
                    ? 'bg-[#404249] text-white'
                    : 'text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1]'
                }`}
              >
                <Mic size={18} />
                <span>Voz e Vídeo</span>
              </button>
            </div>
          </div>

          <div className="hidden md:block text-xs text-[#949ba4] px-2">
            DÉZCORD v1.0.0 Alpha
          </div>
        </div>

        {/* Right Settings Content */}
        <div className="flex-1 min-h-0 p-4 md:p-8 overflow-y-auto relative flex flex-col justify-between">
          {/* Close Button (Discord Style ESC) */}
          <button
            onClick={onClose}
            className="absolute top-6 right-8 flex flex-col items-center group text-[#949ba4] hover:text-white"
          >
            <div className="w-9 h-9 rounded-full border-2 border-[#949ba4] group-hover:border-white flex items-center justify-center transition">
              <X size={20} />
            </div>
            <span className="text-[10px] font-bold mt-1 uppercase tracking-wider">ESC</span>
          </button>

          {/* TAB: MINHA CONTA */}
          {activeTab === 'account' && (
            <div className="max-w-xl space-y-6">
              <h2 className="text-xl font-bold text-white">Minha Conta</h2>

              {/* Profile Card Banner Preview */}
              <div className="bg-[#1e1f22] rounded-lg overflow-hidden border border-[#2b2d31]">
                <div className="h-24 bg-gradient-to-r from-[#5865f2] to-[#7983f5]" />
                <div className="px-5 pb-5 -mt-10 flex items-end justify-between">
                  <div className="relative group">
                    <img
                      src={avatarUrl}
                      alt={currentUser.username}
                      className="w-20 h-20 rounded-full border-4 border-[#1e1f22] object-cover bg-[#2b2d31]"
                    />
                    <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-[#1e1f22] bg-[#23a55a]" />
                    <button
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={avatarUploading}
                      title="Trocar foto de perfil"
                      className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[10px] font-semibold gap-1 transition disabled:opacity-50"
                    >
                      <Camera size={18} />
                      <span>{avatarUploading ? 'Enviando...' : 'Trocar foto'}</span>
                    </button>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleAvatarFile(e.target.files)}
                    />
                  </div>
                  {avatarUrl && (
                    <button
                      onClick={handleRemoveAvatar}
                      title="Remover foto"
                      className="flex items-center gap-1 text-xs text-[#949ba4] hover:text-[#f23f43] transition"
                    >
                      <Trash2 size={14} />
                      <span>Remover</span>
                    </button>
                  )}
                </div>

                {avatarFeedback && (
                  <div className="px-5 -mt-2">
                    <p className="text-xs text-[#949ba4]">{avatarFeedback}</p>
                  </div>
                )}

                <div className="px-5 pb-5 space-y-4">
                  <div>
                    <label className="text-xs font-bold text-[#b5bac1] uppercase">URL da foto (opcional)</label>
                    <input
                      type="text"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      onBlur={() => persistAvatar(avatarUrl)}
                      placeholder="https://exemplo.com/foto.jpg ou suba pelo botão"
                      className="w-full bg-[#1e1f22] border border-[#3f4147] rounded p-2 text-xs text-white focus:outline-none focus:border-[#5865f2] mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#b5bac1] uppercase">Nome de Exibição</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full bg-[#1e1f22] border border-[#3f4147] rounded p-2 text-sm text-white focus:outline-none focus:border-[#5865f2] mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#b5bac1] uppercase">Status Personalizado</label>
                    <input
                      type="text"
                      value={customStatus}
                      onChange={(e) => setCustomStatus(e.target.value)}
                      placeholder="O que está acontecendo?"
                      className="w-full bg-[#1e1f22] border border-[#3f4147] rounded p-2 text-sm text-white focus:outline-none focus:border-[#5865f2] mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#b5bac1] uppercase">Sobre Mim (Bio)</label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={3}
                      className="w-full bg-[#1e1f22] border border-[#3f4147] rounded p-2 text-sm text-white focus:outline-none focus:border-[#5865f2] mt-1 resize-none"
                    />
                  </div>

                  <button
                    onClick={handleSaveAccount}
                    disabled={accountSaving}
                    className="bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-50 text-white px-5 py-2 rounded text-sm font-semibold transition"
                  >
                    {accountSaving ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                  {accountFeedback && (
                    <p className="text-xs text-[#949ba4]">{accountFeedback}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: SUPABASE */}
          {activeTab === 'supabase' && (
            <div className="max-w-xl space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>Conexão Supabase</span>
                  <span className="text-xs font-normal bg-[#1c3829] text-[#3ecf8e] px-2 py-0.5 rounded border border-[#3ecf8e]/30">
                    PostgreSQL & Realtime
                  </span>
                </h2>
                <p className="text-xs text-[#949ba4] mt-1">
                  Insira as credenciais do seu projeto Supabase para habilitar mensagens persistentes em tempo real.
                </p>
              </div>

              <div className="space-y-4 bg-[#2b2d31] p-5 rounded-lg border border-[#3f4147]">
                <div>
                  <label className="text-xs font-bold text-[#b5bac1] uppercase">Project URL</label>
                  <input
                    type="text"
                    placeholder="https://xyzcompany.supabase.co"
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    className="w-full bg-[#1e1f22] border border-[#3f4147] rounded p-2.5 text-sm text-white focus:outline-none focus:border-[#23a55a] mt-1 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#b5bac1] uppercase">Project Anon Key</label>
                  <input
                    type="password"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    value={supabaseAnonKey}
                    onChange={(e) => setSupabaseAnonKey(e.target.value)}
                    className="w-full bg-[#1e1f22] border border-[#3f4147] rounded p-2.5 text-sm text-white focus:outline-none focus:border-[#23a55a] mt-1 font-mono"
                  />
                </div>

                {supabaseTestResult && (
                  <div
                    className={`p-3 rounded text-xs flex items-start gap-2 ${
                      supabaseTestResult.success
                        ? 'bg-[#1c3829] text-[#3ecf8e] border border-[#3ecf8e]/30'
                        : 'bg-[#3b1d22] text-[#f23f43] border border-[#f23f43]/30'
                    }`}
                  >
                    {supabaseTestResult.success ? (
                      <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    )}
                    <span>{supabaseTestResult.message}</span>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleTestSupabase}
                    disabled={testingSupabase}
                    className="bg-[#23a55a] hover:bg-[#1f9350] text-white px-4 py-2 rounded text-sm font-semibold transition disabled:opacity-50"
                  >
                    {testingSupabase ? 'Testando...' : 'Testar e Conectar'}
                  </button>
                  <button
                    onClick={handleSaveSupabase}
                    className="bg-[#35373c] hover:bg-[#404249] text-white px-4 py-2 rounded text-sm font-semibold transition"
                  >
                    Salvar
                  </button>
                </div>
              </div>

              {/* Step by step instructions for SQL script */}
              <div className="bg-[#1e1f22] p-4 rounded-lg border border-[#2b2d31] text-xs text-[#949ba4] space-y-2">
                <div className="font-semibold text-white">💡 Passo a Passo do Banco de Dados:</div>
                <p>
                  1. Abra seu painel no Supabase e vá em <strong>SQL Editor</strong>.
                </p>
                <p>
                  2. O arquivo com o esquema completo foi criado na pasta <code className="text-[#3ecf8e]">supabase/schema.sql</code>.
                </p>
                <p>
                  3. Copie o conteúdo de <code className="text-[#3ecf8e]">supabase/schema.sql</code> e execute no editor para criar todas as tabelas e habilitar o Realtime!
                </p>
              </div>
            </div>
          )}

          {/* TAB: GITHUB */}
          {activeTab === 'github' && (
            <div className="max-w-xl space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>Conexão GitHub</span>
                  <span className="text-xs font-normal bg-[#24292e] text-white px-2 py-0.5 rounded border border-white/20">
                    Git Repo
                  </span>
                </h2>
                <p className="text-xs text-[#949ba4] mt-1">
                  O repositório Git local já foi inicializado com sucesso na branch <code className="text-white">main</code>.
                </p>
              </div>

              <div className="space-y-4 bg-[#2b2d31] p-5 rounded-lg border border-[#3f4147]">
                <div>
                  <label className="text-xs font-bold text-[#b5bac1] uppercase">URL do Repositório Remoto no GitHub</label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="text"
                      placeholder="https://github.com/seu-usuario/dezcord.git"
                      value={gitRepoUrl}
                      onChange={(e) => setGitRepoUrl(e.target.value)}
                      className="flex-1 bg-[#1e1f22] border border-[#3f4147] rounded p-2.5 text-sm text-white focus:outline-none focus:border-[#5865f2] font-mono"
                    />
                    <button
                      onClick={handleSaveGitRepo}
                      className="bg-[#5865f2] hover:bg-[#4752c4] text-white px-4 py-2 rounded text-xs font-semibold"
                    >
                      Salvar URL
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-[#b5bac1] uppercase">Comandos para subir ao GitHub</label>
                    <button
                      onClick={copyGitCommands}
                      className="text-xs text-[#5865f2] hover:underline flex items-center gap-1"
                    >
                      <Copy size={12} />
                      <span>{copiedCode ? 'Copiado!' : 'Copiar Comandos'}</span>
                    </button>
                  </div>

                  <pre className="bg-[#1e1f22] p-3 rounded font-mono text-xs text-[#dbdee1] overflow-x-auto border border-[#1f2023]">
                    {gitCommands}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB: VOZ E VÍDEO */}
          {activeTab === 'voice' && (
            <div className="max-w-xl space-y-6">
              <h2 className="text-xl font-bold text-white">Configurações de Voz e Vídeo</h2>

              <div className="bg-[#2b2d31] p-5 rounded-lg border border-[#3f4147] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">Teste do Microfone</div>
                    <div className="text-xs text-[#949ba4]">Fale para testar a sensibilidade do seu microfone.</div>
                  </div>
                  <button
                    onClick={() => setIsTestingMic(!isTestingMic)}
                    className={`px-4 py-2 rounded text-xs font-semibold transition ${
                      isTestingMic
                        ? 'bg-[#f23f43] text-white'
                        : 'bg-[#5865f2] hover:bg-[#4752c4] text-white'
                    }`}
                  >
                    {isTestingMic ? 'Parar Teste' : 'Testar Mic'}
                  </button>
                </div>

                {/* Live Mic Volume Meter */}
                <div>
                  <div className="flex justify-between text-xs text-[#949ba4] mb-1">
                    <span>Nível de Entrada</span>
                    <span>{micVolume}%</span>
                  </div>
                  <div className="h-3 bg-[#1e1f22] rounded-full overflow-hidden p-0.5 border border-[#1f2023]">
                    <div
                      className="h-full bg-gradient-to-r from-[#23a55a] via-[#f0b232] to-[#f23f43] rounded-full transition-all duration-75"
                      style={{ width: `${micVolume}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
