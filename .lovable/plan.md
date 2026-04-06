

# Correção: Metas inteligentes na Análise de Vendas

## Problema

O `SalesGoalsCard` **não recebe `selectedCategory`** e usa `useWorkflowMetricsRealtime` que **não filtra por categoria**. Resultado: quando o usuário filtra "Dia das Mães", a receita mostrada nos KPIs (R$ 80) vem do `salesMetrics` (filtrado), mas a meta compara contra o valor total sem filtro — ou pior, a receita da meta vem do hook sem filtro, mostrando 100% incorretamente.

Além disso, sempre mostra Mensal + Anual independente do contexto de filtro.

## Regras de comportamento

| Filtro ativo | Meta exibida |
|---|---|
| Ano todo, sem categoria | **Anual** — soma de metas mensais ou meta da precificação |
| Mês específico, sem categoria | **Mensal** — meta do mês ou precificação/12 |
| Categoria específica (qualquer mês) | **Categoria** — meta cadastrada para aquela categoria (modo categorias) |
| Mês + Categoria | **Categoria** — meta da categoria (ignora mês, pois metas por categoria são anuais) |

Quando progresso > 100%, mostrar valor e % excedente (ex: "120% · +R$ 5k").

## Mudanças

### 1. `AnaliseVendas.tsx` — Passar `selectedCategory` ao `SalesGoalsCard`

```tsx
<SalesGoalsCard 
  selectedYear={selectedYear} 
  selectedMonth={selectedMonth} 
  selectedCategory={selectedCategory}
/>
```

### 2. `SalesGoalsCard.tsx` — Refatorar lógica de metas

- Receber `selectedCategory` como prop
- **Não usar mais `useWorkflowMetricsRealtime`** para receita — receber `currentRevenue` do `salesMetrics.totalRevenue` (já filtrado por categoria/mês)
- Lógica condicional:
  - Se `selectedCategory !== 'all'` → buscar meta da categoria via `getMetaParaCategoria(categoriaId)` (novo método no hook)
  - Se `selectedMonth !== null` e categoria é "all" → mostrar apenas meta mensal
  - Se `selectedMonth === null` e categoria é "all" → mostrar apenas meta anual
- Remover `Math.min(..., 100)` no progress — permitir > 100%
- Quando > 100%: mostrar "120%" em verde + badge "+R$ Xk" com valor excedente

### 3. `useMetasPersonalizadas.ts` — Adicionar `getMetaParaCategoria`

Novo método:
```ts
getMetaParaCategoria(categoriaName: string): MetaResolvidaParaPeriodo
```
- Se `modoMetas === 'categoria'` e `usarPersonalizadas`: buscar em `metasPorCategoria` onde `categoria === categoriaName` e `mes === 0`
- Fallback: sem meta (retorna 0, sem barra)

### 4. `AnaliseVendas.tsx` — Passar `salesMetrics.totalRevenue` ao `SalesGoalsCard`

Para evitar duplicar queries de receita, passar a receita já calculada:
```tsx
<SalesGoalsCard 
  selectedYear={selectedYear} 
  selectedMonth={selectedMonth} 
  selectedCategory={selectedCategory}
  currentRevenue={salesMetrics.totalRevenue}
/>
```

### 5. UI do excedente

Quando `progress > 100`:
- Barra cheia em verde
- Texto: "132%" em verde
- Badge extra: "+R$ 8k" mostrando o valor acima da meta

## Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `src/pages/AnaliseVendas.tsx` | Passar `selectedCategory` e `currentRevenue` |
| `src/components/analise-vendas/SalesGoalsCard.tsx` | Lógica condicional de meta, remover hooks de métricas duplicados, UI excedente |
| `src/hooks/useMetasPersonalizadas.ts` | Adicionar `getMetaParaCategoria()` |

