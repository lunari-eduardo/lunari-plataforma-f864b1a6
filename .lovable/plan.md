

# Plano: Top Performances reais + remover Oportunidades

## Análise da imagem
- **Amarelo** (Top Performances): valores totalmente mockados (Novembro 2024, Maria Silva, R$ 15.2k, etc.) → calcular do banco real.
- **Vermelho** (Oportunidades): Orçamentos Pendentes, Sazonalidade, Upsell — também mockados → **remover bloco inteiro**.

## Fontes de dados (todas já existentes)

Tabela `clientes_sessoes` (filtrada por `user_id`, ano selecionado, e `selectedCategory` quando ≠ 'all') já é o repositório das vendas usadas no resto do dashboard. Ela contém: `data_sessao`, `valor_total`, `categoria`, `pacote`, `cliente_id`, `tipo_registro`.

## Cálculo dos 3 cards reais

### 1. Melhor Mês
Agrupar `clientes_sessoes` do `selectedYear` (todos os meses) por `to_char(data_sessao, 'YYYY-MM')`, somar `valor_total`. Pegar o mês com maior soma. Calcular variação `+X%` comparado à **média dos demais meses do mesmo ano** (com dados >0).
- Subtítulo: `"Novembro 2025"` (mês/ano formatado em pt-BR)
- Valor (badge): `+45%` ou `R$ 12.5k` se for o único mês com dados

### 2. Melhor Serviço
Agrupar sessões do período por `categoria` (ou `pacote` quando categoria for vazia), somar `valor_total`. Pegar top 1.
- Subtítulo: nome da categoria/pacote
- Valor: total formatado como `R$ X.Xk`

### 3. Cliente Fidelizado
Agrupar por `cliente_id`, contar sessões (apenas `tipo_registro='workflow'` para excluir vendas avulsas que poluem). JOIN com `clientes` para nome. Pegar top 1.
- Subtítulo: nome do cliente
- Valor: `N sessões`

## Filtros respeitados
O bloco usa o **mesmo filtro de ano e categoria** já ativo no topo da página (`selectedYear`, `selectedCategory`). `selectedMonth` será **ignorado** para "Melhor Mês" (faz sentido olhar o ano todo); para "Melhor Serviço" e "Cliente Fidelizado", respeita o mês se houver.

## Implementação

### Novo hook: `src/hooks/useSalesTopPerformances.ts`
- Recebe `selectedYear`, `selectedMonth`, `selectedCategory`.
- Faz **1 query** a `clientes_sessoes` no período (ano todo ou mês), filtrada por user e categoria, com JOIN a `clientes(nome)`.
- Em memória: calcula 3 métricas (melhor mês, melhor serviço, cliente top).
- Retorna objeto `{ melhorMes, melhorServico, clienteFidelizado, isLoading }`.
- Cada métrica retorna `{ subtitle, value, hasData }` — se `hasData=false`, card mostra "Sem dados no período" sem badge.

### Refator `SalesInsightsSection.tsx`
- Aceitar props `selectedYear`, `selectedMonth`, `selectedCategory`.
- Chamar `useSalesTopPerformances`.
- **Remover** completamente o bloco "Oportunidades".
- Layout passa de `grid-cols-2` para uma única coluna full-width (o bloco fica mais respirável e protagonista).
- Skeleton de loading nos 3 itens.
- Empty states individuais para cada métrica.

### Update `AnaliseVendas.tsx`
- Passar `selectedYear`, `selectedMonth`, `selectedCategory` ao `<SalesInsightsSection />`.

## Anti-bugs
1. **Filtro user_id**: aplicar `eq('user_id', auth uid)` na query (RLS já exige, mas explícito por clareza).
2. **Categoria vazia**: tratar `categoria=NULL` como "Outros" no agrupamento de Melhor Serviço.
3. **Ano sem dados**: todos os 3 cards mostram "Sem dados no período" em vez de quebrar.
4. **Variação % do Melhor Mês**: se houver apenas 1 mês com dados no ano, mostrar valor absoluto (`R$ X.Xk`) em vez de `+X%` (impossível comparar).
5. **Cliente Fidelizado sem nome**: fallback para "Cliente sem nome" se JOIN não retornar nome.
6. **Performance**: query única já filtrada por período, sem N+1; usa `staleTime: 2min` como o resto.

## Arquivos modificados/criados

| Arquivo | Mudança |
|---|---|
| `src/hooks/useSalesTopPerformances.ts` | **Novo** — calcula as 3 métricas reais |
| `src/components/analise-vendas/SalesInsightsSection.tsx` | Aceita props de filtro, usa hook, remove bloco "Oportunidades", layout full-width, loading/empty states |
| `src/pages/AnaliseVendas.tsx` | Passa filtros ao componente |

