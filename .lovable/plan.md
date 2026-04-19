

# Plano de correção: Remover toggle do Dashboard + Melhorar UX da paginação do Extrato

## Parte 1 — Remover toggle Caixa/Competência do Dashboard

### Análise
O toggle no Dashboard adiciona complexidade sem valor claro. As métricas do Dashboard (Receita, Previsto, A Receber, Despesas, Lucro) já têm semântica natural baseada em workflow + transações pagas/agendadas. Manter o toggle apenas no Extrato (onde a separação faz sentido para análise contábil detalhada).

### Mudanças
1. **`src/components/financas/dashboard/DashboardFilters.tsx`**: remover bloco do toggle (linhas 138-171), remover imports não usados (`useRegimeContabil`, `Tabs`, `Tooltip`, `Info`).
2. **`src/hooks/useDashboardFinanceiro.ts`**: 
   - Remover `useRegimeContabil` (linha 9, 79).
   - Reverter query `dashboard-transactions-period` para usar **sempre** `data_vencimento` (regime caixa), removendo a lógica condicional de `regime === 'competencia'`.
   - Remover `regime` da queryKey.
3. **Manter** `data_competencia` na tabela `fin_transactions` e na view (não destrutivo) — continua sendo usado pelo Extrato.

## Parte 2 — Esclarecer paginação do Extrato (causa raiz da "inconsistência")

### Diagnóstico definitivo (confirmado via DB)
- Usuário tem **350 movimentações** entre 01/03 e 30/04 (157 em março + 138 entre 01-16/abril + 55 entre 17-30/abril).
- Página de 50 registros ordenada por `data DESC` → página 1 mostra apenas 17/04 a 30/04 (50 mais recentes).
- **Não é bug de filtro**. É falha de UX: o usuário interpreta a página 1 como "tudo", e a barra de paginação no rodapé passa despercebida.

### Mudanças de UX para evitar essa confusão

1. **`src/components/extrato/ExtratoTable.tsx`** — Tornar a paginação visível e o range de datas explícito:
   - **Header da seção** deixa de mostrar só `350 registros no total · Visão por Caixa`. Passa a mostrar também o range exibido nesta página: `350 movimentações no período · Página 1 de 7 · exibindo 17/04/2026 a 30/04/2026`.
   - **Banner sutil** quando há mais de 1 página, no topo da tabela: `Há mais movimentações fora desta página. Use a navegação abaixo para ver registros anteriores.` (apenas na página 1, dispensável após primeira interação via `localStorage`).
   - **Paginação reforçada** no rodapé: aumentar contraste dos botões "Anterior/Próximo", adicionar atalho "Ir para última página" e indicador visual maior do "Página X de Y".

2. **Aumentar `PAGE_SIZE` de 50 para 100** em `src/hooks/useExtrato.ts` — reduz drasticamente a chance de o usuário "não ver" todo o período de 1-2 meses em uma página. 100 linhas ainda é performante (paginação server-side preserva).

3. **(Opcional, recomendado)** — Adicionar **opção "Mostrar todos"** no rodapé do Extrato. Quando `totalCount ≤ 500`, oferecer botão "Ver todos os 350 registros nesta página" que troca `pageSize` para `totalCount`. Acima disso, manter paginação obrigatória.

## Anti-bugs

- **Não remover** `data_competencia` da view nem da tabela: o Extrato continua usando.
- **Não tocar** em `useExtratoCalculationsSupabase` ou `useExtratoSupabase`: regime continua funcional no Extrato.
- **Compatibilidade**: `useRegimeContabil` permanece (usado pelo Extrato). Apenas o Dashboard deixa de consumir.
- **localStorage `extrato_regime_default`** continua válido — quem havia escolhido "Competência" no Dashboard verá o Extrato já em Competência (consistente).

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/components/financas/dashboard/DashboardFilters.tsx` | Remover toggle Caixa/Competência e imports não usados |
| `src/hooks/useDashboardFinanceiro.ts` | Remover dependência de `regime`; query volta a filtrar sempre por `data_vencimento` |
| `src/components/extrato/ExtratoTable.tsx` | Header com range de datas da página atual, banner informativo na página 1 (dispensável), paginação visualmente reforçada |
| `src/hooks/useExtrato.ts` | `PAGE_SIZE` de 50 → 100 |
| `src/components/extrato/ExtratoTable.tsx` | (opcional) Botão "Mostrar todos" quando `totalCount ≤ 500` |

