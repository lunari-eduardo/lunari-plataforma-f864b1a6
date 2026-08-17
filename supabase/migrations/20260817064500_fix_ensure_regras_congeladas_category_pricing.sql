-- Corrige o trigger de congelamento de regras para consultar modelo_de_preco e tabelas_precos

CREATE OR REPLACE FUNCTION public.ensure_regras_congeladas_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_pkg RECORD;
  v_user_modelo TEXT := 'fixo';
  v_precificacao JSONB;
  v_tp RECORD;
  v_unit_inicial NUMERIC;
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

  -- 1) Descobrir o modelo ativo de precificação do usuário (fixo, global, categoria)
  SELECT modelo INTO v_user_modelo
  FROM public.modelo_de_preco
  WHERE user_id = NEW.user_id
  LIMIT 1;

  IF v_user_modelo IS NULL THEN
    v_user_modelo := 'fixo';
  END IF;

  -- 2) Montar precificacaoFotoExtra respeitando o modelo do usuário
  IF v_user_modelo = 'global' THEN
    SELECT * INTO v_tp
    FROM public.tabelas_precos
    WHERE user_id = NEW.user_id
      AND tipo = 'global'
    LIMIT 1;

    IF v_tp.id IS NOT NULL THEN
      IF COALESCE(v_tp.usar_valor_fixo_pacote, false) THEN
        v_precificacao := jsonb_build_object(
          'modelo', 'fixo',
          'valorFixo', COALESCE(v_pkg.valor_foto_extra, 0)
        );
      ELSE
        v_precificacao := jsonb_build_object(
          'modelo', 'global',
          'tabelaGlobal', jsonb_build_object(
            'id', v_tp.id,
            'user_id', v_tp.user_id,
            'nome', v_tp.nome,
            'faixas', COALESCE(v_tp.faixas, '[]'::jsonb),
            'usar_valor_fixo_pacote', COALESCE(v_tp.usar_valor_fixo_pacote, false),
            'created_at', v_tp.created_at,
            'updated_at', v_tp.updated_at
          )
        );
      END IF;
    ELSE
      v_precificacao := jsonb_build_object(
        'modelo', 'fixo',
        'valorFixo', COALESCE(v_pkg.valor_foto_extra, 0)
      );
    END IF;

  ELSIF v_user_modelo = 'categoria' AND v_pkg.categoria_id IS NOT NULL THEN
    SELECT * INTO v_tp
    FROM public.tabelas_precos
    WHERE user_id = NEW.user_id
      AND tipo = 'categoria'
      AND categoria_id = v_pkg.categoria_id
    LIMIT 1;

    IF v_tp.id IS NOT NULL THEN
      IF COALESCE(v_tp.usar_valor_fixo_pacote, false) THEN
        v_precificacao := jsonb_build_object(
          'modelo', 'fixo',
          'valorFixo', COALESCE(v_pkg.valor_foto_extra, 0)
        );
      ELSE
        v_precificacao := jsonb_build_object(
          'modelo', 'categoria',
          'tabelaCategoria', jsonb_build_object(
            'id', v_tp.id,
            'user_id', v_tp.user_id,
            'nome', v_tp.nome,
            'faixas', COALESCE(v_tp.faixas, '[]'::jsonb),
            'usar_valor_fixo_pacote', COALESCE(v_tp.usar_valor_fixo_pacote, false),
            'created_at', v_tp.created_at,
            'updated_at', v_tp.updated_at
          )
        );
      END IF;
    ELSE
      v_precificacao := jsonb_build_object(
        'modelo', 'fixo',
        'valorFixo', COALESCE(v_pkg.valor_foto_extra, 0)
      );
    END IF;

  ELSE
    v_precificacao := jsonb_build_object(
      'modelo', 'fixo',
      'valorFixo', COALESCE(v_pkg.valor_foto_extra, 0)
    );
  END IF;

  -- 3) Montar snapshot completo das regras congeladas
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
    'precificacaoFotoExtra', v_precificacao
  );

  -- 4) Calcular valor_foto_extra inicial correspondente à 1 foto extra
  v_unit_inicial := public._extra_unit_price_for_quantity(NEW.regras_congeladas, COALESCE(v_pkg.valor_foto_extra, 0), 1);
  IF v_unit_inicial IS NULL OR v_unit_inicial = 0 THEN
    v_unit_inicial := COALESCE(v_pkg.valor_foto_extra, 0);
  END IF;

  IF NEW.valor_foto_extra IS NULL OR NEW.valor_foto_extra = 0 THEN
    NEW.valor_foto_extra := v_unit_inicial;
  END IF;

  RETURN NEW;
END;
$function$;
