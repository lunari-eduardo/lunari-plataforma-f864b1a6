
-- 1) Confirmar agendamento também em pagamento manual e em INSERT já pago
CREATE OR REPLACE FUNCTION public.tg_cobranca_confirm_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.session_id IS NOT NULL
     AND NEW.status IN ('pago', 'pago_manual')
     AND COALESCE(OLD.status, '') NOT IN ('pago', 'pago_manual') THEN
    UPDATE public.appointments a
       SET status = 'confirmado',
           updated_at = now()
     WHERE (a.session_id = NEW.session_id
            OR a.id::text = REPLACE(NEW.session_id, 'agenda-', ''))
       AND a.user_id = NEW.user_id
       AND COALESCE(a.status, '') IN ('a confirmar', 'pendente');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_cobranca_confirm_appointment ON public.cobrancas;
CREATE TRIGGER trg_cobranca_confirm_appointment
AFTER INSERT OR UPDATE OF status ON public.cobrancas
FOR EACH ROW EXECUTE FUNCTION public.tg_cobranca_confirm_appointment();

-- 2) Materializar/hidratar a sessão do Workflow quando o agendamento é confirmado
CREATE OR REPLACE FUNCTION public.ensure_workflow_session_on_confirm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_session RECORD;
  v_pkg RECORD;
  v_categoria TEXT;
  v_valor_base NUMERIC := 0;
BEGIN
  IF COALESCE(NEW.status, '') <> 'confirmado' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.status, '') = 'confirmado' THEN
    RETURN NEW;
  END IF;
  IF NEW.session_id IS NULL OR NEW.cliente_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- dados do pacote (quando houver)
  IF NEW.package_id IS NOT NULL AND NEW.package_id <> '' THEN
    BEGIN
      SELECT p.*, c.nome AS categoria_nome
        INTO v_pkg
        FROM public.pacotes p
        LEFT JOIN public.categorias c ON c.id = p.categoria_id
       WHERE p.id::text = NEW.package_id
         AND p.user_id = NEW.user_id
       LIMIT 1;
    EXCEPTION WHEN others THEN
      v_pkg := NULL;
    END;
  END IF;

  v_categoria := COALESCE(NULLIF(v_pkg.categoria_nome, ''), NULLIF(NEW.type, ''), 'Sessão');
  v_valor_base := COALESCE(v_pkg.valor_base, 0);

  SELECT * INTO v_session
    FROM public.clientes_sessoes
   WHERE user_id = NEW.user_id
     AND (appointment_id = NEW.id OR session_id = NEW.session_id)
   LIMIT 1;

  IF v_session.id IS NULL THEN
    INSERT INTO public.clientes_sessoes (
      user_id, cliente_id, session_id, appointment_id, data_sessao, hora_sessao,
      categoria, pacote, descricao, status, valor_total, valor_base_pacote,
      valor_pago, valor_foto_extra, produtos_incluidos, tipo_registro
    ) VALUES (
      NEW.user_id, NEW.cliente_id, NEW.session_id, NEW.id, NEW.date, NEW.time,
      v_categoria, v_pkg.nome, NEW.description, 'agendada',
      GREATEST(v_valor_base, COALESCE(NEW.paid_amount, 0)), v_valor_base,
      0, COALESCE(v_pkg.valor_foto_extra, 0), COALESCE(v_pkg.produtos_incluidos, '[]'::jsonb), 'workflow'
    );
  ELSE
    -- completa o stub criado apenas para viabilizar a cobrança de entrada
    UPDATE public.clientes_sessoes s
       SET appointment_id = COALESCE(s.appointment_id, NEW.id),
           categoria = CASE WHEN COALESCE(s.categoria, '') IN ('', 'Sessão') THEN v_categoria ELSE s.categoria END,
           pacote = COALESCE(NULLIF(s.pacote, ''), v_pkg.nome),
           descricao = COALESCE(NULLIF(s.descricao, ''), NEW.description),
           status = CASE WHEN COALESCE(s.status, '') = '' THEN 'agendada' ELSE s.status END,
           valor_base_pacote = CASE WHEN COALESCE(s.valor_base_pacote, 0) = 0 THEN v_valor_base ELSE s.valor_base_pacote END,
           valor_total = GREATEST(COALESCE(s.valor_total, 0), v_valor_base),
           valor_foto_extra = CASE WHEN COALESCE(s.valor_foto_extra, 0) = 0 THEN COALESCE(v_pkg.valor_foto_extra, 0) ELSE s.valor_foto_extra END,
           produtos_incluidos = CASE WHEN s.produtos_incluidos IS NULL OR s.produtos_incluidos = '[]'::jsonb
                                     THEN COALESCE(v_pkg.produtos_incluidos, '[]'::jsonb) ELSE s.produtos_incluidos END,
           updated_at = now()
     WHERE s.id = v_session.id;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_ensure_workflow_session_on_confirm ON public.appointments;
CREATE TRIGGER trg_ensure_workflow_session_on_confirm
AFTER INSERT OR UPDATE OF status ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.ensure_workflow_session_on_confirm();

-- 3) Fallback: resolver sessão pelo appointment quando cobrança não achar direto
CREATE OR REPLACE FUNCTION public.auto_confirm_appointment_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.valor_pago > COALESCE(OLD.valor_pago, 0)
     AND NEW.session_id IS NOT NULL THEN
    UPDATE public.appointments
       SET status = 'confirmado',
           updated_at = now()
     WHERE session_id = NEW.session_id
       AND COALESCE(status, '') IN ('a confirmar', 'pendente')
       AND user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$function$;
