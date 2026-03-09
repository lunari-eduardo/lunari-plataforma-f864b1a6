-- =============================================
-- SISTEMA DE FORMULÁRIOS INTELIGENTES
-- =============================================

-- 1. Tabela: formulario_templates
CREATE TABLE IF NOT EXISTS public.formulario_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID, -- NULL = template do sistema
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'geral', -- gestante, newborn, familia, casamento, geral
  descricao TEXT,
  campos JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_system BOOLEAN NOT NULL DEFAULT false,
  tempo_estimado INTEGER DEFAULT 3, -- minutos
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Tabela: formularios
CREATE TABLE IF NOT EXISTS public.formularios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  template_id UUID REFERENCES public.formulario_templates(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  titulo_cliente TEXT, -- título exibido para o cliente
  descricao TEXT,
  campos JSONB NOT NULL DEFAULT '[]'::jsonb, -- snapshot independente do template
  mensagem_conclusao TEXT DEFAULT 'Obrigado! Seu formulário foi enviado com sucesso.',
  tempo_estimado INTEGER DEFAULT 3,
  -- Vínculos
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  session_id TEXT, -- appointment_id ou session_id
  -- Status interno
  status TEXT NOT NULL DEFAULT 'rascunho', -- rascunho | publicado | arquivado
  -- Status de envio para cliente
  status_envio TEXT NOT NULL DEFAULT 'nao_enviado', -- nao_enviado | enviado | respondido | expirado
  enviado_em TIMESTAMP WITH TIME ZONE,
  respondido_em TIMESTAMP WITH TIME ZONE,
  -- Acesso público
  public_token TEXT UNIQUE DEFAULT public.generate_public_token(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Tabela: formulario_respostas
CREATE TABLE IF NOT EXISTS public.formulario_respostas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  formulario_id UUID NOT NULL REFERENCES public.formularios(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- fotógrafo dono
  respondente_nome TEXT,
  respondente_email TEXT,
  respostas JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- TRIGGERS: updated_at
-- =============================================

CREATE TRIGGER update_formulario_templates_updated_at
  BEFORE UPDATE ON public.formulario_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_task_updated_at();

CREATE TRIGGER update_formularios_updated_at
  BEFORE UPDATE ON public.formularios
  FOR EACH ROW EXECUTE FUNCTION public.update_task_updated_at();

-- =============================================
-- RLS: formulario_templates
-- =============================================

ALTER TABLE public.formulario_templates ENABLE ROW LEVEL SECURITY;

-- Templates do sistema são visíveis para todos os autenticados
CREATE POLICY "System templates visible to all authenticated"
  ON public.formulario_templates
  FOR SELECT
  TO authenticated
  USING (is_system = true OR auth.uid() = user_id);

-- Usuários podem criar seus próprios templates
CREATE POLICY "Users can create own templates"
  ON public.formulario_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Usuários podem atualizar seus próprios templates
CREATE POLICY "Users can update own templates"
  ON public.formulario_templates
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Usuários podem deletar seus próprios templates
CREATE POLICY "Users can delete own templates"
  ON public.formulario_templates
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- =============================================
-- RLS: formularios
-- =============================================

ALTER TABLE public.formularios ENABLE ROW LEVEL SECURITY;

-- Fotógrafo vê seus formulários
CREATE POLICY "Users can view own formularios"
  ON public.formularios
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Acesso público por token (anon pode ler para página pública)
CREATE POLICY "Public token access for formularios"
  ON public.formularios
  FOR SELECT
  TO anon
  USING (public_token IS NOT NULL AND status = 'publicado');

CREATE POLICY "Users can insert own formularios"
  ON public.formularios
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own formularios"
  ON public.formularios
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own formularios"
  ON public.formularios
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- =============================================
-- RLS: formulario_respostas
-- =============================================

ALTER TABLE public.formulario_respostas ENABLE ROW LEVEL SECURITY;

-- Fotógrafo vê respostas dos seus formulários
CREATE POLICY "Users can view own respostas"
  ON public.formulario_respostas
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Anon pode inserir respostas (página pública do cliente)
CREATE POLICY "Anyone can submit formulario resposta"
  ON public.formulario_respostas
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Autenticados também podem inserir (formulários internos)
CREATE POLICY "Authenticated can submit formulario resposta"
  ON public.formulario_respostas
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- =============================================
-- STORAGE BUCKET: formulario-uploads
-- =============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'formulario-uploads',
  'formulario-uploads',
  true,
  20971520, -- 20MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage
CREATE POLICY "Public can upload formulario files"
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'formulario-uploads');

CREATE POLICY "Public can view formulario files"
  ON storage.objects
  FOR SELECT
  TO anon
  USING (bucket_id = 'formulario-uploads');

CREATE POLICY "Authenticated can upload formulario files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'formulario-uploads');

CREATE POLICY "Authenticated can view formulario files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'formulario-uploads');

-- =============================================
-- SEED: TEMPLATES DO SISTEMA
-- =============================================

INSERT INTO public.formulario_templates (user_id, nome, categoria, descricao, is_system, tempo_estimado, campos)
VALUES
-- Template 1: Ensaio Gestante
(
  NULL,
  'Ensaio Gestante',
  'gestante',
  'Formulário de briefing para ensaios de gestação. Coleta informações essenciais para personalizar a sessão.',
  true,
  3,
  '[
    {"id":"g1","tipo":"data","label":"Data prevista do parto","placeholder":"Selecione a data","ordem":1,"obrigatorio":true,"descricao":"Nos ajuda a planejar o timing ideal do ensaio"},
    {"id":"g2","tipo":"texto_curto","label":"Nome do bebê (se já definido)","placeholder":"Ex: Sofia","ordem":2,"obrigatorio":false,"descricao":"Pode ser deixado em branco se ainda não foi escolhido"},
    {"id":"g3","tipo":"texto_curto","label":"Cores preferidas","placeholder":"Ex: tons terrosos, azul e branco, rosa e nude","ordem":3,"obrigatorio":false,"descricao":"Ajuda na escolha de acessórios e cenários"},
    {"id":"g4","tipo":"upload_referencia","label":"Referências de fotos","placeholder":"Envie fotos ou prints de inspiração","ordem":4,"obrigatorio":false,"descricao":"Mostre o estilo que você ama!"},
    {"id":"g5","tipo":"selecao_unica","label":"Preferência de estilo","placeholder":"","ordem":5,"obrigatorio":true,"opcoes":["Estúdio (ambiente controlado)","Lifestyle (naturalidade)","Externo (ao ar livre)","Mix de estilos"],"descricao":""},
    {"id":"g6","tipo":"texto_longo","label":"Quem participará do ensaio?","placeholder":"Ex: meu marido João, nossa filha Ana (3 anos) e nosso cachorro...","ordem":6,"obrigatorio":true,"descricao":"Nos conte sobre todos que vão participar"},
    {"id":"g7","tipo":"texto_curto","label":"Uma música que representa este momento","placeholder":"Ex: Perfect - Ed Sheeran","ordem":7,"obrigatorio":false,"descricao":"Uma curiosidade especial para lembrarmos junto com vocês"}
  ]'::jsonb
),
-- Template 2: Newborn
(
  NULL,
  'Newborn',
  'newborn',
  'Briefing completo para ensaios newborn. Garante segurança e personalização máxima.',
  true,
  2,
  '[
    {"id":"n1","tipo":"texto_curto","label":"Nome do bebê","placeholder":"Ex: Miguel","ordem":1,"obrigatorio":true,"descricao":""},
    {"id":"n2","tipo":"data","label":"Data de nascimento","placeholder":"Selecione a data","ordem":2,"obrigatorio":true,"descricao":"Essencial para calcular a idade ideal para o ensaio"},
    {"id":"n3","tipo":"texto_curto","label":"Peso ao nascer","placeholder":"Ex: 3,2 kg","ordem":3,"obrigatorio":false,"descricao":""},
    {"id":"n4","tipo":"selecao_unica","label":"O bebê nasceu prematuro?","placeholder":"","ordem":4,"obrigatorio":true,"opcoes":["Não, nasceu a termo","Sim, com menos de 37 semanas"],"descricao":"Esta informação é importante para garantir a segurança do ensaio"},
    {"id":"n5","tipo":"texto_curto","label":"Cores preferidas","placeholder":"Ex: bege, cinza, verde musgo","ordem":5,"obrigatorio":false,"descricao":""},
    {"id":"n6","tipo":"texto_longo","label":"Objetos pessoais que desejam incluir","placeholder":"Ex: ursinho de pelúcia, manta de avó, sapato do pai...","ordem":6,"obrigatorio":false,"descricao":"Itens que tornam as fotos únicas e cheias de significado"},
    {"id":"n7","tipo":"upload_referencia","label":"Referências de fotos","placeholder":"Envie fotos ou prints de inspiração","ordem":7,"obrigatorio":false,"descricao":""},
    {"id":"n8","tipo":"texto_longo","label":"Observações importantes","placeholder":"Alergias, medicamentos em uso, horários de amamentação...","ordem":8,"obrigatorio":false,"descricao":"Qualquer informação que nos ajude a cuidar bem do bebê"}
  ]'::jsonb
),
-- Template 3: Ensaio Família
(
  NULL,
  'Ensaio Família',
  'familia',
  'Briefing para ensaios de família. Captura expectativas e preferências para um resultado perfeito.',
  true,
  2,
  '[
    {"id":"f1","tipo":"texto_longo","label":"Quem participará do ensaio?","placeholder":"Ex: eu (Ana), meu marido Pedro, Maria (8 anos) e João (4 anos)","ordem":1,"obrigatorio":true,"descricao":""},
    {"id":"f2","tipo":"texto_curto","label":"Idade das crianças","placeholder":"Ex: 8 e 4 anos","ordem":2,"obrigatorio":false,"descricao":"Ajuda a planejar atividades e pausas durante o ensaio"},
    {"id":"f3","tipo":"selecao_unica","label":"Preferência de estilo","placeholder":"","ordem":3,"obrigatorio":true,"opcoes":["Formal e elegante","Casual e descontraído","Lifestyle natural","Externo (parque, campo, cidade)","Mix de estilos"],"descricao":""},
    {"id":"f4","tipo":"texto_curto","label":"Cores ou sugestão de roupas","placeholder":"Ex: tons neutros, jeans e branco, cada um numa cor diferente","ordem":4,"obrigatorio":false,"descricao":"Nos ajuda a orientar sobre a escolha de roupas"},
    {"id":"f5","tipo":"upload_referencia","label":"Referências de fotos","placeholder":"Envie fotos que vocês amam","ordem":5,"obrigatorio":false,"descricao":""},
    {"id":"f6","tipo":"texto_longo","label":"Expectativas para o ensaio","placeholder":"Ex: quero muito uma foto de todos juntos dando gargalhadas...","ordem":6,"obrigatorio":false,"descricao":"Conte o que vocês mais esperam guardar de memória"}
  ]'::jsonb
),
-- Template 4: Casamento / Evento
(
  NULL,
  'Casamento / Evento',
  'casamento',
  'Briefing para casamentos e grandes eventos. Garante que nenhum momento importante seja perdido.',
  true,
  4,
  '[
    {"id":"c1","tipo":"texto_curto","label":"Nome dos noivos / participantes principais","placeholder":"Ex: Ana e Pedro","ordem":1,"obrigatorio":true,"descricao":""},
    {"id":"c2","tipo":"texto_longo","label":"Momentos que não podem faltar","placeholder":"Ex: primeira dança, entrada dos pais, discurso do padrinho...","ordem":2,"obrigatorio":true,"descricao":"Liste tudo que é essencial para vocês"},
    {"id":"c3","tipo":"texto_curto","label":"Música importante do evento","placeholder":"Ex: música da entrada, primeira dança","ordem":3,"obrigatorio":false,"descricao":""},
    {"id":"c4","tipo":"texto_longo","label":"Pessoas importantes que precisam aparecer nas fotos","placeholder":"Ex: avó Tereza (95 anos, só pode no início), padrinho João que vem de viagem...","ordem":4,"obrigatorio":true,"descricao":"Anote especialmente pessoas com horários especiais"},
    {"id":"c5","tipo":"texto_longo","label":"Cronograma resumido","placeholder":"Ex: 16h cerimônia, 17h coquetel, 19h jantar, 20h festa...","ordem":5,"obrigatorio":false,"descricao":"Nos ajuda a organizar nossa presença"},
    {"id":"c6","tipo":"upload_referencia","label":"Referências de fotos","placeholder":"Envie fotos que inspiram o estilo que vocês querem","ordem":6,"obrigatorio":false,"descricao":""},
    {"id":"c7","tipo":"texto_longo","label":"Observações finais","placeholder":"Qualquer detalhe que queiram que saibamos...","ordem":7,"obrigatorio":false,"descricao":""}
  ]'::jsonb
);