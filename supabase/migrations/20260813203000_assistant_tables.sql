-- Criação das tabelas do Assistente Lunari
-- Tabelas de persistência de threads, mensagens, invocations, e configuração de provider

-- Tabela de Auditoria (invocations)
CREATE TABLE public.assistant_invocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id text NOT NULL,
  tool_name text NOT NULL,
  tool_input jsonb NOT NULL,
  tool_output jsonb,
  approved boolean,
  approved_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.assistant_invocations TO authenticated;
GRANT ALL ON public.assistant_invocations TO service_role;
ALTER TABLE public.assistant_invocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own invocations"
  ON public.assistant_invocations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service inserts invocations"
  ON public.assistant_invocations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Tabela de Threads (Conversas)
CREATE TABLE public.assistant_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.assistant_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own threads"
  ON public.assistant_threads FOR ALL TO authenticated
  USING (auth.uid() = user_id);

-- Tabela de Mensagens
CREATE TABLE public.assistant_messages (
  id text PRIMARY KEY,
  thread_id uuid NOT NULL REFERENCES public.assistant_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.assistant_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own messages"
  ON public.assistant_messages FOR ALL TO authenticated
  USING (auth.uid() = user_id);

-- Inserir provider padrão em app_settings
INSERT INTO public.app_settings (key, value)
VALUES ('assistant_ai_provider', '"google/gemini-2.5-flash"'::jsonb)
ON CONFLICT (key) DO NOTHING;
