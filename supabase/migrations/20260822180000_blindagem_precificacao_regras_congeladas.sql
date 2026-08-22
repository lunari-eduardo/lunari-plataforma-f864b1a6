-- Migration: 20260822180000_blindagem_precificacao_regras_congeladas.sql
-- Atualiza o trigger ensure_regras_congeladas_on_insert() para blindagem híbrida
-- com fallbacks inteligentes quando categoria não possui tabela ou possui pacote zerado.

CREATE OR REPLACE FUNCTION public.ensure_regras_congeladas_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pkg RECORD;
  v_modelo_preco TEXT := 'fixo';
  v_tabela RECORD;
  v_precificacao JSONB;
  v_tabela_global RECORD;
  v_unit_fallback NUMERIC := 0;
  v_unit_inicial NUMERIC;
BEGIN
  -- Só age quando regras_congeladas está ausente ou sem .pacote
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

  -- Consultar modelo_de_preco configurado para o fotógrafo
  SELECT COALESCE(modelo, 'fixo')
  INTO v_modelo_preco
  FROM public.modelo_de_preco
  WHERE user_id = NEW.user_id
  LIMIT 1;

  IF v_modelo_preco IS NULL THEN
    v_modelo_preco := 'fixo';
  END IF;

  -- Buscar tabela global de backup caso necessária para fallbacks
  SELECT id, nome, faixas, usar_valor_fixo_pacote
  INTO v_tabela_global
  FROM public.tabelas_precos
  WHERE user_id = NEW.user_id
    AND tipo = 'global'
  LIMIT 1;

  -- Determinar valor de foto extra unitário do pacote (se existir)
  v_unit_fallback := COALESCE(v_pkg.valor_foto_extra, 0);

  -- Montar precificacaoFotoExtra baseado no modelo ativo com blindagem
  IF v_modelo_preco = 'categoria' AND v_pkg.categoria_id IS NOT NULL THEN
    SELECT id, nome, faixas, usar_valor_fixo_pacote
    INTO v_tabela
    FROM public.tabelas_precos
    WHERE user_id = NEW.user_id
      AND tipo = 'categoria'
      AND categoria_id = v_pkg.categoria_id
    LIMIT 1;

    IF v_tabela.id IS NOT NULL THEN
      IF v_tabela.usar_valor_fixo_pacote THEN
        -- Categoria usa valor fixo do pacote
        -- Se o pacote tiver valor > 0, usa ele. Se não, tenta tabela global como fallback seguro.
        IF v_unit_fallback > 0 THEN
          v_precificacao := jsonb_build_object(
            'modelo', 'fixo',
            'valorFixo', v_unit_fallback
          );
        ELSIF v_tabela_global.id IS NOT NULL AND NOT COALESCE(v_tabela_global.usar_valor_fixo_pacote, false) THEN
          v_precificacao := jsonb_build_object(
            'modelo', 'global',
            'tabelaGlobal', jsonb_build_object(
              'id', v_tabela_global.id,
              'nome', v_tabela_global.nome,
              'faixas', COALESCE(v_tabela_global.faixas, '[]'::jsonb),
              'usar_valor_fixo_pacote', false
            )
          );
        ELSE
          v_precificacao := jsonb_build_object(
            'modelo', 'fixo',
            'valorFixo', v_unit_fallback
          );
        END IF;
      ELSE
        -- Tabela progressiva da categoria ativa
        v_precificacao := jsonb_build_object(
          'modelo', 'categoria',
          'tabelaCategoria', jsonb_build_object(
            'id', v_tabela.id,
            'nome', v_tabela.nome,
            'faixas', COALESCE(v_tabela.faixas, '[]'::jsonb),
            'usar_valor_fixo_pacote', COALESCE(v_tabela.usar_valor_fixo_pacote, false)
          )
        );
      END IF;
    ELSE
      -- Categoria sem tabela configurada:
      -- 1. Se pacote tem valor > 0, congela como fixo usando o pacote
      -- 2. Se pacote for 0, tenta usar a Tabela Global progressiva (se houver)
      IF v_unit_fallback > 0 THEN
        v_precificacao := jsonb_build_object(
          'modelo', 'fixo',
          'valorFixo', v_unit_fallback
        );
      ELSIF v_tabela_global.id IS NOT NULL AND NOT COALESCE(v_tabela_global.usar_valor_fixo_pacote, false) THEN
        v_precificacao := jsonb_build_object(
          'modelo', 'global',
          'tabelaGlobal', jsonb_build_object(
            'id', v_tabela_global.id,
            'nome', v_tabela_global.nome,
            'faixas', COALESCE(v_tabela_global.faixas, '[]'::jsonb),
            'usar_valor_fixo_pacote', false
          )
        );
      ELSE
        v_precificacao := jsonb_build_object(
          'modelo', 'fixo',
          'valorFixo', v_unit_fallback
        );
      END IF;
    END IF;

  ELSIF v_modelo_preco = 'global' THEN
    IF v_tabela_global.id IS NOT NULL THEN
      IF COALESCE(v_tabela_global.usar_valor_fixo_pacote, false) THEN
        v_precificacao := jsonb_build_object(
          'modelo', 'fixo',
          'valorFixo', v_unit_fallback
        );
      ELSE
        v_precificacao := jsonb_build_object(
          'modelo', 'global',
          'tabelaGlobal', jsonb_build_object(
            'id', v_tabela_global.id,
            'nome', v_tabela_global.nome,
            'faixas', COALESCE(v_tabela_global.faixas, '[]'::jsonb),
            'usar_valor_fixo_pacote', false
          )
        );
      END IF;
    ELSE
      v_precificacao := jsonb_build_object(
        'modelo', 'fixo',
        'valorFixo', v_unit_fallback
      );
    END IF;

  ELSE
    -- Modelo fixo
    v_precificacao := jsonb_build_object(
      'modelo', 'fixo',
      'valorFixo', v_unit_fallback
    );
  END IF;

  NEW.regras_congeladas := jsonb_build_object(
    'modelo', 'completo',
    'dataCongelamento', to_jsonb(now()),
    'pacote', jsonb_build_object(
      'id', v_pkg.id,
      'nome', v_pkg.nome,
      'valorBase', COALESCE(v_pkg.valor_base, 0),
      'valorFotoExtra', v_unit_fallback,
      'fotosIncluidas', COALESCE(v_pkg.fotos_incluidas, 0),
      'categoria', COALESCE(v_pkg.categoria_nome, 'Sessão'),
      'categoriaId', v_pkg.categoria_id,
      'produtosIncluidos', COALESCE(v_pkg.produtos_incluidos, '[]'::jsonb)
    ),
    'produtos', COALESCE(v_pkg.produtos_incluidos, '[]'::jsonb),
    'precificacaoFotoExtra', v_precificacao
  );

  -- Calcular o valor_foto_extra inicial para a coluna da sessão usando a regra congelada
  v_unit_inicial := public._extra_unit_price_for_quantity(NEW.regras_congeladas, v_unit_fallback, 1);
  IF v_unit_inicial IS NULL OR v_unit_inicial = 0 THEN
    v_unit_inicial := v_unit_fallback;
  END IF;

  IF NEW.valor_foto_extra IS NULL OR NEW.valor_foto_extra = 0 THEN
    NEW.valor_foto_extra := v_unit_inicial;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_regras_congeladas_on_insert ON public.clientes_sessoes;
CREATE TRIGGER trg_ensure_regras_congeladas_on_insert
BEFORE INSERT ON public.clientes_sessoes
FOR EACH ROW
EXECUTE FUNCTION public.ensure_regras_congeladas_on_insert();
