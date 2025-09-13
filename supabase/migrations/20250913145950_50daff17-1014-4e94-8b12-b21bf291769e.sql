-- Create triggers for clientes_sessoes table to ensure data consistency

-- Trigger for automatic recalculation of extra photo totals
CREATE OR REPLACE FUNCTION public.recalculate_fotos_extras_total()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate total value based on quantity and unit value
  IF NEW.qtd_fotos_extra IS NOT NULL AND NEW.valor_foto_extra IS NOT NULL THEN
    NEW.valor_total_foto_extra = NEW.qtd_fotos_extra * NEW.valor_foto_extra;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to clientes_sessoes table
CREATE TRIGGER trigger_recalculate_fotos_extras_total
    BEFORE INSERT OR UPDATE OF qtd_fotos_extra, valor_foto_extra
    ON public.clientes_sessoes
    FOR EACH ROW
    EXECUTE FUNCTION public.recalculate_fotos_extras_total();

-- Trigger for updating updated_at timestamp
CREATE TRIGGER trigger_update_clientes_sessoes_updated_at
    BEFORE UPDATE ON public.clientes_sessoes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for better performance on session queries
CREATE INDEX IF NOT EXISTS idx_clientes_sessoes_user_data 
ON public.clientes_sessoes (user_id, data_sessao DESC);

-- Add index for better performance on extra photo calculations
CREATE INDEX IF NOT EXISTS idx_clientes_sessoes_extra_photos 
ON public.clientes_sessoes (user_id, qtd_fotos_extra) 
WHERE qtd_fotos_extra > 0;