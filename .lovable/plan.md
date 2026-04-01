

# Correção: Salvar metas + Layout 25% + Metas por categoria

## Problema 1: Metas não salvam (erro no upsert)

**Causa raiz**: O unique index usa expressão `COALESCE(categoria, '__geral__')`, mas PostgREST não suporta `onConflict` com expression-based indexes. O upsert falha silenciosamente.

**Solução**: Criar uma nova migration que:
- Remove o index com expressão
- Adiciona um unique constraint simples em `(user_id, ano, mes, categoria)` com `categoria` tendo default `'__geral__'` em vez de `NULL`
- OU: criar uma constraint simples `UNIQUE(user_id, ano, mes)` para metas gerais e manter categoria separadamente

A abordagem mais limpa: trocar `categoria NULL` por `categoria TEXT NOT NULL DEFAULT '__geral__'` e criar `UNIQUE(user_id, ano, mes, categoria)` como constraint real (não index). Assim o `onConflict: 'user_id,ano,mes,categoria'` funciona.

Atualizar o hook para incluir `categoria: '__geral__'` (em vez de `null`) e `onConflict: 'user_id,ano,mes,categoria'`.

## Problema 2: Layout — lista de meses ocupa 25% à esquerda

Redesenhar `MetasConfigTab.tsx` para layout de 2 colunas em desktop:
- **Coluna esquerda (25%)**: lista dos 12 meses como navegação vertical (mês selecionado fica highlighted)
- **Coluna direita (75%)**: formulário do mês selecionado + resumo anual

Isso melhora a UX — o usuário clica no mês e edita na direita, sem scroll de 12 linhas.

## Problema 3: Metas por categoria

Adicionar suporte a metas por categoria de sessão (ex: Newborn, Família, Infantil etc.):
- No formulário de cada mês, além da meta geral, permitir adicionar metas por categoria
- Usar as categorias já existentes no sistema (`useRealtimeConfiguration` → `categorias`)
- Salvar na mesma tabela `metas_personalizadas` com campo `categoria` preenchido

---

## Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| Nova migration SQL | Trocar index por constraint real; default `'__geral__'` |
| `src/hooks/useMetasPersonalizadas.ts` | `onConflict` corrigido; `categoria: '__geral__'`; suporte a metas por categoria |
| `src/components/financas/MetasConfigTab.tsx` | Layout 2 colunas (25%/75%); navegação por mês; seção de metas por categoria |
| `src/types/metas.ts` | Ajustar tipo para default `'__geral__'` |

## Detalhes técnicos

**Migration SQL**:
```sql
-- Remover index antigo com expressão
DROP INDEX IF EXISTS idx_metas_personalizadas_unique;

-- Converter NULLs existentes
UPDATE public.metas_personalizadas SET categoria = '__geral__' WHERE categoria IS NULL;

-- Alterar default
ALTER TABLE public.metas_personalizadas ALTER COLUMN categoria SET DEFAULT '__geral__';
ALTER TABLE public.metas_personalizadas ALTER COLUMN categoria SET NOT NULL;

-- Constraint real que PostgREST entende
ALTER TABLE public.metas_personalizadas 
  ADD CONSTRAINT metas_personalizadas_unique UNIQUE (user_id, ano, mes, categoria);
```

**Hook**: `onConflict: 'user_id,ano,mes,categoria'` com `categoria: '__geral__'` para metas gerais.

**Layout**: `grid grid-cols-[25%_1fr]` em desktop, coluna única em mobile. Lista à esquerda com meses clicáveis, formulário à direita com inputs de faturamento/lucro + seção expansível "Metas por categoria" onde o usuário pode adicionar categorias específicas.

