

# Correção: Metas não salvam — trigger bloqueia `mes = 0`

## Causa raiz

O erro **"mes must be between 1 and 12"** vem do trigger `validate_metas_personalizadas` que rejeita qualquer valor fora de 1-12. Metas por **categoria** usam `mes = 0` (indicando meta anual, sem mês específico), o que viola essa validação.

Além disso, há dois triggers duplicados para `updated_at`:
- `set_metas_personalizadas_updated_at` (usa `handle_updated_at()`)
- `trg_metas_updated_at` (usa `update_metas_updated_at()`)

## Plano

### 1. Migration SQL — Corrigir validação e limpar duplicatas

- Atualizar `validate_metas_personalizadas` para aceitar `mes = 0` (categoria anual) além de 1-12
- Remover trigger duplicado `trg_metas_updated_at` (manter apenas `set_metas_personalizadas_updated_at`)

```sql
CREATE OR REPLACE FUNCTION validate_metas_personalizadas()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.mes < 0 OR NEW.mes > 12 THEN
    RAISE EXCEPTION 'mes must be between 0 and 12';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_metas_updated_at ON public.metas_personalizadas;
DROP FUNCTION IF EXISTS update_metas_updated_at();
```

### 2. Verificação de ano no hook

O hook `useMetasPersonalizadas` já recebe `ano` como parâmetro e filtra corretamente com `.eq('ano', ano)`. O `MetasConfigTab` já tem seletor de ano. Sem mudança necessária aqui.

## Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | Alterar trigger para aceitar `mes = 0`; remover trigger duplicado |

Nenhuma mudança em código TypeScript necessária — o problema é exclusivamente no banco.

