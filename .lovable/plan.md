

# Reverter: Metas de Lucro → Metas de Faturamento + Máscara BRL

## Resumo

Trocar todas as referências de "Meta de Lucro" para "Meta de Faturamento" no sistema de metas personalizadas. O campo `meta_faturamento` já existe na tabela — basta usá-lo em vez de `meta_lucro`. Adicionar máscara de formatação em Real (R$ 1.234,56) nos inputs de valor.

## Mudanças

### 1. `MetasConfigTab.tsx` — Trocar campo usado + máscara BRL

- Trocar todos os `lucro` no estado local para `faturamento`
- Labels: "Meta de Lucro" → "Meta de Faturamento"
- Header: "Metas de Lucro" → "Metas de Faturamento"
- Referência: "Lucro anual/mensal" → "Faturamento anual/mensal" (usar `annualGoals.revenue` em vez de `annualGoals.profit`)
- Resumo: "Total de Lucro" → "Total de Faturamento"
- Nos `handleSalvarMensal` e `handleSalvarCategorias`: salvar em `meta_faturamento` (com `meta_lucro: 0`)
- Adicionar função de máscara BRL: ao digitar, formatar como "1.234,56" em tempo real; ao salvar, converter de volta para número

### 2. `useMetasPersonalizadas.ts` — Inverter campo de referência

- `getMetaParaMes`: retornar `metaFaturamento` da meta personalizada (em vez de `metaLucro`); `metaLucro: 0`
- `getMetaAnual`: somar `meta_faturamento` em vez de `meta_lucro`
- Fallback precificação: usar `annual.revenue` em vez de `annual.profit`

### 3. `SalesGoalsCard.tsx` — Usar metaFaturamento

- As barras de progresso devem comparar receita realizada vs `metaFaturamento` (não `metaLucro`)
- Ajustar labels correspondentes

### 4. Máscara de moeda BRL (função utilitária)

Criar helper `formatCurrencyInput(value: string): string` e `parseCurrencyInput(formatted: string): number`:
- Entrada: digitar "10000" → exibir "10.000"
- Digitar "10000,50" → exibir "10.000,50"
- Ao salvar: converter "10.000,50" → 10000.50

Aplicar nos inputs de:
- Meta mensal (modo meses)
- Meta por categoria (modo categorias)

## Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/financas/MetasConfigTab.tsx` | Trocar lucro→faturamento em labels, estado, save; adicionar máscara BRL |
| `src/hooks/useMetasPersonalizadas.ts` | Inverter campo principal para faturamento |
| `src/components/analise-vendas/SalesGoalsCard.tsx` | Usar metaFaturamento nas comparações |
| `src/types/metas.ts` | Sem mudança estrutural (ambos campos já existem) |

