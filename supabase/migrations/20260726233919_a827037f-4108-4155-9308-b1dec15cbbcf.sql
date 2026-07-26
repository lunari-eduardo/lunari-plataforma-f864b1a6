
CREATE TABLE public.memory_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('user','project','assistant')),
  key TEXT NOT NULL CHECK (
    char_length(key) BETWEEN 1 AND 128
    AND key !~* '^(conversation|message|turn|history|chat)\.'
  ),
  value JSONB NOT NULL CHECK (char_length(value::text) <= 4096),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('assistant','manual','inferred')),
  confidence NUMERIC(3,2) NOT NULL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  expires_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ux_memory_entries_scope_key ON public.memory_entries(user_id, scope, key);
CREATE INDEX ix_memory_entries_user_scope ON public.memory_entries(user_id, scope);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.memory_entries TO authenticated;
GRANT ALL ON public.memory_entries TO service_role;

ALTER TABLE public.memory_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "memory_entries_select_own" ON public.memory_entries
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "memory_entries_insert_own" ON public.memory_entries
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "memory_entries_update_own" ON public.memory_entries
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "memory_entries_delete_own" ON public.memory_entries
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_memory_entries_updated_at
  BEFORE UPDATE ON public.memory_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
