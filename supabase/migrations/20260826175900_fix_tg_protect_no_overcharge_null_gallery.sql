-- Migration: 20260826175900_fix_tg_protect_no_overcharge_null_gallery.sql
-- Description: Garante que cobranças de fotos extras SEM galeria vinculada (extras manuais)
-- passem pela trigger sem erro. A trigger ja tinha o guard, mas este deploy
-- garante que a versao em producao esteja atualizada com o guard correto.

CREATE OR REPLACE FUNCTION public.tg_protect_no_overcharge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_calc jsonb;
  v_pago numeric;
  v_ideal numeric;
  v_max numeric;
  v_check_valor numeric;
  v_base_valor numeric;
BEGIN
  -- SEM galeria vinculada -> extras manuais (sem galeria, sem modulo Gallery),
  -- ou valor zero -> nao ha o que validar, permite o INSERT.
  IF NEW.galeria_id IS NULL OR COALESCE(NEW.valor, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  -- Se dados_extras contiver o valor nominal base, usar o valor base
  IF NEW.dados_extras IS NOT NULL AND (NEW.dados_extras->>'valorBase') IS NOT NULL THEN
    v_base_valor := (NEW.dados_extras->>'valorBase')::numeric;
  ELSIF NEW.dados_extras IS NOT NULL AND (NEW.dados_extras->>'valorExtrasBase') IS NOT NULL THEN
    v_base_valor := (NEW.dados_extras->>'valorExtrasBase')::numeric;
  END IF;

  IF NEW.finalidade = 'fotos_extras' THEN
    v_check_valor := COALESCE(v_base_valor, NEW.valor);
  ELSIF NEW.finalidade = 'sessao_e_extras' THEN
    v_check_valor := COALESCE(v_base_valor, NEW.valor_extras_componente, 0);
    IF v_check_valor <= 0 THEN
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  v_calc := public.calculate_gallery_extra_payment(NEW.galeria_id);
  IF (v_calc->>'success')::boolean IS NOT TRUE THEN
    -- Galeria sem calculo formal ou RPC falhou -- permite o INSERT (extras manuais com galeria)
    RETURN NEW;
  END IF;

  v_ideal := COALESCE((v_calc->>'valor_total_ideal')::numeric, 0);

  SELECT COALESCE(SUM(
    CASE 
      WHEN finalidade = 'fotos_extras' THEN 
        COALESCE((dados_extras->>'valorBase')::numeric, valor)
      WHEN finalidade = 'sessao_e_extras' THEN 
        COALESCE((dados_extras->>'valorExtrasBase')::numeric, (dados_extras->>'valorBase')::numeric, valor_extras_componente, 0)
      ELSE 0
    END
  ), 0) INTO v_pago
    FROM public.cobrancas
   WHERE galeria_id = NEW.galeria_id
     AND finalidade IN ('fotos_extras','sessao_e_extras')
     AND status IN ('pago','pago_manual')
     AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  v_max := v_ideal;
  IF v_max > 0 AND (v_pago + v_check_valor) > v_max + 0.01 THEN
    RAISE EXCEPTION
      'Cobranca excederia o saldo devido pela regra congelada. Ja pago=R$%, nova=R$%, maximo permitido=R$% (fonte: %, finalidade: %)',
      v_pago, v_check_valor, v_max, v_calc->>'rules_source', NEW.finalidade;
  END IF;

  RETURN NEW;
END;
$$;
