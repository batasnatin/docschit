-- BATASnatin Docs Chit-Chat Database Migration
-- Run this in the Supabase SQL editor
--
-- All objects are prefixed with "docschat_" to avoid collisions
-- with existing batasnatin.com tables, functions, and triggers.
--
-- Prerequisites:
--   This migration assumes the shared batasnatin Supabase instance
--   already has auth.users set up (standard Supabase Auth).
--   No additional tables (e.g. profiles) are required by this migration.

-- Chat conversations table
CREATE TABLE IF NOT EXISTS public.docschat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  knowledge_group_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS public.docschat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.docschat_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'model', 'system')),
  url_context_metadata JSONB,
  ai_provider TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_docschat_conversations_user_id ON public.docschat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_docschat_conversations_updated_at ON public.docschat_conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_docschat_messages_conversation_id ON public.docschat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_docschat_messages_created_at ON public.docschat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_docschat_messages_user_id ON public.docschat_messages(user_id);

-- Enable Row Level Security
ALTER TABLE public.docschat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docschat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only access their own data
CREATE POLICY "Docschat: users can view own conversations"
  ON public.docschat_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Docschat: users can insert own conversations"
  ON public.docschat_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Docschat: users can update own conversations"
  ON public.docschat_conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Docschat: users can delete own conversations"
  ON public.docschat_conversations FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Docschat: users can view own messages"
  ON public.docschat_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Docschat: users can insert own messages"
  ON public.docschat_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Docschat: users can update own messages"
  ON public.docschat_messages FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Docschat: users can delete own messages"
  ON public.docschat_messages FOR DELETE
  USING (auth.uid() = user_id);

-- Rate limiting table
CREATE TABLE IF NOT EXISTS public.docschat_rate_limits (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_count INT NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, endpoint)
);

-- RPC: atomic rate limit check (returns true if allowed, false if exceeded)
CREATE OR REPLACE FUNCTION public.docschat_check_rate_limit(
  p_user_id UUID,
  p_endpoint TEXT,
  p_max_requests INT DEFAULT 20,
  p_window_seconds INT DEFAULT 60
)
RETURNS BOOLEAN AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count INT;
BEGIN
  SELECT window_start, request_count INTO v_window_start, v_count
    FROM public.docschat_rate_limits
    WHERE user_id = p_user_id AND endpoint = p_endpoint;

  IF NOT FOUND OR v_window_start < now() - (p_window_seconds || ' seconds')::INTERVAL THEN
    INSERT INTO public.docschat_rate_limits (user_id, endpoint, window_start, request_count)
    VALUES (p_user_id, p_endpoint, now(), 1)
    ON CONFLICT (user_id, endpoint)
    DO UPDATE SET window_start = now(), request_count = 1;
    RETURN TRUE;
  END IF;

  IF v_count >= p_max_requests THEN
    RETURN FALSE;
  END IF;

  UPDATE public.docschat_rate_limits
    SET request_count = request_count + 1
    WHERE user_id = p_user_id AND endpoint = p_endpoint;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-update updated_at trigger (namespaced function to avoid overwriting existing ones)
CREATE OR REPLACE FUNCTION public.docschat_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER docschat_conversations_updated_at
  BEFORE UPDATE ON public.docschat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.docschat_update_updated_at();
