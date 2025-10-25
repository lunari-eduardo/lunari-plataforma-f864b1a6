-- ============================================================
-- FASE FINAL: Ativar triggers faltantes e reparos retroativos
-- ============================================================

-- 1️⃣ CRIAR TRIGGERS FALTANTES (correção automática)
-- ============================================================

-- Trigger: garantir que appointments.type = categoria (nunca nome do pacote)
DROP TRIGGER IF EXISTS appointments_enforce_type_category ON public.appointments;
CREATE TRIGGER appointments_enforce_type_category
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_appointment_type_category();

-- Trigger: corrigir inversão categoria/pacote em clientes_sessoes
DROP TRIGGER IF EXISTS clientes_sessoes_fix_inversion ON public.clientes_sessoes;
CREATE TRIGGER clientes_sessoes_fix_inversion
  BEFORE INSERT OR UPDATE ON public.clientes_sessoes
  FOR EACH ROW
  EXECUTE FUNCTION public.fix_session_categoria_pacote_inversion();


-- 2️⃣ LIGAR TRIGGERS UTILITÁRIOS (se ainda não existirem)
-- ============================================================

-- Sincronizar data/hora: appointments → clientes_sessoes
DROP TRIGGER IF EXISTS sync_appointment_data ON public.appointments;
CREATE TRIGGER sync_appointment_data
  AFTER UPDATE OF date, time ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_appointment_to_session();

-- Limpar slots ocupados quando confirmado
DROP TRIGGER IF EXISTS cleanup_occupied_slots ON public.appointments;
CREATE TRIGGER cleanup_occupied_slots
  AFTER INSERT OR UPDATE OF status ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_occupied_availability();

-- Validar regras_congeladas em sessões
DROP TRIGGER IF EXISTS validate_frozen_rules ON public.clientes_sessoes;
CREATE TRIGGER validate_frozen_rules
  BEFORE INSERT OR UPDATE ON public.clientes_sessoes
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_regras_congeladas();

-- Recalcular total de fotos extras
DROP TRIGGER IF EXISTS recalc_fotos_extras ON public.clientes_sessoes;
CREATE TRIGGER recalc_fotos_extras
  BEFORE INSERT OR UPDATE ON public.clientes_sessoes
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_fotos_extras_total();

-- Atualizar valor_pago quando transações mudam
DROP TRIGGER IF EXISTS recompute_paid_amount ON public.clientes_transacoes;
CREATE TRIGGER recompute_paid_amount
  AFTER INSERT OR UPDATE OR DELETE ON public.clientes_transacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_recompute_session_paid();

-- Atualizar updated_at automaticamente (recriar se necessário)
DROP TRIGGER IF EXISTS update_clientes_updated_at ON public.clientes;
CREATE TRIGGER update_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_sessions_updated_at ON public.clientes_sessoes;
CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON public.clientes_sessoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_transactions_updated_at ON public.clientes_transacoes;
CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.clientes_transacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- 3️⃣ REPARO RETROATIVO (executar uma única vez)
-- ============================================================

-- A) Corrigir clientes_sessoes com inversão categoria/pacote
UPDATE public.clientes_sessoes cs
SET 
  categoria = c.nome,
  pacote = p.nome,
  updated_at = now()
FROM public.appointments a
JOIN public.pacotes p ON p.id = a.package_id::uuid
JOIN public.categorias c ON c.id = p.categoria_id
WHERE cs.appointment_id = a.id
  AND cs.user_id = a.user_id
  AND a.package_id IS NOT NULL 
  AND a.package_id != ''
  AND EXISTS (
    SELECT 1 FROM public.pacotes pcheck 
    WHERE pcheck.nome = cs.categoria 
      AND pcheck.user_id = cs.user_id
  )
  AND (cs.pacote IS NULL OR cs.pacote = '');

-- B) Corrigir appointments.type que é nome de pacote (deve ser categoria)
UPDATE public.appointments a
SET 
  type = c.nome,
  updated_at = now()
FROM public.pacotes p
JOIN public.categorias c ON c.id = p.categoria_id
WHERE a.package_id IS NOT NULL
  AND a.package_id != ''
  AND a.package_id::uuid = p.id
  AND a.user_id = p.user_id
  AND a.type = p.nome
  AND a.type != c.nome;

-- Log de conclusão
DO $$
BEGIN
  RAISE NOTICE '✅ Triggers ativados e reparos retroativos concluídos';
END $$;