-- ============================================================
-- FASE 0: BACKUP DE SEGURANÇA
-- ============================================================
CREATE TABLE IF NOT EXISTS public.backup_sessoes_desconto_progressivo_20260424 AS
SELECT 
  cs.*,
  g.valor_total_vendido AS gal_total_vendido,
  g.total_fotos_extras_vendidas AS gal_qtd_extras,
  g.valor_foto_extra AS gal_valor_foto_extra,
  now() AS backup_at
FROM public.clientes_sessoes cs
JOIN public.galerias g ON g.id = cs.galeria_id
WHERE g.total_fotos_extras_vendidas > 0
  AND g.valor_total_vendido > 0
  AND ABS(g.valor_total_vendido - (g.total_fotos_extras_vendidas * cs.valor_foto_extra)) > 0.01;


-- ============================================================
-- FASE 1: Corrigir trigger recalculate_fotos_extras_total
-- Não sobrepor valor_total_foto_extra quando vem da galeria com desconto progressivo
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalculate_fotos_extras_total()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_gal_total NUMERIC;
  v_gal_qtd INTEGER;
BEGIN
  -- Se a sessão está vinculada a uma galeria, buscar valor cobrado lá
  IF NEW.galeria_id IS NOT NULL THEN
    SELECT g.valor_total_vendido, g.total_fotos_extras_vendidas
      INTO v_gal_total, v_gal_qtd
    FROM public.galerias g
    WHERE g.id = NEW.galeria_id;
    
    -- Se a galeria tem total cobrado E a qtd da sessão bate com a da galeria,
    -- respeitar o total real (com desconto progressivo aplicado)
    IF v_gal_total IS NOT NULL 
       AND v_gal_total > 0 
       AND v_gal_qtd IS NOT NULL 
       AND v_gal_qtd > 0
       AND COALESCE(NEW.qtd_fotos_extra, 0) = v_gal_qtd THEN
      
      NEW.valor_total_foto_extra := v_gal_total;
      -- Derivar preço unitário efetivo (com desconto)
      NEW.valor_foto_extra := ROUND((v_gal_total / v_gal_qtd)::numeric, 2);
      RETURN NEW;
    END IF;
  END IF;
  
  -- Comportamento padrão (sessão avulsa, sem galeria, ou divergência de qtd):
  -- total = qtd × preço unitário
  IF NEW.qtd_fotos_extra IS NOT NULL AND NEW.valor_foto_extra IS NOT NULL THEN
    NEW.valor_total_foto_extra := NEW.qtd_fotos_extra * NEW.valor_foto_extra;
  END IF;
  
  RETURN NEW;
END;
$function$;


-- ============================================================
-- FASE 2: Corrigir trigger sync_gallery_extras_to_session
-- Derivar valor_foto_extra do preço unitário efetivo (com desconto)
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_gallery_extras_to_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_unit_efetivo NUMERIC;
  v_unit_base NUMERIC;
BEGIN
  IF (NEW.valor_foto_extra IS DISTINCT FROM OLD.valor_foto_extra)
     OR (NEW.total_fotos_extras_vendidas IS DISTINCT FROM OLD.total_fotos_extras_vendidas)
     OR (NEW.valor_total_vendido IS DISTINCT FROM OLD.valor_total_vendido) THEN

    -- Sanitiza valor base
    v_unit_base := ROUND(LEAST(GREATEST(COALESCE(NEW.valor_foto_extra, 0), 0), 999.99)::numeric, 2);
    
    -- Calcula preço unitário EFETIVO (com desconto progressivo)
    -- Se há vendas, usa o preço efetivo derivado do total real cobrado
    -- Senão usa o preço base (preço de tabela)
    v_unit_efetivo := CASE
      WHEN COALESCE(NEW.total_fotos_extras_vendidas, 0) > 0 
           AND COALESCE(NEW.valor_total_vendido, 0) > 0
      THEN ROUND((NEW.valor_total_vendido / NEW.total_fotos_extras_vendidas)::numeric, 2)
      ELSE v_unit_base
    END;

    -- Atualiza a sessão vinculada
    UPDATE public.clientes_sessoes s
    SET
      valor_foto_extra = v_unit_efetivo,
      qtd_fotos_extra = COALESCE(NEW.total_fotos_extras_vendidas, 0),
      valor_total_foto_extra = COALESCE(NEW.valor_total_vendido, 0),
      regras_congeladas = CASE
        WHEN s.regras_congeladas IS NOT NULL
             AND jsonb_typeof(s.regras_congeladas->'pacote') = 'object'
        THEN jsonb_set(
               s.regras_congeladas,
               '{pacote,valorFotoExtraEfetivo}',
               to_jsonb(v_unit_efetivo),
               true
             )
        ELSE s.regras_congeladas
      END,
      updated_at = now()
    WHERE s.galeria_id = NEW.id
      AND (
        s.valor_foto_extra IS DISTINCT FROM v_unit_efetivo
        OR s.qtd_fotos_extra IS DISTINCT FROM COALESCE(NEW.total_fotos_extras_vendidas, 0)
        OR s.valor_total_foto_extra IS DISTINCT FROM COALESCE(NEW.valor_total_vendido, 0)
        OR (
          s.regras_congeladas IS NOT NULL
          AND jsonb_typeof(s.regras_congeladas->'pacote') = 'object'
          AND COALESCE((s.regras_congeladas->'pacote'->>'valorFotoExtraEfetivo')::numeric, -1) IS DISTINCT FROM v_unit_efetivo
        )
      );

    -- Patch JSONB da própria galeria com preço base (preserva auditoria)
    IF NEW.regras_congeladas IS NOT NULL
       AND jsonb_typeof(NEW.regras_congeladas->'pacote') = 'object'
       AND COALESCE((NEW.regras_congeladas->'pacote'->>'valorFotoExtra')::numeric, -1) IS DISTINCT FROM v_unit_base
       AND pg_trigger_depth() < 2 THEN
      UPDATE public.galerias g
      SET regras_congeladas = jsonb_set(
            NEW.regras_congeladas,
            '{pacote,valorFotoExtra}',
            to_jsonb(v_unit_base),
            true
          )
      WHERE g.id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;


-- ============================================================
-- FASE 3: BACKFILL — corrigir as 20 sessões já corrompidas
-- ============================================================
UPDATE public.clientes_sessoes cs
SET 
  valor_foto_extra = ROUND((g.valor_total_vendido / g.total_fotos_extras_vendidas)::numeric, 2),
  qtd_fotos_extra = g.total_fotos_extras_vendidas,
  valor_total_foto_extra = g.valor_total_vendido,
  regras_congeladas = CASE
    WHEN cs.regras_congeladas IS NOT NULL
         AND jsonb_typeof(cs.regras_congeladas->'pacote') = 'object'
    THEN jsonb_set(
           cs.regras_congeladas,
           '{pacote,valorFotoExtraEfetivo}',
           to_jsonb(ROUND((g.valor_total_vendido / g.total_fotos_extras_vendidas)::numeric, 2)),
           true
         )
    ELSE cs.regras_congeladas
  END,
  updated_at = now()
FROM public.galerias g
WHERE cs.galeria_id = g.id
  AND g.total_fotos_extras_vendidas > 0
  AND g.valor_total_vendido > 0
  AND ABS(g.valor_total_vendido - (g.total_fotos_extras_vendidas * cs.valor_foto_extra)) > 0.01;


-- ============================================================
-- FASE 6: Trigger de proteção contra regressão
-- Bloqueia divergência entre total cobrado pela galeria e o registrado na sessão
-- ============================================================
CREATE OR REPLACE FUNCTION public.protect_session_extras_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_gal_total NUMERIC;
  v_gal_qtd INTEGER;
BEGIN
  -- Só valida se a sessão está vinculada a uma galeria com vendas
  IF NEW.galeria_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  SELECT g.valor_total_vendido, g.total_fotos_extras_vendidas
    INTO v_gal_total, v_gal_qtd
  FROM public.galerias g
  WHERE g.id = NEW.galeria_id;
  
  -- Se a galeria tem vendas, a sessão DEVE refletir esses valores
  IF v_gal_total IS NOT NULL AND v_gal_total > 0 
     AND v_gal_qtd IS NOT NULL AND v_gal_qtd > 0 THEN
    
    -- Forçar consistência (não bloquear, auto-corrigir)
    IF ABS(COALESCE(NEW.valor_total_foto_extra, 0) - v_gal_total) > 0.01
       OR COALESCE(NEW.qtd_fotos_extra, 0) <> v_gal_qtd THEN
      
      RAISE NOTICE 'Auto-corrigindo divergência sessão %: extras=% (galeria=%), qtd=% (galeria=%)',
        NEW.id, NEW.valor_total_foto_extra, v_gal_total, NEW.qtd_fotos_extra, v_gal_qtd;
      
      NEW.qtd_fotos_extra := v_gal_qtd;
      NEW.valor_total_foto_extra := v_gal_total;
      NEW.valor_foto_extra := ROUND((v_gal_total / v_gal_qtd)::numeric, 2);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Registra o trigger DEPOIS de recalc_fotos_extras (ordem alfabética: 'z_protect' roda por último)
DROP TRIGGER IF EXISTS z_protect_session_extras_consistency ON public.clientes_sessoes;
CREATE TRIGGER z_protect_session_extras_consistency
  BEFORE INSERT OR UPDATE ON public.clientes_sessoes
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_session_extras_consistency();