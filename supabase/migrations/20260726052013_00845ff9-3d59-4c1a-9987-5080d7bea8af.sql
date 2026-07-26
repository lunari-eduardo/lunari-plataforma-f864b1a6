-- Onda 6 — Knowledge Engine v1 (ADR-015)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.knowledge_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source TEXT NOT NULL,              -- ex.: 'contract_template','form_template','note','help'
  external_id TEXT,                  -- id opcional na origem (ex.: contrato_id)
  title TEXT,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding vector(1536) NOT NULL,
  model_version TEXT NOT NULL DEFAULT 'openai/text-embedding-3-small',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_documents TO authenticated;
GRANT ALL ON public.knowledge_documents TO service_role;

ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_documents owner all"
  ON public.knowledge_documents FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Índice HNSW (1536 dims ≤ 2000, indexa direto)
CREATE INDEX IF NOT EXISTS knowledge_documents_embedding_idx
  ON public.knowledge_documents USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS knowledge_documents_user_source_idx
  ON public.knowledge_documents (user_id, source);

CREATE UNIQUE INDEX IF NOT EXISTS knowledge_documents_user_source_extid_uidx
  ON public.knowledge_documents (user_id, source, external_id)
  WHERE external_id IS NOT NULL;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.knowledge_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_knowledge_touch ON public.knowledge_documents;
CREATE TRIGGER trg_knowledge_touch
  BEFORE UPDATE ON public.knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION public.knowledge_touch_updated_at();

-- Similarity search (owner-scoped)
CREATE OR REPLACE FUNCTION public.knowledge_match(
  p_user_id UUID,
  p_query vector(1536),
  p_source TEXT DEFAULT NULL,
  p_limit INT DEFAULT 8
)
RETURNS TABLE (
  id UUID,
  source TEXT,
  external_id TEXT,
  title TEXT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    d.id, d.source, d.external_id, d.title, d.content, d.metadata,
    1 - (d.embedding <=> p_query) AS similarity
  FROM public.knowledge_documents d
  WHERE d.user_id = p_user_id
    AND (p_source IS NULL OR d.source = p_source)
  ORDER BY d.embedding <=> p_query
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 8), 50));
$$;

REVOKE ALL ON FUNCTION public.knowledge_match(UUID, vector, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.knowledge_match(UUID, vector, TEXT, INT) TO authenticated, service_role;