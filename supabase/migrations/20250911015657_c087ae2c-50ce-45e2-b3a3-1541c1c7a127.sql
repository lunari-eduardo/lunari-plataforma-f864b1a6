-- FASE 2: RELACIONAMENTOS + MÉTRICAS + SessionID
-- Tabelas de relacionamento para agendamentos, sessões e transações

-- Tabela de agendamentos vinculados a clientes
CREATE TABLE public.appointments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  session_id text NOT NULL,
  title text NOT NULL,
  date date NOT NULL,
  time text NOT NULL,
  type text NOT NULL,
  status text DEFAULT 'a confirmar' CHECK (status IN ('a confirmar', 'confirmado')),
  description text,
  package_id text,
  paid_amount numeric DEFAULT 0,
  orcamento_id uuid,
  origem text DEFAULT 'agenda' CHECK (origem IN ('agenda', 'orcamento')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de sessões de trabalho/projetos
CREATE TABLE public.clientes_sessoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  session_id text NOT NULL UNIQUE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  orcamento_id uuid,
  data_sessao date NOT NULL,
  hora_sessao text NOT NULL,
  categoria text NOT NULL,
  pacote text,
  descricao text,
  status text DEFAULT 'agendado',
  valor_total numeric DEFAULT 0,
  valor_pago numeric DEFAULT 0,
  produtos_incluidos jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de transações financeiras detalhadas
CREATE TABLE public.clientes_transacoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  session_id text REFERENCES public.clientes_sessoes(session_id),
  tipo text NOT NULL CHECK (tipo IN ('pagamento', 'desconto', 'ajuste')),
  valor numeric NOT NULL,
  descricao text,
  data_transacao date NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes_sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes_transacoes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for appointments
CREATE POLICY "Users can manage their own appointments" 
ON public.appointments 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS Policies for clientes_sessoes
CREATE POLICY "Users can manage their own sessions" 
ON public.clientes_sessoes 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS Policies for clientes_transacoes
CREATE POLICY "Users can manage their own transactions" 
ON public.clientes_transacoes 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_appointments_user_id ON public.appointments(user_id);
CREATE INDEX idx_appointments_cliente_id ON public.appointments(cliente_id);
CREATE INDEX idx_appointments_session_id ON public.appointments(session_id);
CREATE INDEX idx_appointments_date ON public.appointments(date);

CREATE INDEX idx_clientes_sessoes_user_id ON public.clientes_sessoes(user_id);
CREATE INDEX idx_clientes_sessoes_cliente_id ON public.clientes_sessoes(cliente_id);
CREATE INDEX idx_clientes_sessoes_session_id ON public.clientes_sessoes(session_id);
CREATE INDEX idx_clientes_sessoes_data_sessao ON public.clientes_sessoes(data_sessao);

CREATE INDEX idx_clientes_transacoes_user_id ON public.clientes_transacoes(user_id);
CREATE INDEX idx_clientes_transacoes_cliente_id ON public.clientes_transacoes(cliente_id);
CREATE INDEX idx_clientes_transacoes_session_id ON public.clientes_transacoes(session_id);
CREATE INDEX idx_clientes_transacoes_data ON public.clientes_transacoes(data_transacao);

-- Triggers for updated_at
CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clientes_sessoes_updated_at
  BEFORE UPDATE ON public.clientes_sessoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable real-time replication
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clientes_sessoes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clientes_transacoes;

-- Set replica identity for real-time updates
ALTER TABLE public.appointments REPLICA IDENTITY FULL;
ALTER TABLE public.clientes_sessoes REPLICA IDENTITY FULL;
ALTER TABLE public.clientes_transacoes REPLICA IDENTITY FULL;