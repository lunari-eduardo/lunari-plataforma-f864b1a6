-- Migration: 20260826190000_fix_all_extra_charges_triggers.sql
-- Description: Corrige as duas triggers da tabela cobrancas para permitir cobranças de fotos extras
-- criadas pelo fotógrafo no Workflow/CRM (com session_id), com ou sem galeria vinculada.

-- 1. Desbloqueia tg_cobrancas_no_orphan_extra para cobranças com session_id
CREATE OR REPLACE FUNCTION public.tg_cobrancas_no_orphan_extra()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Permite cobrança de fotos_extras sem galeria se estiver vinculada a uma sessão (Workflow/CRM)
  IF NEW.session_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Permite a transição galeria_id -> NULL durante exclusão da galeria (cascata da FK)
  IF TG_OP = 'UPDATE' AND OLD.galeria_id IS NOT NULL AND NEW.galeria_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Linha já era órfã antes deste update: não bloquear updates subsequentes
  IF TG_OP = 'UPDATE'
     AND OLD.finalidade = 'fotos_extras'
     AND OLD.galeria_id IS NULL
     AND NEW.finalidade = 'fotos_extras'
     AND NEW.galeria_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Só bloqueia se NÃO tem sessão NEM galeria (órfã absoluta sem nenhum vínculo)
  IF NEW.finalidade = 'fotos_extras'
     AND NEW.galeria_id IS NULL
     AND NEW.session_id IS NULL
     AND COALESCE(NEW.status, 'pendente') NOT IN ('cancelado', 'expirado') THEN
    RAISE EXCEPTION 'COBRANCA_EXTRA_ORFA: cobrança de fotos_extras requer session_id ou galeria_id'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Desbloqueia tg_protect_no_overcharge para cobranças originadas do Workflow (com session_id)
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
  -- 1) Sem galeria vinculada OU valor zero -> nada a validar
  IF NEW.galeria_id IS NULL OR COALESCE(NEW.valor, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  -- 2) Se possui session_id (originada do Workflow / Gestão), o fotógrafo
  -- tem autoridade total para definir/alterar o valor de extras e negociar com o cliente.
  -- A trava anti-overcharge aplica-se exclusivamente ao checkout público da galeria (onde session_id IS NULL).
  IF NEW.session_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Validação padrão para checkout da galeria pública
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
