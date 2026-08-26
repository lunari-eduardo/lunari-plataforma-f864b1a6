-- Migration: 20260826034000_fix_tg_protect_no_overcharge_fee_repasse.sql
-- Description: Permite que cobranças com repasse de taxas ao cliente (Asaas/gateways) usem o valor nominal base (dados_extras->>'valorBase') na validação anti-overcharge

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
  IF NEW.galeria_id IS NULL OR COALESCE(NEW.valor, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  -- Se dados_extras contiver o valor nominal base (antes de acréscimo de taxas repassadas ao cliente), usar o valor base
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
    RETURN NEW;
  END IF;

  v_ideal := COALESCE((v_calc->>'valor_total_ideal')::numeric, 0);

  -- Soma cobranças pagas (fotos_extras + componente de sessao_e_extras) EXCETO a atual
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
      'Cobrança excederia o saldo devido pela regra congelada. Já pago=R$%, nova=R$%, máximo permitido=R$% (fonte: %, finalidade: %)',
      v_pago, v_check_valor, v_max, v_calc->>'rules_source', NEW.finalidade;
  END IF;

  RETURN NEW;
END;
$$;
