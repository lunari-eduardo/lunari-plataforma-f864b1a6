
-- CAMADA C: BEFORE INSERT trigger que reconstrói regras_congeladas quando
-- pacote existe no banco mas a sessão foi criada sem congelamento.
CREATE OR REPLACE FUNCTION public.ensure_regras_congeladas_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pkg RECORD;
BEGIN
  -- Só age quando regras_congeladas está ausente/sem .pacote
  IF NEW.regras_congeladas IS NOT NULL
     AND jsonb_typeof(NEW.regras_congeladas->'pacote') = 'object' THEN
    RETURN NEW;
  END IF;

  -- Precisa de pelo menos um identificador do pacote
  IF (NEW.pacote IS NULL OR NEW.pacote = '') AND NEW.appointment_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Buscar pacote via appointment_id ou nome
  SELECT p.id, p.nome, p.valor_base, p.valor_foto_extra,
         p.fotos_incluidas, p.categoria_id, p.produtos_incluidos,
         c.nome AS categoria_nome
  INTO v_pkg
  FROM public.pacotes p
  LEFT JOIN public.categorias c ON c.id = p.categoria_id
  WHERE p.user_id = NEW.user_id
    AND (
      (NEW.appointment_id IS NOT NULL AND p.id::text = (
        SELECT package_id FROM public.appointments
        WHERE id = NEW.appointment_id AND user_id = NEW.user_id
      ))
      OR (NEW.pacote IS NOT NULL AND p.nome = NEW.pacote)
    )
  LIMIT 1;

  IF v_pkg.id IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.regras_congeladas := jsonb_build_object(
    'modelo', 'completo',
    'dataCongelamento', to_jsonb(now()),
    'pacote', jsonb_build_object(
      'id', v_pkg.id,
      'nome', v_pkg.nome,
      'valorBase', COALESCE(v_pkg.valor_base, 0),
      'valorFotoExtra', COALESCE(v_pkg.valor_foto_extra, 0),
      'fotosIncluidas', COALESCE(v_pkg.fotos_incluidas, 0),
      'categoria', COALESCE(v_pkg.categoria_nome, 'Sessão'),
      'categoriaId', v_pkg.categoria_id,
      'produtosIncluidos', COALESCE(v_pkg.produtos_incluidos, '[]'::jsonb)
    ),
    'produtos', COALESCE(v_pkg.produtos_incluidos, '[]'::jsonb),
    'precificacaoFotoExtra', jsonb_build_object(
      'modelo', 'fixo',
      'valorFixo', COALESCE(v_pkg.valor_foto_extra, 0)
    )
  );

  IF NEW.valor_foto_extra IS NULL OR NEW.valor_foto_extra = 0 THEN
    NEW.valor_foto_extra := COALESCE(v_pkg.valor_foto_extra, 0);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_regras_congeladas_on_insert ON public.clientes_sessoes;
CREATE TRIGGER trg_ensure_regras_congeladas_on_insert
BEFORE INSERT ON public.clientes_sessoes
FOR EACH ROW
EXECUTE FUNCTION public.ensure_regras_congeladas_on_insert();
