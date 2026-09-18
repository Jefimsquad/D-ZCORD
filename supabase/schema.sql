-- ==============================================================================
-- DÉZCORD - Database Schema para Supabase
-- Execute este script no SQL Editor do seu projeto Supabase
-- ==============================================================================

-- 1. Tabela de Perfis de Usuário
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT DEFAULT '',
  status TEXT DEFAULT 'online' CHECK (status IN ('online', 'idle', 'dnd', 'offline')),
  custom_status TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  banner_color TEXT DEFAULT '#5865F2',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabela de Servidores (Guilds)
CREATE TABLE IF NOT EXISTS public.servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon_url TEXT DEFAULT '',
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabela de Membros dos Servidores
CREATE TABLE IF NOT EXISTS public.server_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'moderator', 'member')),
  joined_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(server_id, user_id)
);

-- 4. Tabela de Canais (Texto e Voz)
CREATE TABLE IF NOT EXISTS public.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text', 'voice')),
  category TEXT DEFAULT 'Geral',
  topic TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Tabela de Mensagens
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ
);

-- 6. Tabela de Reações a Mensagens
CREATE TABLE IF NOT EXISTS public.reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(message_id, user_id, emoji)
);

-- 7. Tabela de Mensagens Diretas (DMs)
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- Habilitar Row Level Security (RLS)
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Políticas de Leitura Pública / Membros Autenticados
CREATE POLICY "Leitura de perfis por todos" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Usuários atualizam seus próprios perfis" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Inserção de perfil" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Leitura de servidores" ON public.servers FOR SELECT USING (true);
CREATE POLICY "Criação de servidores por autenticados" ON public.servers FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Leitura de canais" ON public.channels FOR SELECT USING (true);
CREATE POLICY "Criação de canais" ON public.channels FOR INSERT WITH CHECK (true);

CREATE POLICY "Leitura de mensagens" ON public.messages FOR SELECT USING (true);
CREATE POLICY "Inserção de mensagens" ON public.messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Exclusão de mensagens pelo autor" ON public.messages FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Leitura de reações" ON public.reactions FOR SELECT USING (true);
CREATE POLICY "Adição de reações" ON public.reactions FOR INSERT WITH CHECK (true);

-- ==============================================================================
-- Habilitar Realtime
-- ==============================================================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.channels;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.servers;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
