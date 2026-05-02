
-- 1. task_attachments
CREATE TABLE IF NOT EXISTS public.task_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,
  tamanho BIGINT NOT NULL DEFAULT 0,
  storage_path TEXT NOT NULL,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_attachments_task ON public.task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_user ON public.task_attachments(user_id);

ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own task attachments"
  ON public.task_attachments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own task attachments"
  ON public.task_attachments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own task attachments"
  ON public.task_attachments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own task attachments"
  ON public.task_attachments FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_task_attachments_updated
  BEFORE UPDATE ON public.task_attachments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. r2_storage_path em clientes_documentos
ALTER TABLE public.clientes_documentos
  ADD COLUMN IF NOT EXISTS r2_storage_path TEXT;

-- 3. r2_arquivo_assinado_path em contratos
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS r2_arquivo_assinado_path TEXT;

-- 4. r2_migration_log
CREATE TABLE IF NOT EXISTS public.r2_migration_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_bucket TEXT NOT NULL,
  source_path TEXT NOT NULL,
  target_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_r2_migration_log_status ON public.r2_migration_log(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_r2_migration_log_source ON public.r2_migration_log(source_bucket, source_path);

ALTER TABLE public.r2_migration_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view migration log"
  ON public.r2_migration_log FOR SELECT
  TO authenticated
  USING (true);
