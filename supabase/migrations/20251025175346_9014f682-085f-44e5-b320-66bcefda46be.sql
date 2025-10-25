-- ============================================
-- 1) Tabela para forçar reload em todos os dispositivos
-- ============================================
CREATE TABLE IF NOT EXISTS public.app_reload_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: usuário só vê seus próprios eventos
ALTER TABLE public.app_reload_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reload events"
  ON public.app_reload_events
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reload events"
  ON public.app_reload_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 2) Função/Trigger para garantir valor_base_pacote correto
-- ============================================
CREATE OR REPLACE FUNCTION public.ensure_session_pricing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valor_base NUMERIC;
  v_pacote_nome TEXT;
  v_categoria_nome TEXT;
BEGIN
  -- Se valor_base_pacote já está OK, não fazer nada
  IF NEW.valor_base_pacote IS NOT NULL AND NEW.valor_base_pacote > 0 THEN
    RETURN NEW;
  END IF;

  -- Tentar obter de regras_congeladas primeiro
  IF NEW.regras_congeladas IS NOT NULL AND 
     NEW.regras_congeladas ? 'valorBase' THEN
    v_valor_base := (NEW.regras_congeladas->>'valorBase')::NUMERIC;
    
    IF v_valor_base > 0 THEN
      NEW.valor_base_pacote := v_valor_base;
      RAISE NOTICE 'Session % pricing from regras_congeladas: %', NEW.id, v_valor_base;
      RETURN NEW;
    END IF;
  END IF;

  -- Tentar obter via appointment_id + package_id
  IF NEW.appointment_id IS NOT NULL THEN
    BEGIN
      SELECT p.valor_base, p.nome, c.nome
      INTO v_valor_base, v_pacote_nome, v_categoria_nome
      FROM public.appointments a
      JOIN public.pacotes p ON p.id = a.package_id::UUID
      JOIN public.categorias c ON c.id = p.categoria_id
      WHERE a.id = NEW.appointment_id
        AND a.user_id = NEW.user_id
        AND a.package_id IS NOT NULL
        AND a.package_id != '';
      
      IF v_valor_base IS NOT NULL AND v_valor_base > 0 THEN
        NEW.valor_base_pacote := v_valor_base;
        
        -- Preencher categoria/pacote se estiverem vazios
        IF NEW.categoria IS NULL OR NEW.categoria = '' THEN
          NEW.categoria := v_categoria_nome;
        END IF;
        IF NEW.pacote IS NULL OR NEW.pacote = '' THEN
          NEW.pacote := v_pacote_nome;
        END IF;
        
        RAISE NOTICE 'Session % pricing from appointment package: %', NEW.id, v_valor_base;
        RETURN NEW;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Ignorar erros de cast
      NULL;
    END;
  END IF;

  -- Último recurso: tentar por nome do pacote
  IF NEW.pacote IS NOT NULL AND NEW.pacote != '' THEN
    SELECT p.valor_base
    INTO v_valor_base
    FROM public.pacotes p
    WHERE p.nome = NEW.pacote
      AND p.user_id = NEW.user_id
    LIMIT 1;
    
    IF v_valor_base IS NOT NULL AND v_valor_base > 0 THEN
      NEW.valor_base_pacote := v_valor_base;
      RAISE NOTICE 'Session % pricing from package name: %', NEW.id, v_valor_base;
      RETURN NEW;
    END IF;
  END IF;

  -- Se chegou aqui e ainda é 0, avisar
  IF NEW.valor_base_pacote IS NULL OR NEW.valor_base_pacote = 0 THEN
    RAISE WARNING 'Session % could not resolve valor_base_pacote (appointment: %, package: %)', 
      NEW.id, NEW.appointment_id, NEW.pacote;
  END IF;

  RETURN NEW;
END;
$$;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_ensure_session_pricing ON public.clientes_sessoes;
CREATE TRIGGER trigger_ensure_session_pricing
  BEFORE INSERT OR UPDATE ON public.clientes_sessoes
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_session_pricing();