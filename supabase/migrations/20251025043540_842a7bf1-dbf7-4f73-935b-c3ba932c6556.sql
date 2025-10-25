-- =========================================
-- FASE 1: TRIGGERS PARA APPOINTMENTS
-- =========================================

-- Trigger para garantir que appointments.type seja sempre a categoria (não o nome do pacote)
CREATE OR REPLACE FUNCTION public.enforce_appointment_type_category()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_categoria_nome text;
  v_pacote_nome text;
BEGIN
  -- Se tiver package_id, buscar a categoria (CAST para uuid)
  IF NEW.package_id IS NOT NULL AND NEW.package_id != '' THEN
    BEGIN
      SELECT c.nome, p.nome
      INTO v_categoria_nome, v_pacote_nome
      FROM public.pacotes p
      JOIN public.categorias c ON c.id = p.categoria_id
      WHERE p.id = NEW.package_id::uuid AND p.user_id = NEW.user_id;
      
      IF v_categoria_nome IS NOT NULL THEN
        -- Setar type como categoria
        NEW.type = v_categoria_nome;
        
        RAISE NOTICE 'Appointment type set to category: % (package: %)', v_categoria_nome, v_pacote_nome;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Ignorar se package_id não for UUID válido
      NULL;
    END;
  ELSE
    -- Se não tiver pacote mas type for nome de pacote, corrigir para 'Sessão'
    IF EXISTS (
      SELECT 1 FROM public.pacotes 
      WHERE nome = NEW.type AND user_id = NEW.user_id
    ) THEN
      NEW.type = 'Sessão';
      RAISE NOTICE 'Appointment type corrected from package name to Sessão';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Aplicar trigger
DROP TRIGGER IF EXISTS trigger_enforce_appointment_type ON public.appointments;
CREATE TRIGGER trigger_enforce_appointment_type
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_appointment_type_category();


-- =========================================
-- FASE 2: TRIGGERS PARA CLIENTES_SESSOES
-- =========================================

-- Trigger para corrigir inversão de categoria/pacote em clientes_sessoes
CREATE OR REPLACE FUNCTION public.fix_session_categoria_pacote_inversion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_categoria_nome text;
  v_pacote_nome text;
  v_is_inverted boolean := false;
BEGIN
  -- Detectar inversão: categoria é nome de pacote
  IF EXISTS (
    SELECT 1 FROM public.pacotes 
    WHERE nome = NEW.categoria AND user_id = NEW.user_id
  ) THEN
    v_is_inverted := true;
  END IF;
  
  -- Se detectou inversão E tiver appointment_id com package_id válido, corrigir
  IF v_is_inverted AND NEW.appointment_id IS NOT NULL THEN
    BEGIN
      SELECT c.nome, p.nome
      INTO v_categoria_nome, v_pacote_nome
      FROM public.appointments a
      JOIN public.pacotes p ON p.id = a.package_id::uuid
      JOIN public.categorias c ON c.id = p.categoria_id
      WHERE a.id = NEW.appointment_id 
        AND a.user_id = NEW.user_id
        AND a.package_id IS NOT NULL 
        AND a.package_id != '';
      
      IF v_categoria_nome IS NOT NULL THEN
        NEW.categoria = v_categoria_nome;
        NEW.pacote = v_pacote_nome;
        
        RAISE NOTICE 'Session % corrected: categoria=% pacote=%', NEW.id, v_categoria_nome, v_pacote_nome;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Ignorar erros de cast
      NULL;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Aplicar trigger
DROP TRIGGER IF EXISTS trigger_fix_session_inversion ON public.clientes_sessoes;
CREATE TRIGGER trigger_fix_session_inversion
  AFTER INSERT OR UPDATE ON public.clientes_sessoes
  FOR EACH ROW
  EXECUTE FUNCTION public.fix_session_categoria_pacote_inversion();


-- =========================================
-- FASE 3: REPARO RETROATIVO DE DADOS
-- =========================================

-- Corrigir appointments com type errado (nome de pacote em vez de categoria)
UPDATE public.appointments a
SET type = c.nome
FROM public.pacotes p
JOIN public.categorias c ON c.id = p.categoria_id
WHERE p.id = a.package_id::uuid
  AND a.user_id = p.user_id
  AND a.package_id IS NOT NULL
  AND a.package_id != ''
  AND a.type = p.nome -- type está como nome do pacote
  AND a.type != c.nome; -- e não é a categoria

-- Corrigir clientes_sessoes com inversão (categoria=nome pacote, pacote vazio)
UPDATE public.clientes_sessoes cs
SET 
  categoria = c.nome,
  pacote = p.nome
FROM public.appointments a
JOIN public.pacotes p ON p.id = a.package_id::uuid
JOIN public.categorias c ON c.id = p.categoria_id
WHERE cs.appointment_id = a.id
  AND cs.user_id = a.user_id
  AND a.package_id IS NOT NULL
  AND a.package_id != ''
  AND cs.categoria = p.nome -- categoria está como nome do pacote
  AND (cs.pacote IS NULL OR cs.pacote = ''); -- pacote está vazio

-- Log de resultado
DO $$
BEGIN
  RAISE NOTICE '✅ Triggers criados e dados retroativos corrigidos';
END $$;