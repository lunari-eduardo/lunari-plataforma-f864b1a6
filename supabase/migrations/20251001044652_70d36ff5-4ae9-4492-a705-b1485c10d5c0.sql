-- Configure Realtime for all configuration and workflow tables
-- This enables real-time subscriptions to work properly

-- Set REPLICA IDENTITY FULL for all tables (ensures complete row data in realtime events)
ALTER TABLE IF EXISTS public.categorias REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.pacotes REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.produtos REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.etapas_trabalho REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.clientes REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.clientes_sessoes REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.clientes_transacoes REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.clientes_familia REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.clientes_documentos REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.appointments REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.availability_slots REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.modelo_de_preco REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.tabelas_precos REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.pricing_configs REPLICA IDENTITY FULL;

-- Add all tables to supabase_realtime publication (idempotent - won't error if already added)
DO $$
BEGIN
  -- Check if tables are already in publication, if not add them
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'categorias'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.categorias;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'pacotes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pacotes;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'produtos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.produtos;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'etapas_trabalho'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.etapas_trabalho;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'clientes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.clientes;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'clientes_sessoes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.clientes_sessoes;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'clientes_transacoes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.clientes_transacoes;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'clientes_familia'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.clientes_familia;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'clientes_documentos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.clientes_documentos;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'appointments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'availability_slots'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.availability_slots;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'modelo_de_preco'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.modelo_de_preco;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'tabelas_precos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tabelas_precos;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'pricing_configs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pricing_configs;
  END IF;
END $$;