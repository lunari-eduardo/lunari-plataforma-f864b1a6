

# Correção: Metas na Análise de Vendas — 3 problemas

## Problemas identificados

### 1. Categoria não mostra meta (Empty state)
**Causa**: Metas por categoria são salvas com `categoria = UUID` (ex: `"a1b2c3..."`), mas o filtro da Análise de Vendas passa o **nome** da categoria (ex: `"Gestantes"`). `getMetaParaCategoria("Gestantes")` nunca encontra match porque compara nome com UUID.

### 2. Meta anual mostra 78% em vez de ~23%
**Causa**: `getMetaAnual()` quando `modoMetas === 'categoria'` soma as metas por categoria (35k + 25k = 60k). R$ 47.065 / R$ 60.000 = 78%. Mas o usuário espera que a visão "ano todo" use a meta da precificação (R$ 200k). R$ 47.065 / R$ 200.173 = ~23%.

### 3. Falta valor R$ nas métricas
Atualmente mostra apenas "78%" — precisa mostrar também "R$ 47k / R$ 200k".

## Plano

### 1. `SalesGoalsCard.tsx` — Resolver mismatch nome/UUID

O card precisa converter o nome da categoria para UUID antes de chamar `getMetaParaCategoria`. Duas opções:
- **Opção A**: Passar as categorias com IDs do MetasConfigTab — complexo, envolve vários componentes
- **Opção B (escolhida)**: Buscar as categorias de sessão no hook e fazer lookup por nome

Adicionar ao `useMetasPersonalizadas` um método que aceita nome e faz o match interno, ou carregar as categorias no `SalesGoalsCard` para converter nome→ID.

**Solução mais simples**: Alterar `getMetaParaCategoria` para aceitar tanto nome quanto ID. O hook já tem `metasPorCategoria` com os IDs. Precisamos carregar a lista de categorias de sessão no hook para fazer o mapeamento.

Na prática: no `SalesGoalsCard`, carregar categorias de sessão e converter `selectedCategory` (nome) para UUID antes de chamar `getMetaParaCategoria`.

### 2. `useMetasPersonalizadas.ts` — `getMetaAnual` usar precificação sempre

Quando o filtro é "ano todo" sem categoria, a meta deve ser sempre da precificação (referência base do negócio), independente do modo ativo. Alterar `getMetaAnual`:

```
getMetaAnual():
  → Sempre retornar GoalsIntegrationService.getAnnualGoals().revenue
  → Origem: 'precificacao'
```

Metas personalizadas (mensal ou categoria) só se aplicam quando há filtro específico ativo.

### 3. `SalesGoalsCard.tsx` — Mostrar valor R$ junto à porcentagem

Alterar a linha de cada meta para exibir: `R$ 47k / R$ 200k` antes da porcentagem. Layout:

```
Anual  ████████░░░░░░░░░░  R$ 47k / R$ 200k  23%  📊 268d
```

## Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/analise-vendas/SalesGoalsCard.tsx` | Carregar categorias de sessão, converter nome→UUID, adicionar R$ atual/meta |
| `src/hooks/useMetasPersonalizadas.ts` | Simplificar `getMetaAnual` para sempre usar precificação |

