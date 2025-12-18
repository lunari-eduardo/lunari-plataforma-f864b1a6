-- Tabela para armazenar tokens OAuth dos usuários
CREATE TABLE public.usuarios_integracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provedor TEXT NOT NULL, -- 'mercadopago', 'stripe', etc.
  access_token TEXT, -- Token de acesso
  refresh_token TEXT, -- Token de refresh (se aplicável)
  mp_user_id TEXT, -- ID do usuário no Mercado Pago
  mp_public_key TEXT, -- Public key individual
  status TEXT DEFAULT 'pendente', -- 'ativo', 'pendente', 'desconectado', 'erro'
  dados_extras JSONB DEFAULT '{}', -- Dados adicionais do provedor
  conectado_em TIMESTAMP WITH TIME ZONE,
  expira_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, provedor)
);

-- Habilitar RLS
ALTER TABLE public.usuarios_integracoes ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só acessam próprias integrações
CREATE POLICY "Users can manage own integrations" 
  ON public.usuarios_integracoes 
  FOR ALL 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_usuarios_integracoes_updated_at
  BEFORE UPDATE ON public.usuarios_integracoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_usuarios_integracoes_user_provedor ON public.usuarios_integracoes(user_id, provedor);
CREATE INDEX idx_usuarios_integracoes_mp_user_id ON public.usuarios_integracoes(mp_user_id);