# Seleção de transações no Extrato (Fluxo Financeiro)

## Problema

No extrato, clicar na bolinha de seleção não faz nada visível: a seleção é alternada duas vezes no mesmo clique e volta ao estado original.

Além disso, hoje a seleção existe para ações em massa (marcar como pago / excluir), o que não é o comportamento desejado.

## Comportamento desejado

- Clicar na bolinha seleciona/desseleciona a transação, com feedback visual claro na linha.
- A seleção serve apenas para somar os itens selecionados nas métricas superiores.
- Quando houver seleção, as métricas do topo passam a mostrar os totais do que está selecionado (entradas, saídas, saldo e quantidade), com opção de limpar a seleção.
- Sem seleção, as métricas continuam mostrando o total do período filtrado.

## Escopo da correção

1. Corrigir o duplo disparo da seleção (clique na área da bolinha + evento interno do checkbox), mantendo o clique na linha abrindo o detalhe.
2. Destacar visualmente a linha selecionada e manter a bolinha sempre visível enquanto houver seleção.
3. Somar os selecionados e exibir na barra de métricas superior, em modo "seleção" com botão de limpar.
4. Remover a barra de ações em massa (marcar como pago / excluir em lote), já que a seleção passa a ser apenas informativa.

## Detalhes técnicos

- `FluxoTimelineRow.tsx`: o wrapper da bolinha chama `onToggleSelect` e o `Checkbox` também chama via `onCheckedChange` — o clique alterna duas vezes. Manter apenas um disparo (wrapper com `stopPropagation`, checkbox somente controlado/apresentacional) e adicionar estado visual `selected` na linha.
- `FluxoFinanceiroView.tsx`: novo `useMemo` `resumoSelecao` (entradas/saídas/saldo/contagem a partir de `linhasVisiveis` filtradas por `selectedIds`); repassar para `FluxoResumoBar`; remover `FluxoBulkBar`, `handleBulkMarkPaid`, `handleBulkDelete` e `selectedFinanceLinhas`.
- `FluxoResumoBar.tsx`: aceitar `selecao` opcional; quando presente e com contagem > 0, exibir valores da seleção com rótulo indicando o modo e botão "Limpar seleção".
- Deletar `FluxoBulkBar.tsx` (sem outros consumidores).
- Nenhuma mudança de dados, hooks de extrato, queries ou banco.
