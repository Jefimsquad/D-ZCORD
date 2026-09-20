-- Migração: salvar e-mail no perfil (rode no Supabase > SQL Editor > Run)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';
