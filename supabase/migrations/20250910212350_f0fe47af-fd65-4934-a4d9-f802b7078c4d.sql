-- Enable realtime for all configuration tables
ALTER TABLE public.categorias REPLICA IDENTITY FULL;
ALTER TABLE public.pacotes REPLICA IDENTITY FULL;
ALTER TABLE public.produtos REPLICA IDENTITY FULL;
ALTER TABLE public.etapas_trabalho REPLICA IDENTITY FULL;
ALTER TABLE public.tabelas_precos REPLICA IDENTITY FULL;
ALTER TABLE public.modelo_de_preco REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.categorias;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pacotes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.produtos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.etapas_trabalho;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tabelas_precos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.modelo_de_preco;