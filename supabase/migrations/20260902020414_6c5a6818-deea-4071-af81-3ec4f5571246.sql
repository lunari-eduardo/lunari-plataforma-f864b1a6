-- 1) Deduplicar eventuais entradas manuais repetidas (mantém a mais antiga)
DELETE FROM public.clientes_transacoes t
USING public.clientes_transacoes k
WHERE t.session_id IS NOT NULL
  AND t.tipo = 'pagamento'
  AND t.descricao = 'Entrada do agendamento'
  AND t.cobranca_id IS NULL
  AND k.session_id = t.session_id
  AND k.tipo = 'pagamento'
  AND k.descricao = 'Entrada do agendamento'
  AND k.cobranca_id IS NULL
  AND (k.created_at, k.id) < (t.created_at, t.id);

-- 2) Índice único: no máximo uma entrada manual por sessão
CREATE UNIQUE INDEX IF NOT EXISTS uniq_transacao_entrada_agendamento
  ON public.clientes_transacoes (session_id)
  WHERE tipo = 'pagamento'
    AND descricao = 'Entrada do agendamento'
    AND cobranca_id IS NULL;

-- 3) Trigger que sincroniza o sinal do agendamento com a transação da sessão
CREATE OR REPLACE FUNCTION public.sync_appointment_deposit_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paid        NUMERIC := COALESCE(NEW.paid_amount, 0);
  v_old_paid    NUMERIC := CASE WHEN TG_OP = 'UPDATE' THEN COALESCE(OLD.paid_amount, 0) ELSE 0 END;
  v_session     RECORD;
  v_tx_id       UUID;
BEGIN
  IF NEW.session_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.status, '') <> 'confirmado' THEN
    RETURN NEW;
  END IF;

  SELECT id, cliente_id INTO v_session
    FROM public.clientes_sessoes
   WHERE session_id = NEW.session_id
     AND user_id = NEW.user_id
   LIMIT 1;

  -- Sem sessão no Workflow ainda: nada a fazer (o trigger roda de novo no próximo update)
  IF v_session.id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_tx_id
    FROM public.clientes_transacoes
   WHERE session_id = NEW.session_id
     AND user_id = NEW.user_id
     AND tipo = 'pagamento'
     AND descricao = 'Entrada do agendamento'
     AND cobranca_id IS NULL
   LIMIT 1;

  IF v_paid > 0 THEN
    IF v_tx_id IS NULL THEN
      INSERT INTO public.clientes_transacoes (
        user_id, cliente_id, session_id, tipo, valor, valor_liquido,
        data_transacao, descricao
      ) VALUES (
        NEW.user_id,
        COALESCE(NEW.cliente_id, v_session.cliente_id),
        NEW.session_id,
        'pagamento',
        v_paid,
        v_paid,
        NEW.date,
        'Entrada do agendamento'
      );
    ELSE
      UPDATE public.clientes_transacoes
         SET valor = v_paid,
             valor_liquido = v_paid,
             data_transacao = NEW.date,
             cliente_id = COALESCE(NEW.cliente_id, cliente_id),
             updated_at = now()
       WHERE id = v_tx_id
         AND (valor IS DISTINCT FROM v_paid OR data_transacao IS DISTINCT FROM NEW.date);
    END IF;
  ELSIF v_paid = 0 AND v_old_paid > 0 AND v_tx_id IS NOT NULL THEN
    -- Só remove quando o valor foi explicitamente zerado neste UPDATE
    DELETE FROM public.clientes_transacoes WHERE id = v_tx_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zz_sync_appointment_deposit ON public.appointments;
CREATE TRIGGER trg_zz_sync_appointment_deposit
AFTER INSERT OR UPDATE OF paid_amount, status, session_id ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.sync_appointment_deposit_transaction();

-- 4) A criação da sessão não pode mais zerar o valor pago
CREATE OR REPLACE FUNCTION public.ensure_workflow_session_on_confirm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    UPDATE public.clientes_sessoes s
       SET appointment_id = COALESCE(s.appointment_id, NEW.id),
           categoria = CASE WHEN COALESCE(s.categoria, '') IN ('', 'Sessão') THEN v_categoria ELSE s.categoria END,
           pacote = COALESCE(NULLIF(s.pacote, ''), v_pkg.nome),
           descricao = COALESCE(NULLIF(s.descricao, ''), NEW.description),
           status = CASE WHEN COALESCE(s.status, '') IN ('', 'stub') THEN 'agendada' ELSE s.status END,
           valor_base_pacote = CASE WHEN COALESCE(s.valor_base_pacote, 0) = 0 THEN v_valor_base ELSE s.valor_base_pacote END,
           valor_total = GREATEST(COALESCE(s.valor_total, 0), v_valor_base),
           valor_foto_extra = CASE WHEN COALESCE(s.valor_foto_extra, 0) = 0 THEN COALESCE(v_pkg.valor_foto_extra, 0) ELSE s.valor_foto_extra END,
           produtos_incluidos = CASE WHEN s.produtos_incluidos IS NULL OR s.produtos_incluidos = '[]'::jsonb
                                     THEN COALESCE(v_pkg.produtos_incluidos, '[]'::jsonb) ELSE s.produtos_incluidos END,
           updated_at = now()
     WHERE s.id = v_session.id;
  END IF;

  -- Recalcula o valor pago a partir das transações já existentes da sessão
  PERFORM public.recompute_session_paid(NEW.session_id);

  RETURN NEW;
END;
$$;

-- 5) Backfill: agendamentos confirmados com entrada informada e sem transação
INSERT INTO public.clientes_transacoes (
  user_id, cliente_id, session_id, tipo, valor, valor_liquido,
  data_transacao, descricao
)
SELECT a.user_id,
       COALESCE(a.cliente_id, s.cliente_id),
       a.session_id,
       'pagamento',
       a.paid_amount,
       a.paid_amount,
       a.date,
       'Entrada do agendamento'
  FROM public.appointments a
  JOIN public.clientes_sessoes s
    ON s.session_id = a.session_id AND s.user_id = a.user_id
 WHERE a.status = 'confirmado'
   AND COALESCE(a.paid_amount, 0) > 0
   AND NOT EXISTS (
     SELECT 1 FROM public.clientes_transacoes t
      WHERE t.session_id = a.session_id
        AND t.tipo = 'pagamento'
        AND t.descricao = 'Entrada do agendamento'
        AND t.cobranca_id IS NULL
   );

-- 6) Recalcular valor_pago das sessões afetadas
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT a.session_id
      FROM public.appointments a
      JOIN public.clientes_sessoes s ON s.session_id = a.session_id
     WHERE a.status = 'confirmado' AND COALESCE(a.paid_amount, 0) > 0
  LOOP
    PERFORM public.recompute_session_paid(r.session_id);
  END LOOP;
END $$;
