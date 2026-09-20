-- DÉZCORD - Rode no Supabase > SQL Editor > New query > Run
-- Apaga schema antigo UUID (se existir) e cria o compatível com o app.

-- RESET (apaga tabelas antigas, se existirem)
DROP TABLE IF EXISTS public.reactions CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.channels CASCADE;
DROP TABLE IF EXISTS public.server_members CASCADE;
DROP TABLE IF EXISTS public.servers CASCADE;
DROP TABLE IF EXISTS public.direct_messages CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- PERFIS
CREATE TABLE public.profiles (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT DEFAULT '',
  status TEXT DEFAULT 'online',
  custom_status TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  banner_color TEXT DEFAULT '#5865F2',
  email TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- SERVIDORES
CREATE TABLE public.servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon_url TEXT DEFAULT '',
  owner_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- MEMBROS
CREATE TABLE public.server_members (
  id TEXT PRIMARY KEY DEFAULT ('m_' || gen_random_uuid()::text),
  server_id TEXT REFERENCES public.servers(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(server_id, user_id)
);

-- CANAIS
CREATE TABLE public.channels (
  id TEXT PRIMARY KEY,
  server_id TEXT REFERENCES public.servers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text', 'voice')),
  category TEXT DEFAULT 'Geral',
  topic TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- MENSAGENS
CREATE TABLE public.messages (
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

-- REACOES
CREATE TABLE public.reactions (
  id TEXT PRIMARY KEY DEFAULT ('r_' || gen_random_uuid()::text),
  message_id TEXT REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(message_id, user_id, emoji)
);

-- DMS
CREATE TABLE public.direct_messages (
  id TEXT PRIMARY KEY DEFAULT ('dm_' || gen_random_uuid()::text),
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- RLS + POLITICAS ABERTAS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_all" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON public.servers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON public.server_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON public.channels FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON public.messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON public.reactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON public.direct_messages FOR ALL USING (true) WITH CHECK (true);

-- REALTIME
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.channels; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.servers; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
