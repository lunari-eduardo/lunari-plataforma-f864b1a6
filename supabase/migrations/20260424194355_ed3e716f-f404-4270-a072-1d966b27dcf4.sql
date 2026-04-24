-- ============================================================
-- FASE 0: BACKUP DE SEGURANÇA
-- ============================================================
CREATE TABLE IF NOT EXISTS public.backup_recovery_extras_audit_20260424 AS
SELECT 
  cs.*,
  g.total_fotos_extras_vendidas AS bk_gal_qtd,
  g.valor_total_vendido AS bk_gal_total,
  g.valor_foto_extra AS bk_gal_unit,
  now() AS backup_at
FROM public.clientes_sessoes cs
LEFT JOIN public.galerias g ON g.id = cs.galeria_id
WHERE cs.id IN (
  '47f1b390-a11d-4720-9ede-aa041ae2be5f',
  '05ccd679-64c9-4c60-b4bc-ee03f78b7a1e',
  '9635825a-f13a-4aec-b884-c64a70c0de00',
  '177e058e-7225-47b5-b549-5f7c4c4a83f1',
  'a18df489-2eea-4fb1-a6d1-175b340a5e4d',
  '0511e553-028d-4e4f-b600-addd5d70b44e',
  '604aa374-e17d-4724-b815-0f887c20ce21',
  '7f6b7b0d-3bc1-4bb3-840e-ae36ae22653d',
  '6e7a163a-06ab-4db4-8d0c-204dcee6c013',
  '938cc8fd-e8bd-44ae-8ba3-aae083f26704'
);


-- ============================================================
-- FASE 1: BACKFILL via audit_log
-- ============================================================
WITH ultima_selecao AS (
  SELECT DISTINCT ON (gallery_id)
    gallery_id,
    (metadata->>'extrasACobrar')::int AS qtd,
    (metadata->>'valorUnitario')::numeric AS unit_efetivo,
    (metadata->>'valorTotal')::numeric AS total
  FROM public.audit_log
  WHERE action = 'confirm_selection'
    AND gallery_id IS NOT NULL
    AND COALESCE((metadata->>'paymentRequired')::boolean, false) = true
    AND (metadata->>'extrasACobrar')::int > 0
  ORDER BY gallery_id, created_at DESC
)
UPDATE public.galerias g SET
  total_fotos_extras_vendidas = us.qtd,
  valor_total_vendido = us.total,
  valor_foto_extra = us.unit_efetivo,
  updated_at = now()
FROM ultima_selecao us
WHERE g.id = us.gallery_id 
  AND g.id IN (
    '1c0ed490-feef-4384-ac27-b5a4577b5921',
    'c759ffe9-01eb-49ae-a997-9d77975a2507',
    '13500163-dd78-4390-96d7-15d8d22f2159',
    '951eb156-0448-458b-823e-a126ce39e8c7',
    '2af7787f-7ac9-4796-a7ce-4aab3b3d1855',
    '6cb02d32-f80c-47b7-bab7-a534900332a1',
    'ce3da0e2-c525-471f-b826-038e75eecc74',
    'edfa1c5c-d17c-4386-ae02-d6ac53d2e86e',
    '13645a5d-c57e-4231-9a07-8aa1b6a200da',
    '3f41ba6d-0cf0-4961-a240-8a325ae848c3'
  );


-- ============================================================
-- FASE 3: TRIGGER DE PROTEÇÃO contra perda futura
-- ============================================================
CREATE OR REPLACE FUNCTION public.protect_gallery_extras_downgrade()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.total_fotos_extras_vendidas < OLD.total_fotos_extras_vendidas THEN
    IF EXISTS (
      SELECT 1 FROM public.cobrancas
      WHERE galeria_id = NEW.id
        AND status = 'pago'
        AND COALESCE(qtd_fotos, 0) > 0
    ) THEN
      INSERT INTO public.audit_log(action, resource_type, resource_id, gallery_id, metadata)
      VALUES(
        'blocked_extras_downgrade', 
        'galeria', 
        NEW.id, 
        NEW.id,
        jsonb_build_object(
          'old_qtd', OLD.total_fotos_extras_vendidas,
          'new_qtd', NEW.total_fotos_extras_vendidas,
          'old_total', OLD.valor_total_vendido,
          'new_total', NEW.valor_total_vendido,
          'reason', 'has_paid_charges'
        )
      );
      RAISE EXCEPTION 'Não é possível reduzir fotos extras: existem cobranças pagas vinculadas a esta galeria. Use "Reconciliar crédito" no Workflow para ajustar manualmente.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_gallery_extras_downgrade ON public.galerias;
CREATE TRIGGER trg_protect_gallery_extras_downgrade
  BEFORE UPDATE OF total_fotos_extras_vendidas, valor_total_vendido ON public.galerias
  FOR EACH ROW 
  WHEN (NEW.total_fotos_extras_vendidas IS DISTINCT FROM OLD.total_fotos_extras_vendidas)
  EXECUTE FUNCTION public.protect_gallery_extras_downgrade();


-- ============================================================
-- RPC: reconcile_session_extras
-- ============================================================
CREATE OR REPLACE FUNCTION public.reconcile_session_extras(
  p_session_id uuid,
  p_qtd_extras integer,
  p_valor_unitario numeric,
  p_destino_sobra text DEFAULT 'manter_credito',
  p_valor_sobra numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session record;
  v_user_id uuid;
  v_total_extras numeric;
  v_old_adicional numeric;
  v_old_desconto numeric;
  v_new_adicional numeric;
  v_new_desconto numeric;
BEGIN
  IF p_qtd_extras < 0 OR p_valor_unitario < 0 OR p_valor_sobra < 0 THEN
    RAISE EXCEPTION 'Valores não podem ser negativos';
  END IF;
  
  IF p_destino_sobra NOT IN ('adicional', 'desconto_negativo', 'manter_credito') THEN
    RAISE EXCEPTION 'Destino da sobra inválido';
  END IF;
  
  SELECT * INTO v_session FROM public.clientes_sessoes WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessão não encontrada';
  END IF;
  
  v_user_id := auth.uid();
  IF v_user_id IS NULL OR v_user_id <> v_session.user_id THEN
    RAISE EXCEPTION 'Sem permissão para reconciliar esta sessão';
  END IF;
  
  v_total_extras := ROUND((p_qtd_extras * p_valor_unitario)::numeric, 2);
  v_old_adicional := COALESCE(v_session.valor_adicional, 0);
  v_old_desconto := COALESCE(v_session.desconto, 0);
  v_new_adicional := v_old_adicional;
  v_new_desconto := v_old_desconto;
  
  IF p_destino_sobra = 'adicional' THEN
    v_new_adicional := v_old_adicional + p_valor_sobra;
  ELSIF p_destino_sobra = 'desconto_negativo' THEN
    v_new_desconto := v_old_desconto - p_valor_sobra;
  END IF;
  
  UPDATE public.clientes_sessoes SET
    qtd_fotos_extra = p_qtd_extras,
    valor_foto_extra = p_valor_unitario,
    valor_total_foto_extra = v_total_extras,
    valor_adicional = v_new_adicional,
    desconto = v_new_desconto,
    regras_congeladas = CASE
      WHEN regras_congeladas IS NOT NULL
           AND jsonb_typeof(regras_congeladas->'pacote') = 'object'
      THEN jsonb_set(
             regras_congeladas,
             '{pacote,valorFotoExtraEfetivo}',
             to_jsonb(p_valor_unitario),
             true
           )
      ELSE regras_congeladas
    END,
    updated_at = now(),
    updated_by = v_user_id
  WHERE id = p_session_id;
  
  INSERT INTO public.audit_log(action, resource_type, resource_id, actor_id, actor_type, gallery_id, metadata)
  VALUES(
    'reconcile_credit',
    'sessao',
    p_session_id,
    v_user_id,
    'user',
    v_session.galeria_id,
    jsonb_build_object(
      'qtd_extras', p_qtd_extras,
      'valor_unitario', p_valor_unitario,
      'total_extras', v_total_extras,
      'destino_sobra', p_destino_sobra,
      'valor_sobra', p_valor_sobra,
      'old_adicional', v_old_adicional,
      'new_adicional', v_new_adicional,
      'old_desconto', v_old_desconto,
      'new_desconto', v_new_desconto,
      'old_qtd_extras', v_session.qtd_fotos_extra,
      'old_total_extras', v_session.valor_total_foto_extra
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'qtd_extras', p_qtd_extras,
    'valor_unitario', p_valor_unitario,
    'total_extras', v_total_extras,
    'novo_adicional', v_new_adicional,
    'novo_desconto', v_new_desconto
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_session_extras(uuid, integer, numeric, text, numeric) TO authenticated;


-- ============================================================
-- RPC auxiliar: get_audit_extras_suggestion
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_audit_extras_suggestion(p_galeria_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE 
    WHEN al.metadata IS NULL THEN NULL
    ELSE jsonb_build_object(
      'qtd', (al.metadata->>'extrasACobrar')::int,
      'valor_unitario', (al.metadata->>'valorUnitario')::numeric,
      'valor_total', (al.metadata->>'valorTotal')::numeric,
      'created_at', al.created_at
    )
  END
  FROM public.audit_log al
  WHERE al.gallery_id = p_galeria_id
    AND al.action = 'confirm_selection'
    AND COALESCE((al.metadata->>'paymentRequired')::boolean, false) = true
    AND (al.metadata->>'extrasACobrar')::int > 0
    AND EXISTS (
      SELECT 1 FROM public.galerias g 
      WHERE g.id = p_galeria_id AND g.user_id = auth.uid()
    )
  ORDER BY al.created_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_audit_extras_suggestion(uuid) TO authenticated;