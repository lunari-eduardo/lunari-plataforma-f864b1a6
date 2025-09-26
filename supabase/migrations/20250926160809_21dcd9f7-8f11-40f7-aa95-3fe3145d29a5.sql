-- Adicionar constraints únicos e índices para suportar upserts corretos
-- e garantir integridade dos dados de precificação

-- 1. Tabela modelo_de_preco: adicionar UNIQUE(user_id)
ALTER TABLE public.modelo_de_preco 
ADD CONSTRAINT modelo_de_preco_user_id_unique UNIQUE (user_id);

-- 2. Tabela tabelas_precos: adicionar índices únicos parciais
-- Garantir apenas 1 tabela global por usuário
CREATE UNIQUE INDEX tabelas_precos_global_unique 
ON public.tabelas_precos (user_id) 
WHERE tipo = 'global';

-- Garantir apenas 1 tabela por categoria por usuário  
CREATE UNIQUE INDEX tabelas_precos_categoria_unique 
ON public.tabelas_precos (user_id, categoria_id) 
WHERE tipo = 'categoria';

-- 3. Índices auxiliares para performance
CREATE INDEX IF NOT EXISTS idx_tabelas_precos_user_id 
ON public.tabelas_precos (user_id);

CREATE INDEX IF NOT EXISTS idx_tabelas_precos_categoria_id 
ON public.tabelas_precos (categoria_id) 
WHERE categoria_id IS NOT NULL;

-- 4. Garantir REPLICA IDENTITY FULL para realtime
ALTER TABLE public.modelo_de_preco REPLICA IDENTITY FULL;
ALTER TABLE public.tabelas_precos REPLICA IDENTITY FULL;

-- 5. Adicionar tabelas à publicação realtime (se necessário)
-- Verifica se já estão na publicação antes de adicionar
DO $$
BEGIN
    -- Adicionar modelo_de_preco se não estiver na publicação
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'modelo_de_preco'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.modelo_de_preco;
    END IF;
    
    -- Adicionar tabelas_precos se não estiver na publicação
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'tabelas_precos'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tabelas_precos;
    END IF;
END $$;