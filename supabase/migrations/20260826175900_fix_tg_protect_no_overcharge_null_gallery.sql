-- Migration: 20260826175900_fix_tg_protect_no_overcharge_null_gallery.sql
-- Description: Permite cobranças de fotos extras criadas pelo fotógrafo no Workflow/CRM (com session_id ou sem galeria)
-- sem ser bloqueado pela trava anti-overcharge da galeria pública.

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
  -- 1) Sem galeria vinculada OU valor zero -> nada a validar, permite o INSERT
  IF NEW.galeria_id IS NULL OR COALESCE(NEW.valor, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  -- 2) Se a cobranca possui session_id (originada do Workflow / CRM / Studio),
  -- o fotografo tem total autoridade para definir/alterar o valor de extras e negociar com o cliente.
  -- A trava anti-overcharge aplica-se exclusivamente ao checkout publico da galeria (onde session_id IS NULL).
  IF NEW.session_id IS NOT NULL THEN
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
    -- Galeria sem calculo formal ou RPC falhou -- permite o INSERT
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
