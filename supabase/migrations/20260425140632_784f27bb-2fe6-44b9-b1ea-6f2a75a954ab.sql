-- =========================================================
-- 1) Função + trigger que mantém regras_congeladas.pacote.valorFotoExtra
--    sincronizado com valor_foto_extra em clientes_sessoes
-- =========================================================
CREATE OR REPLACE FUNCTION public.sync_session_extra_price_to_frozen()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clamped numeric;
  v_current_frozen numeric;
BEGIN
  -- Só age em UPDATE quando valor_foto_extra muda (ou em INSERT com valor > 0)
  IF TG_OP = 'UPDATE' THEN
    IF NEW.valor_foto_extra IS NOT DISTINCT FROM OLD.valor_foto_extra THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Sem JSON congelado, nada a fazer
  IF NEW.regras_congeladas IS NULL
     OR NEW.regras_congeladas->'pacote' IS NULL THEN
    RETURN NEW;
  END IF;

  -- Clamp 0–999.99 (espelha sanitizeExtraPrice da Gallery)
  v_clamped := LEAST(GREATEST(COALESCE(NEW.valor_foto_extra, 0)::numeric, 0::numeric), 999.99::numeric);

  -- Não tocar no JSON se o valor "novo" for 0 e o JSON já tem valor > 0
  -- (evita zerar o congelamento original quando a sessão ainda não foi editada)
  v_current_frozen := COALESCE(
    (NEW.regras_congeladas->'pacote'->>'valorFotoExtra')::numeric,
    0::numeric
  );

  IF v_clamped = 0 AND v_current_frozen > 0 THEN
    RETURN NEW;
  END IF;

  -- Patch idempotente do JSON
  IF v_current_frozen IS DISTINCT FROM v_clamped THEN
    NEW.regras_congeladas := jsonb_set(
      NEW.regras_congeladas,
      '{pacote,valorFotoExtra}',
      to_jsonb(v_clamped),
      true
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_session_extra_price_to_frozen ON public.clientes_sessoes;

CREATE TRIGGER trg_sync_session_extra_price_to_frozen
BEFORE INSERT OR UPDATE OF valor_foto_extra, regras_congeladas
ON public.clientes_sessoes
FOR EACH ROW
EXECUTE FUNCTION public.sync_session_extra_price_to_frozen();

-- =========================================================
-- 2) Backfill: sessões com divergência (campo > 0 e diferente do JSON)
--    Não toca em sessões com valor_foto_extra = 0 (preserva congelamento)
-- =========================================================
UPDATE public.clientes_sessoes cs
SET regras_congeladas = jsonb_set(
      cs.regras_congeladas,
      '{pacote,valorFotoExtra}',
      to_jsonb(LEAST(GREATEST(cs.valor_foto_extra::numeric, 0::numeric), 999.99::numeric)),
      true
    )
WHERE cs.regras_congeladas IS NOT NULL
  AND cs.regras_congeladas->'pacote' IS NOT NULL
  AND cs.valor_foto_extra IS NOT NULL
  AND cs.valor_foto_extra > 0
  AND COALESCE(
        (cs.regras_congeladas->'pacote'->>'valorFotoExtra')::numeric,
        -1::numeric
      ) IS DISTINCT FROM LEAST(GREATEST(cs.valor_foto_extra::numeric, 0::numeric), 999.99::numeric);

-- =========================================================
-- 3) Backfill seguro de galerias herdadas com valor antigo
--    Apenas galerias SEM cobranças pagas e SEM extras vendidos.
--    Para cada uma, alinha valor_foto_extra ao valor atual da sessão vinculada.
-- =========================================================
WITH alvo AS (
  SELECT g.id AS gallery_id,
         LEAST(GREATEST(cs.valor_foto_extra::numeric, 0::numeric), 999.99::numeric) AS novo_valor
  FROM public.galerias g
  JOIN public.clientes_sessoes cs
    ON cs.session_id = g.session_id
   AND cs.user_id = g.user_id
  WHERE g.session_id IS NOT NULL
    AND cs.valor_foto_extra IS NOT NULL
    AND cs.valor_foto_extra > 0
    AND g.valor_foto_extra IS DISTINCT FROM cs.valor_foto_extra
    AND COALESCE(g.total_fotos_extras_vendidas, 0) = 0
    AND NOT EXISTS (
      SELECT 1 FROM public.cobrancas c
      WHERE c.galeria_id = g.id
        AND c.status = 'pago'
    )
)
UPDATE public.galerias g
SET valor_foto_extra = alvo.novo_valor
FROM alvo
WHERE g.id = alvo.gallery_id;