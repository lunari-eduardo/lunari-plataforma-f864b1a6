-- FASE 5: Trigger para validar regras_congeladas
-- Função de validação
CREATE OR REPLACE FUNCTION validate_regras_congeladas()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se é INSERT ou UPDATE, validar que regras_congeladas não é NULL
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    IF NEW.regras_congeladas IS NULL OR 
       NOT (NEW.regras_congeladas ? 'modelo') OR
       NOT (NEW.regras_congeladas ? 'pacote') THEN
      
      RAISE WARNING 'Sessão sem regras_congeladas completas: %', NEW.id;
      
      -- Não bloquear, apenas avisar (para não quebrar fluxo)
      -- Em produção, considerar bloquear com RAISE EXCEPTION
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger
DROP TRIGGER IF EXISTS trigger_validate_regras_congeladas ON clientes_sessoes;
CREATE TRIGGER trigger_validate_regras_congeladas
  BEFORE INSERT OR UPDATE ON clientes_sessoes
  FOR EACH ROW
  EXECUTE FUNCTION validate_regras_congeladas();