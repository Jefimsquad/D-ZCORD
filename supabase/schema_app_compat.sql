-- DÉZCORD - Schema compatível com o app (modo simples, IDs texto)
-- Execute este script no Supabase > SQL Editor > New query > Run
-- Projeto: https://puwdemnfakdlhrdbbiva.supabase.co

-- 1. Perfis (id TEXT para aceitar 'usr_me', etc.)
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT DEFAULT '',
  status TEXT DEFAULT 'online',
  custom_status TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  banner_color TEXT DEFAULT '#5865F2',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Servidores
CREATE TABLE IF NOT EXISTS public.servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon_url TEXT DEFAULT '',
  owner_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. Membros
CREATE TABLE IF NOT EXISTS public.server_members (
  id TEXT PRIMARY KEY DEFAULT ('m_' || gen_random_uuid()::text),
  server_id TEXT REFERENCES public.servers(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(server_id, user_id)
);

-- 4. Canais
CREATE TABLE IF NOT EXISTS public.channels (
  id TEXT PRIMARY KEY,
  server_id TEXT REFERENCES public.servers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text', 'voice')),
  category TEXT DEFAULT 'Geral',
  topic TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 5. Mensagens (IDs texto: 'msg_123', channel 'c_geral', user 'usr_me')
CREATE TABLE IF NOT EXISTS public.messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  reply_to_id TEXT REFERENCES public.messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON public.messages(channel_id, created_at);

-- 6. Reações
CREATE TABLE IF NOT EXISTS public.reactions (
  id TEXT PRIMARY KEY DEFAULT ('r_' || gen_random_uuid()::text),
  message_id TEXT REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(message_id, user_id, emoji)
);

-- 7. DMs
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id TEXT PRIMARY KEY DEFAULT ('dm_' || gen_random_uuid()::text),
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- RLS + políticas abertas (modo simples, sem auth)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_all" ON public.profiles;
DROP POLICY IF EXISTS "public_all" ON public.servers;
DROP POLICY IF EXISTS "public_all" ON public.server_members;
DROP POLICY IF EXISTS "public_all" ON public.channels;
DROP POLICY IF EXISTS "public_all" ON public.messages;
DROP POLICY IF EXISTS "public_all" ON public.reactions;
DROP POLICY IF EXISTS "public_all" ON public.direct_messages;

CREATE POLICY "public_all" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON public.servers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON public.server_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON public.channels FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON public.messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON public.reactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON public.direct_messages FOR ALL USING (true) WITH CHECK (true);

-- Realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.channels;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.servers;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
