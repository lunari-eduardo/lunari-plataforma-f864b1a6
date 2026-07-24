-- ========================================================================
-- Fase 2 — Deduplicação estrutural de tarefas-espelho de produtos
-- ========================================================================
-- Contexto: tarefas com tag `workflow:produto` são espelhos de produtos de
-- sessões. A identidade lógica é (related_session_id, tag "produto:<id>"),
-- mas nada no banco garantia unicidade — corridas entre abas e reconciler
-- criaram até 5 linhas idênticas para o mesmo produto.
--
-- Esta migração:
--   1. Faz backup das duplicatas atuais.
--   2. Remove duplicatas mantendo a linha mais antiga (created_at ASC, id ASC).
--   3. Adiciona coluna `mirror_product_tag` mantida por trigger.
--   4. Cria índice único parcial garantindo 1 linha por (sessão, produto).
--   5. Publica RPC `upsert_product_mirror_task` para o reconciler usar.
-- ========================================================================

-- 1) Backup completo das linhas envolvidas antes de qualquer DELETE.
CREATE TABLE IF NOT EXISTS public.backup_tasks_duplicates_20260724 AS
SELECT t.*
FROM public.tasks t
WHERE 'workflow:produto' = ANY(t.tags)
  AND t.related_session_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.tasks t2
    WHERE t2.related_session_id = t.related_session_id
      AND 'workflow:produto' = ANY(t2.tags)
      AND t2.id <> t.id
      AND (
        SELECT tg FROM unnest(t.tags) tg WHERE tg LIKE 'produto:%' LIMIT 1
      ) = (
        SELECT tg FROM unnest(t2.tags) tg WHERE tg LIKE 'produto:%' LIMIT 1
      )
  );

-- 2) Delete duplicatas — mantém a linha canônica (mais antiga).
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY
        related_session_id,
        (SELECT tg FROM unnest(tags) tg WHERE tg LIKE 'produto:%' LIMIT 1)
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.tasks
  WHERE 'workflow:produto' = ANY(tags)
    AND related_session_id IS NOT NULL
)
DELETE FROM public.tasks
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 3) Coluna auxiliar preenchida por trigger (subquery em GENERATED não é
--    imutável no Postgres, então usamos trigger BEFORE INSERT/UPDATE).
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS mirror_product_tag TEXT;

CREATE OR REPLACE FUNCTION public.tasks_set_mirror_product_tag()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tag TEXT;
BEGIN
  IF NEW.tags IS NULL OR NOT ('workflow:produto' = ANY(NEW.tags)) THEN
    NEW.mirror_product_tag := NULL;
    RETURN NEW;
  END IF;
  SELECT tg INTO v_tag
  FROM unnest(NEW.tags) tg
  WHERE tg LIKE 'produto:%'
  LIMIT 1;
  NEW.mirror_product_tag := v_tag;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tasks_set_mirror_product_tag ON public.tasks;
CREATE TRIGGER trg_tasks_set_mirror_product_tag
  BEFORE INSERT OR UPDATE OF tags ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_set_mirror_product_tag();

-- Backfill da coluna para as linhas existentes.
UPDATE public.tasks
SET mirror_product_tag = (
  SELECT tg FROM unnest(tags) tg WHERE tg LIKE 'produto:%' LIMIT 1
)
WHERE 'workflow:produto' = ANY(tags);

-- 4) Índice único parcial — barreira definitiva contra duplicação.
CREATE UNIQUE INDEX IF NOT EXISTS ux_tasks_mirror_product
  ON public.tasks (related_session_id, mirror_product_tag)
  WHERE mirror_product_tag IS NOT NULL
    AND related_session_id IS NOT NULL;

-- 5) RPC de upsert idempotente usado pelo reconciler no cliente.
--    Aceita payload jsonb com os campos mutáveis; a chave lógica é
--    (session_id, product_tag). Retorna a row final (sempre 1).
CREATE OR REPLACE FUNCTION public.upsert_product_mirror_task(
  p_session_id TEXT,
  p_product_tag TEXT,
  p_payload JSONB
)
RETURNS SETOF public.tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_tags TEXT[];
  v_existing public.tasks%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF p_session_id IS NULL OR p_product_tag IS NULL OR p_product_tag !~ '^produto:' THEN
    RAISE EXCEPTION 'invalid session/product identity';
  END IF;

  -- Normaliza tags: garante workflow:produto + a tag do produto.
  v_tags := COALESCE(
    ARRAY(SELECT DISTINCT unnest(
      COALESCE(
        (SELECT array_agg(value::text) FROM jsonb_array_elements_text(p_payload->'tags')),
        ARRAY[]::TEXT[]
      )
      || ARRAY['workflow:produto', p_product_tag]
    )),
    ARRAY['workflow:produto', p_product_tag]
  );

  -- Procura row existente respeitando propriedade do user.
  SELECT * INTO v_existing
  FROM public.tasks
  WHERE related_session_id = p_session_id
    AND mirror_product_tag = p_product_tag
    AND user_id = v_user
  ORDER BY created_at ASC, id ASC
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.tasks SET
      title       = COALESCE(p_payload->>'title', title),
      description = COALESCE(p_payload->>'description', description),
      status      = COALESCE(p_payload->>'status', status),
      priority    = COALESCE(p_payload->>'priority', priority),
      category    = COALESCE(p_payload->>'category', category),
      type        = COALESCE(p_payload->>'type', type),
      source      = COALESCE(p_payload->>'source', source),
      notes       = COALESCE(p_payload->>'notes', notes),
      tags        = v_tags,
      related_cliente_id = COALESCE(
        NULLIF(p_payload->>'related_cliente_id','')::uuid, related_cliente_id
      ),
      updated_at  = now()
    WHERE id = v_existing.id;
    RETURN QUERY SELECT * FROM public.tasks WHERE id = v_existing.id;
    RETURN;
  END IF;

  -- Insert novo. ON CONFLICT protege contra corrida cross-transaction.
  RETURN QUERY
  INSERT INTO public.tasks (
    user_id, title, description, status, priority, category, type, source,
    notes, tags, related_session_id, related_cliente_id
  ) VALUES (
    v_user,
    COALESCE(p_payload->>'title', 'Produto'),
    p_payload->>'description',
    COALESCE(p_payload->>'status', 'a_produzir'),
    COALESCE(p_payload->>'priority', 'media'),
    p_payload->>'category',
    COALESCE(p_payload->>'type', 'workflow_produto'),
    COALESCE(p_payload->>'source', 'workflow'),
    p_payload->>'notes',
    v_tags,
    p_session_id,
    NULLIF(p_payload->>'related_cliente_id','')::uuid
  )
  ON CONFLICT (related_session_id, mirror_product_tag)
    WHERE mirror_product_tag IS NOT NULL AND related_session_id IS NOT NULL
  DO UPDATE SET
    title      = EXCLUDED.title,
    status     = EXCLUDED.status,
    tags       = EXCLUDED.tags,
    updated_at = now()
  RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_product_mirror_task(TEXT, TEXT, JSONB)
  TO authenticated;

REVOKE EXECUTE ON FUNCTION public.upsert_product_mirror_task(TEXT, TEXT, JSONB)
  FROM anon;
