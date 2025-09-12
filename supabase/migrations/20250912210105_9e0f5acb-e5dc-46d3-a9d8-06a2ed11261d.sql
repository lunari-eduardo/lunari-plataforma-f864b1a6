-- Adicionar colunas para fotos extras e congelamento de regras na tabela clientes_sessoes
ALTER TABLE public.clientes_sessoes 
ADD COLUMN qtd_fotos_extra integer DEFAULT 0,
ADD COLUMN valor_foto_extra numeric DEFAULT 0,
ADD COLUMN valor_total_foto_extra numeric DEFAULT 0,
ADD COLUMN regras_congeladas jsonb;

-- Criar função para recalcular valor total de fotos extras
CREATE OR REPLACE FUNCTION public.recalculate_fotos_extras_total()
RETURNS TRIGGER AS $$
BEGIN
  -- Calcula o valor total baseado na quantidade e valor unitário
  NEW.valor_total_foto_extra = NEW.qtd_fotos_extra * NEW.valor_foto_extra;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Criar trigger para recalcular automaticamente quando qtd_fotos_extra ou valor_foto_extra mudar
CREATE TRIGGER trigger_recalculate_fotos_extras
  BEFORE INSERT OR UPDATE OF qtd_fotos_extra, valor_foto_extra ON public.clientes_sessoes
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_fotos_extras_total();