
-- =====================================================
-- REFORÇO DE SEGURANÇA RLS - Tabelas Críticas
-- =====================================================
-- Este script reforça as políticas RLS para garantir 
-- isolamento multiusuário adequado nas tabelas sensíveis
-- =====================================================

-- 1. USUARIOS_INTEGRACOES (contém tokens OAuth - CRÍTICO)
-- =====================================================
DROP POLICY IF EXISTS "Users can manage own integrations" ON public.usuarios_integracoes;

-- Política restritiva apenas para usuários autenticados
CREATE POLICY "Authenticated users can manage own integrations"
ON public.usuarios_integracoes
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2. COBRANCAS (contém dados de pagamento - CRÍTICO)
-- =====================================================
DROP POLICY IF EXISTS "Users can manage their own charges" ON public.cobrancas;

CREATE POLICY "Authenticated users can manage own charges"
ON public.cobrancas
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3. CLIENTES (contém PII - CRÍTICO)
-- =====================================================
DROP POLICY IF EXISTS "Users can manage their own clients" ON public.clientes;

CREATE POLICY "Authenticated users can manage own clients"
ON public.clientes
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. CLIENTES_TRANSACOES (histórico financeiro - CRÍTICO)
-- =====================================================
DROP POLICY IF EXISTS "Users can manage their own transactions" ON public.clientes_transacoes;

CREATE POLICY "Authenticated users can manage own transactions"
ON public.clientes_transacoes
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 5. CLIENTES_SESSOES (dados de sessões - IMPORTANTE)
-- =====================================================
DROP POLICY IF EXISTS "Users can manage their own sessions" ON public.clientes_sessoes;

CREATE POLICY "Authenticated users can manage own sessions"
ON public.clientes_sessoes
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 6. PROFILES (dados pessoais do usuário)
-- =====================================================
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Authenticated users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 7. LEADS (contém PII)
-- =====================================================
DROP POLICY IF EXISTS "Users can manage their own leads" ON public.leads;

CREATE POLICY "Authenticated users can manage own leads"
ON public.leads
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 8. APPOINTMENTS (dados de agendamentos)
-- =====================================================
DROP POLICY IF EXISTS "Users can manage their own appointments" ON public.appointments;

CREATE POLICY "Authenticated users can manage own appointments"
ON public.appointments
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 9. FINANCIAL_ITEMS (dados financeiros)
-- =====================================================
DROP POLICY IF EXISTS "Users can manage their own financial items" ON public.financial_items;

CREATE POLICY "Authenticated users can manage own financial items"
ON public.financial_items
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 10. FIN_TRANSACTIONS (transações financeiras)
-- =====================================================
DROP POLICY IF EXISTS "Users can manage their own fin transactions" ON public.fin_transactions;

CREATE POLICY "Authenticated users can manage own fin transactions"
ON public.fin_transactions
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 11. FIN_CREDIT_CARDS (cartões de crédito)
-- =====================================================
DROP POLICY IF EXISTS "Users can manage their own credit cards" ON public.fin_credit_cards;

CREATE POLICY "Authenticated users can manage own credit cards"
ON public.fin_credit_cards
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 12. FIN_RECURRING_BLUEPRINTS (despesas recorrentes)
-- =====================================================
DROP POLICY IF EXISTS "Users can manage their own recurring blueprints" ON public.fin_recurring_blueprints;

CREATE POLICY "Authenticated users can manage own recurring blueprints"
ON public.fin_recurring_blueprints
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 13. FIN_ITEMS_MASTER (itens financeiros)
-- =====================================================
DROP POLICY IF EXISTS "Users can manage their own fin items master" ON public.fin_items_master;

CREATE POLICY "Authenticated users can manage own fin items master"
ON public.fin_items_master
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 14. AVAILABILITY_SLOTS (disponibilidade)
-- =====================================================
DROP POLICY IF EXISTS "Users can manage their own availability" ON public.availability_slots;

CREATE POLICY "Authenticated users can manage own availability"
ON public.availability_slots
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 15. CUSTOM_TIME_SLOTS (horários personalizados)
-- =====================================================
DROP POLICY IF EXISTS "Users can manage their own custom time slots" ON public.custom_time_slots;

CREATE POLICY "Authenticated users can manage own custom time slots"
ON public.custom_time_slots
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 16. CLIENTES_DOCUMENTOS (documentos de clientes)
-- =====================================================
DROP POLICY IF EXISTS "Users can manage their own client documents" ON public.clientes_documentos;

CREATE POLICY "Authenticated users can manage own client documents"
ON public.clientes_documentos
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 17. CLIENTES_FAMILIA (família de clientes)
-- =====================================================
DROP POLICY IF EXISTS "Users can manage their own client families" ON public.clientes_familia;

CREATE POLICY "Authenticated users can manage own client families"
ON public.clientes_familia
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
