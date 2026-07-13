
-- ==========================================================
-- FRENTE 1: BACKFILL DE EXTRAS HISTÓRICOS
-- ==========================================================

-- 1.1 Snapshot/auditoria completa antes de tocar em qualquer linha
DROP TABLE IF EXISTS public.backup_extras_backfill_20260713;
CREATE TABLE public.backup_extras_backfill_20260713 AS
WITH src AS (
  SELECT
    s.id,
    s.session_id,
    s.user_id,
    s.data_sessao,
    s.valor_base_pacote,
    s.valor_adicional,
    s.desconto,
    s.valor_pago,
    s.qtd_fotos_extra          AS qtd_fotos_extra_antes,
    s.valor_foto_extra         AS valor_foto_extra_antes,
    s.valor_total_foto_extra   AS valor_total_foto_extra_antes,
    s.extras_overridden        AS extras_overridden_antes,
    (COALESCE(s.valor_pago,0) - (COALESCE(s.valor_base_pacote,0)+COALESCE(s.valor_adicional,0)-COALESCE(s.desconto,0)))::numeric AS excedente,
    COALESCE(
      NULLIF((s.regras_congeladas->'pacote'->>'valorFotoExtra')::numeric, 0),
      NULLIF(s.valor_foto_extra, 0)
    ) AS unit
  FROM public.clientes_sessoes s
  WHERE s.session_id LIKE 'HIST-%'
    AND s.data_sessao >= '2025-01-01'
    AND s.data_sessao <  '2026-02-01'
    AND COALESCE(s.tipo_registro,'workflow') = 'workflow'
)
SELECT
  id, session_id, user_id, data_sessao,
  valor_base_pacote, valor_adicional, desconto, valor_pago,
  qtd_fotos_extra_antes, valor_foto_extra_antes, valor_total_foto_extra_antes, extras_overridden_antes,
  excedente, unit,
  CASE WHEN unit IS NOT NULL AND unit > 0 AND excedente > 0.5
       THEN ROUND(excedente / unit)::int ELSE 0 END AS qtd_calculada,
  CASE WHEN unit IS NOT NULL AND unit > 0 AND excedente > 0.5
       THEN ROUND(ROUND(excedente / unit) * unit, 2) ELSE 0 END AS valor_extras_calculado,
  CASE WHEN unit IS NOT NULL AND unit > 0 AND excedente > 0.5
       THEN ROUND(excedente - (ROUND(excedente / unit) * unit), 2) ELSE 0 END AS resto_para_valor_adicional,
  now() AS backup_at
FROM src
WHERE excedente > 0.5;

COMMENT ON TABLE public.backup_extras_backfill_20260713 IS
  'Snapshot pré-backfill de extras históricos (HIST-* 2025 + jan/2026). Reversível.';

-- 1.2 Aplicação do backfill (com arredondamento; excedente sobra vai para valor_adicional)
WITH src AS (
  SELECT
    id, valor_adicional, unit, excedente, qtd_calculada, valor_extras_calculado, resto_para_valor_adicional
  FROM public.backup_extras_backfill_20260713
  WHERE qtd_calculada > 0
)
UPDATE public.clientes_sessoes s
SET
  qtd_fotos_extra        = src.qtd_calculada,
  valor_total_foto_extra = src.valor_extras_calculado,
  valor_foto_extra       = COALESCE(NULLIF(s.valor_foto_extra, 0), src.unit),
  valor_adicional        = ROUND((COALESCE(s.valor_adicional,0) + src.resto_para_valor_adicional)::numeric, 2),
  extras_overridden      = true,
  updated_at             = now()
FROM src
WHERE s.id = src.id;

-- ==========================================================
-- FRENTE 2: PRESERVAÇÃO NA EXCLUSÃO DE GALERIA
-- ==========================================================

-- 2.1 Coluna de snapshot histórico na sessão
ALTER TABLE public.clientes_sessoes
  ADD COLUMN IF NOT EXISTS snapshot_extras_at_gallery_delete jsonb;

COMMENT ON COLUMN public.clientes_sessoes.snapshot_extras_at_gallery_delete IS
  'Snapshot de qtd/unit/total de extras no momento em que a galeria vinculada foi excluída. Serve como prova histórica.';

-- 2.2 Função e trigger BEFORE DELETE em galerias
CREATE OR REPLACE FUNCTION public.freeze_session_extras_on_gallery_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unit numeric;
BEGIN
  -- Unit efetivo prioriza regras congeladas
  v_unit := COALESCE(
    NULLIF((OLD.regras_congeladas->'pacote'->>'valorFotoExtraEfetivo')::numeric, 0),
    NULLIF((OLD.regras_congeladas->'pacote'->>'valorFotoExtra')::numeric, 0),
    NULLIF(OLD.valor_foto_extra, 0)
  );

  UPDATE public.clientes_sessoes s
  SET
    -- congela: bloqueia qualquer sync futuro
    extras_overridden = true,
    -- se sessão não tinha unit e a galeria tinha, preserva
    valor_foto_extra  = COALESCE(NULLIF(s.valor_foto_extra, 0), v_unit, s.valor_foto_extra),
    -- guarda prova histórica
    snapshot_extras_at_gallery_delete = jsonb_build_object(
      'galeria_id',            OLD.id,
      'deleted_at',            now(),
      'qtd_fotos_extra',       s.qtd_fotos_extra,
      'valor_foto_extra',      COALESCE(NULLIF(s.valor_foto_extra,0), v_unit),
      'valor_total_foto_extra', s.valor_total_foto_extra,
      'galeria_total_vendidas', OLD.total_fotos_extras_vendidas,
      'galeria_valor_vendido',  OLD.valor_total_vendido
    ),
    updated_at = now()
  WHERE s.galeria_id = OLD.id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_freeze_session_extras_on_gallery_delete ON public.galerias;
CREATE TRIGGER trg_freeze_session_extras_on_gallery_delete
BEFORE DELETE ON public.galerias
FOR EACH ROW
EXECUTE FUNCTION public.freeze_session_extras_on_gallery_delete();

-- 2.3 Hardening do sync galeria→sessão:
-- Nunca propaga downgrade para zero. Se a galeria for atualizada com
-- total_fotos_extras_vendidas = 0 partindo de um valor > 0, a sessão
-- fica intocada (junto com o guard extras_overridden = true da 2.2).
CREATE OR REPLACE FUNCTION public.sync_gallery_extras_to_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_unit_frozen NUMERIC;
  v_unit_frozen_base NUMERIC;
  v_unit_efetivo NUMERIC;
  v_fotos_incluidas_mudou BOOLEAN;
  v_extras_mudou BOOLEAN;
  v_selecao_atualizou BOOLEAN;
  v_qtd_total INT;
BEGIN
  IF pg_trigger_depth() >= 2 THEN
    RETURN NEW;
  END IF;

  -- Guard anti-downgrade: se está zerando extras (limpeza pré-delete),
  -- NÃO propaga para a sessão. O BEFORE DELETE cuida do congelamento.
  IF COALESCE(NEW.total_fotos_extras_vendidas, 0) = 0
     AND COALESCE(OLD.total_fotos_extras_vendidas, 0) > 0 THEN
    RETURN NEW;
  END IF;

  v_extras_mudou := (NEW.valor_foto_extra IS DISTINCT FROM OLD.valor_foto_extra)
                 OR (NEW.total_fotos_extras_vendidas IS DISTINCT FROM OLD.total_fotos_extras_vendidas)
                 OR (NEW.valor_total_vendido IS DISTINCT FROM OLD.valor_total_vendido);

  v_fotos_incluidas_mudou := (NEW.fotos_incluidas IS DISTINCT FROM OLD.fotos_incluidas);

  v_selecao_atualizou := (
    NEW.status = 'selecao_completa'
    AND (
      COALESCE(OLD.status, '') IS DISTINCT FROM 'selecao_completa'
      OR NEW.fotos_selecionadas IS DISTINCT FROM OLD.fotos_selecionadas
      OR NEW.fotos_incluidas IS DISTINCT FROM OLD.fotos_incluidas
    )
    AND COALESCE(NEW.fotos_selecionadas, 0) >= COALESCE(NEW.fotos_incluidas, 0)
  );

  IF v_extras_mudou OR v_selecao_atualizou THEN
    v_unit_frozen := NULLIF((NEW.regras_congeladas->'pacote'->>'valorFotoExtraEfetivo')::numeric, 0);
    v_unit_frozen_base := NULLIF((NEW.regras_congeladas->'pacote'->>'valorFotoExtra')::numeric, 0);
    v_unit_efetivo := COALESCE(v_unit_frozen, v_unit_frozen_base, NULLIF(NEW.valor_foto_extra, 0), 0);

    v_qtd_total := COALESCE(NEW.total_fotos_extras_vendidas, 0);
    IF NEW.status = 'selecao_completa' THEN
      v_qtd_total := GREATEST(
        v_qtd_total,
        COALESCE(NEW.fotos_selecionadas, 0) - COALESCE(NEW.fotos_incluidas, 0)
      );
    END IF;

    IF v_unit_efetivo > 0 THEN
      UPDATE public.clientes_sessoes s
      SET valor_foto_extra = v_unit_efetivo,
          qtd_fotos_extra = v_qtd_total,
          valor_total_foto_extra = ROUND((v_qtd_total * v_unit_efetivo)::numeric, 2),
          updated_at = now()
      WHERE s.galeria_id = NEW.id
        AND COALESCE(s.extras_overridden, false) = false
        AND (
          s.valor_foto_extra IS DISTINCT FROM v_unit_efetivo
          OR s.qtd_fotos_extra IS DISTINCT FROM v_qtd_total
          OR s.valor_total_foto_extra IS DISTINCT FROM ROUND((v_qtd_total * v_unit_efetivo)::numeric, 2)
        );
    END IF;
  END IF;

  IF v_fotos_incluidas_mudou THEN
    IF NEW.regras_congeladas IS NOT NULL
       AND jsonb_typeof(NEW.regras_congeladas->'pacote') = 'object'
       AND pg_trigger_depth() < 2 THEN
      UPDATE public.galerias g
      SET regras_congeladas = jsonb_set(
            NEW.regras_congeladas,
            '{pacote,fotosIncluidas}',
            to_jsonb(NEW.fotos_incluidas),
            true
          )
      WHERE g.id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- ==========================================================
-- VERIFICAÇÃO FINAL (não bloqueante; só emite aviso)
-- ==========================================================
DO $$
DECLARE
  v_residuo int;
BEGIN
  SELECT COUNT(*) INTO v_residuo
  FROM public.clientes_sessoes
  WHERE session_id LIKE 'HIST-%'
    AND data_sessao >= '2025-01-01' AND data_sessao < '2026-02-01'
    AND COALESCE(tipo_registro,'workflow') = 'workflow'
    AND valor_pago > (COALESCE(valor_base_pacote,0)+COALESCE(valor_adicional,0)+COALESCE(valor_total_foto_extra,0)-COALESCE(desconto,0)) + 0.5;

  RAISE NOTICE 'Sessões HIST-* com excedente residual após backfill: %', v_residuo;
END $$;
