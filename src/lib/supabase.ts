import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_URL_KEY = 'dezcord_supabase_url';
const STORAGE_ANON_KEY = 'dezcord_supabase_anon_key';

export function getStoredSupabaseConfig() {
  const envUrl = ((import.meta as any).env?.VITE_SUPABASE_URL || '').trim();
  const envKey = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '').trim();
  let lsUrl = '';
  let lsKey = '';
  try {
    lsUrl = (localStorage.getItem(STORAGE_URL_KEY) || '').trim();
    lsKey = (localStorage.getItem(STORAGE_ANON_KEY) || '').trim();
  } catch {
    // localStorage indisponível (SSR/privado) — usa só env
  }
  // ENV tem prioridade: corrige caso o navegador tenha valor antigo/inválido salvo
  const url = envUrl || lsUrl;
  const anonKey = envKey || lsKey;
  return { url, anonKey };
}

export function saveSupabaseConfig(url: string, anonKey: string) {
  localStorage.setItem(STORAGE_URL_KEY, url.trim());
  localStorage.setItem(STORAGE_ANON_KEY, anonKey.trim());
  initSupabase();
}

let supabaseInstance: SupabaseClient | null = null;

export function initSupabase(): SupabaseClient | null {
  const { url, anonKey } = getStoredSupabaseConfig();
  if (url && anonKey && url.startsWith('http')) {
    try {
      supabaseInstance = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
      return supabaseInstance;
    } catch (e) {
      console.warn('Erro ao inicializar Supabase:', e);
      supabaseInstance = null;
    }
  }
  supabaseInstance = null;
  return null;
}

export function getSupabase(): SupabaseClient | null {
  if (!supabaseInstance) {
    return initSupabase();
  }
  return supabaseInstance;
}

export async function testSupabaseConnection(url: string, anonKey: string): Promise<{ success: boolean; message: string }> {
  try {
    if (!url || !anonKey) {
      return { success: false, message: 'URL e Anon Key são obrigatórios.' };
    }
    const client = createClient(url.trim(), anonKey.trim());
    const { error } = await client.from('profiles').select('count', { count: 'exact', head: true });

    if (error && error.code !== 'PGRST116' && !error.message.includes('relation "public.profiles" does not exist')) {
      // If table doesn't exist yet, connection is still valid credentials!
      if (error.code === '42P01') {
        return {
          success: true,
          message: 'Conectado com sucesso! (Observação: Execute o script SQL no Supabase para criar as tabelas)'
        };
      }
      return { success: false, message: `Erro ao conectar: ${error.message}` };
    }

    return { success: true, message: 'Conectado com sucesso ao Supabase!' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Falha de conexão com a URL fornecida.' };
  }
}

// ---- Auth real por e-mail (magic link + código OTP) ----

export async function signInWithEmail(email: string): Promise<{ success: boolean; message: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, message: 'Supabase não configurado.' };
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) return { success: false, message: error.message };
  return { success: true, message: 'Link e código enviados para o e-mail!' };
}

export async function verifyEmailCode(email: string, token: string): Promise<{ success: boolean; message: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, message: 'Supabase não configurado.' };
  const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'email' });
  if (error) return { success: false, message: error.message };
  return { success: true, message: 'Login confirmado!' };
}

export async function signOut(): Promise<void> {
  const supabase = getSupabase();
  if (supabase) await supabase.auth.signOut();
}

export async function signUpWithPassword(
  email: string,
  password: string,
  opts?: { displayName?: string; avatarUrl?: string }
): Promise<{ success: boolean; message: string; needsConfirm?: boolean }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, message: 'Supabase não configurado.' };
  const displayName = opts?.displayName?.trim();
  const avatarUrl = opts?.avatarUrl?.trim();
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) return { success: false, message: error.message };
  if (data.session?.user) {
    await ensureProfile(data.session.user.id, email.trim(), displayName || undefined, avatarUrl || undefined);
    if (displayName || avatarUrl) {
      await supabase.from('profiles').update({
        ...(displayName ? { display_name: displayName } : {}),
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      }).eq('id', data.session.user.id);
    }
    return { success: true, message: 'Conta criada e logada!' };
  }
  // Sem sessão (confirmação de e-mail ativa): já deixa o perfil com nickname/foto escolhidos
  if (data.user?.id) {
    const base = email.trim().split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_') || 'usuario';
    await supabase.from('profiles').upsert(
      {
        id: data.user.id,
        username: base,
        display_name: displayName || base,
        avatar_url: avatarUrl || '',
        status: 'online',
        email: email.trim(),
      },
      { onConflict: 'id' }
    );
  }
  return { success: true, needsConfirm: true, message: 'Conta criada! Confirme no e-mail e depois entre.' };
}

export async function signInWithPassword(email: string, password: string): Promise<{ success: boolean; message: string; needsConfirm?: boolean }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, message: 'Supabase não configurado.' };
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) return { success: false, message: error.message };
  if (data.session?.user?.id && data.session.user.email) {
    await ensureProfile(data.session.user.id, data.session.user.email);
  }
  return { success: true, message: 'Bem-vindo ao DÉZCORD!' };
}

export async function ensureProfile(authId: string, email: string, displayName?: string, avatarUrl?: string) {
  const supabase = getSupabase();
  if (!supabase) return null;
  const base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_') || 'usuario';
  const { data: existing } = await supabase.from('profiles').select('*').eq('id', authId).maybeSingle();
  if (existing) {
    // Garante que o e-mail fique salvo mesmo em perfis antigos
    if (!(existing as any).email) {
      await supabase.from('profiles').update({ email }).eq('id', authId);
    }
    return existing;
  }
  // Tenta inserir; se username colidir, adiciona sufixo
  for (let attempt = 0; attempt < 3; attempt++) {
    const uname = attempt === 0 ? base : `${base}_${Math.random().toString(36).slice(2, 6)}`;
    const payload = {
      id: authId,
      username: uname,
      display_name: displayName || uname,
      avatar_url: avatarUrl || '',
      status: 'online',
      email,
    };
    const { data, error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' }).select().maybeSingle();
    if (!error) return data || payload;
    if (!error.message.includes('duplicate') && (error as any).code !== '23505') return null;
  }
  return null;
}

export async function syncProfileToSupabase(profile: {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  status?: string;
  custom_status?: string;
  bio?: string;
  banner_color?: string;
  email?: string;
}): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || !profile.id) return false;
  // Não sincroniza usuário mock local sem Auth (ex: 'usr_me')
  const { data } = await supabase.auth.getUser();
  if (!data.user?.id || data.user.id !== profile.id) return false;
  const { error } = await supabase.from('profiles').upsert(
    {
      id: profile.id,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url || '',
      status: profile.status || 'online',
      custom_status: profile.custom_status || '',
      bio: profile.bio || '',
      banner_color: profile.banner_color || '#5865F2',
      email: profile.email || data.user.email || '',
    },
    { onConflict: 'id' }
  );
  if (error) {
    // Username único: tenta com sufixo em vez de perder a alteração
    if (error.message.includes('duplicate') || (error as any).code === '23505') {
      const retry = await supabase.from('profiles').upsert(
        {
          id: profile.id,
          username: `${profile.username}_${Math.random().toString(36).slice(2, 6)}`,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url || '',
          status: profile.status || 'online',
          custom_status: profile.custom_status || '',
          bio: profile.bio || '',
          banner_color: profile.banner_color || '#5865F2',
          email: profile.email || data.user.email || '',
        },
        { onConflict: 'id' }
      );
      if (retry.error) {
        console.warn('Falha ao sincronizar perfil:', retry.error.message);
        return false;
      }
      return true;
    }
    console.warn('Falha ao sincronizar perfil:', error.message);
    return false;
  }
  return true;
}

// Busca mensagens persistidas de um canal (para não depender só do localStorage)
export async function fetchChannelMessages(channelId: string) {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('channel_id', channelId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) {
    console.warn('Falha ao carregar mensagens:', error.message);
    return [];
  }
  return (data as any[]) || [];
}
