
-- 1) tg_classify_cobranca_finalidade — respeitar finalidade explícita
CREATE OR REPLACE FUNCTION public.tg_classify_cobranca_finalidade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gallery_id UUID;
BEGIN
  -- Se a edge/caller já definiu finalidade explícita e válida, NÃO reescrever.
  IF NEW.finalidade IN ('sessao','fotos_extras','sessao_e_extras') THEN
    RETURN NEW;
  END IF;

  -- Legado: finalidade NULL → tentar classificar
  IF NEW.galeria_id IS NOT NULL THEN
    NEW.finalidade := 'fotos_extras';
    RETURN NEW;
  END IF;

  IF NEW.session_id IS NOT NULL AND NEW.user_id IS NOT NULL
     AND COALESCE(NEW.tipo_cobranca,'') NOT IN ('pacote','plano','assinatura')
  THEN
    SELECT id INTO v_gallery_id
      FROM public.galerias
     WHERE session_id = NEW.session_id
       AND user_id = NEW.user_id
     ORDER BY (finalized_at IS NOT NULL) DESC, updated_at DESC
     LIMIT 1;

    IF v_gallery_id IS NOT NULL THEN
      NEW.galeria_id := v_gallery_id;
      NEW.finalidade := 'fotos_extras';
      RETURN NEW;
    END IF;
  END IF;

  NEW.finalidade := 'sessao';
  RETURN NEW;
END;
$$;

-- 2) default_finalidade_from_galeria — só age em finalidade NULL
CREATE OR REPLACE FUNCTION public.default_finalidade_from_galeria()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.galeria_id IS NOT NULL AND NEW.finalidade IS NULL THEN
    NEW.finalidade := 'fotos_extras';
  END IF;
  RETURN NEW;
END;
$$;

-- 3) tg_protect_no_overcharge — cobrir sessao_e_extras usando o componente correto
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
BEGIN
  IF NEW.galeria_id IS NULL OR COALESCE(NEW.valor, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.finalidade = 'fotos_extras' THEN
    v_check_valor := NEW.valor;
  ELSIF NEW.finalidade = 'sessao_e_extras' THEN
    v_check_valor := COALESCE(NEW.valor_extras_componente, 0);
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
    CASE finalidade
      WHEN 'fotos_extras'    THEN valor
      WHEN 'sessao_e_extras' THEN COALESCE(valor_extras_componente, 0)
      ELSE 0
    END
  ), 0) INTO v_pago
    FROM cobrancas
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

-- 4) sync_gallery_on_cobranca_paid — não reescrever finalidade explícita
CREATE OR REPLACE FUNCTION public.sync_gallery_on_cobranca_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_galeria_id uuid;
BEGIN
  IF NEW.status NOT IN ('pago','pago_manual') THEN RETURN NEW; END IF;
  IF OLD.status IN ('pago','pago_manual') THEN RETURN NEW; END IF;

  IF COALESCE(NEW.tipo_cobranca,'') IN ('pacote','plano','assinatura') THEN
    RETURN NEW;
  END IF;

  IF NEW.galeria_id IS NULL AND NEW.session_id IS NOT NULL AND NEW.user_id IS NOT NULL THEN
    SELECT id INTO v_galeria_id
      FROM public.galerias
     WHERE session_id = NEW.session_id
       AND user_id = NEW.user_id
     ORDER BY (finalized_at IS NOT NULL) DESC, updated_at DESC
     LIMIT 1;
    IF v_galeria_id IS NOT NULL THEN
      NEW.galeria_id := v_galeria_id;
      -- Só definir finalidade quando NULL — nunca sobrescrever 'sessao'/'sessao_e_extras'
      IF NEW.finalidade IS NULL THEN
        NEW.finalidade := 'fotos_extras';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 5) Reforço no validate_combined_charge_breakdown — checar componentes
CREATE OR REPLACE FUNCTION public.validate_combined_charge_breakdown()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_soma numeric;
BEGIN
  IF NEW.finalidade IS DISTINCT FROM 'sessao_e_extras' THEN
    RETURN NEW;
  END IF;

  IF NEW.session_id IS NULL THEN
    RAISE EXCEPTION 'Cobrança combinada exige session_id.' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.galeria_id IS NULL THEN
    RAISE EXCEPTION 'Cobrança combinada exige galeria_id.' USING ERRCODE = 'check_violation';
  END IF;
  IF COALESCE(NEW.qtd_fotos, 0) <= 0 THEN
    RAISE EXCEPTION 'Cobrança combinada exige qtd_fotos > 0.' USING ERRCODE = 'check_violation';
  END IF;
  IF COALESCE(NEW.valor, 0) <= 0 THEN
    RAISE EXCEPTION 'Cobrança combinada exige valor > 0.' USING ERRCODE = 'check_violation';
  END IF;
  IF COALESCE(NEW.valor_sessao_componente, 0) <= 0 THEN
    RAISE EXCEPTION 'Cobrança combinada exige valor_sessao_componente > 0.' USING ERRCODE = 'check_violation';
  END IF;
  IF COALESCE(NEW.valor_extras_componente, 0) <= 0 THEN
    RAISE EXCEPTION 'Cobrança combinada exige valor_extras_componente > 0.' USING ERRCODE = 'check_violation';
  END IF;

  v_soma := ROUND((COALESCE(NEW.valor_sessao_componente,0) + COALESCE(NEW.valor_extras_componente,0))::numeric, 2);
  IF ABS(v_soma - ROUND(NEW.valor::numeric, 2)) > 0.01 THEN
    RAISE EXCEPTION 'Soma dos componentes (R$%) não bate com valor total (R$%).', v_soma, NEW.valor
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
