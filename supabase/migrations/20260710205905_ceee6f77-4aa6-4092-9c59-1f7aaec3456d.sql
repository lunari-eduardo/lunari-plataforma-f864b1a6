-- Guard revisado: permite re-congelamento legítimo (novo dataCongelamento)
-- e mantém bloqueio contra reescrita silenciosa do preço unitário congelado.
CREATE OR REPLACE FUNCTION public.guard_regras_congeladas_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_allow TEXT;
  v_old_frozen BOOLEAN;
  v_old_data TEXT;
  v_new_data TEXT;
  v_old_valor NUMERIC;
  v_new_valor NUMERIC;
  v_old_efetivo NUMERIC;
  v_new_efetivo NUMERIC;
BEGIN
  -- Escape hatch administrativo
  v_allow := COALESCE(current_setting('app.allow_frozen_rules_override', true), 'false');
  IF v_allow = 'true' THEN
    RETURN NEW;
  END IF;

  -- Sem regras antigas ou sem pacote antigo → nada a proteger
  IF OLD.regras_congeladas IS NULL THEN RETURN NEW; END IF;
  IF jsonb_typeof(OLD.regras_congeladas->'pacote') IS DISTINCT FROM 'object' THEN
    RETURN NEW;
  END IF;

  v_old_frozen := (OLD.regras_congeladas->>'dataCongelamento') IS NOT NULL;
  IF NOT v_old_frozen THEN RETURN NEW; END IF;

  -- Re-congelamento legítimo: novo dataCongelamento diferente do antigo
  -- (troca de pacote / categoria / limpeza pelo usuário via
  --  PricingFreezingService.congelarDadosCompletos → sempre gera new Date()).
  v_old_data := OLD.regras_congeladas->>'dataCongelamento';
  v_new_data := NEW.regras_congeladas->>'dataCongelamento';
  IF v_new_data IS DISTINCT FROM v_old_data THEN
    RETURN NEW;
  END IF;

  -- Novo payload sem pacote (limpou) — dataCongelamento manteve por engano.
  -- Se não existe mais preço a comparar, nada a proteger.
  IF jsonb_typeof(NEW.regras_congeladas->'pacote') IS DISTINCT FROM 'object' THEN
    RETURN NEW;
  END IF;

  v_old_valor := (OLD.regras_congeladas->'pacote'->>'valorFotoExtra')::numeric;
  v_new_valor := (NEW.regras_congeladas->'pacote'->>'valorFotoExtra')::numeric;
  v_old_efetivo := (OLD.regras_congeladas->'pacote'->>'valorFotoExtraEfetivo')::numeric;
  v_new_efetivo := (NEW.regras_congeladas->'pacote'->>'valorFotoExtraEfetivo')::numeric;

  IF v_old_valor IS DISTINCT FROM v_new_valor
     OR v_old_efetivo IS DISTINCT FROM v_new_efetivo THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'regras_congeladas.pacote.valorFotoExtra(Efetivo) é imutável após dataCongelamento',
      HINT = 'Para re-congelar, gere um novo dataCongelamento (PricingFreezingService.congelarDadosCompletos) ou execute SET LOCAL app.allow_frozen_rules_override = ''true''.';
  END IF;

  RETURN NEW;
END;
$function$;