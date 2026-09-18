import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_URL_KEY = 'dezcord_supabase_url';
const STORAGE_ANON_KEY = 'dezcord_supabase_anon_key';

export function getStoredSupabaseConfig() {
  const url = localStorage.getItem(STORAGE_URL_KEY) || import.meta.env.VITE_SUPABASE_URL || '';
  const anonKey = localStorage.getItem(STORAGE_ANON_KEY) || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
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
