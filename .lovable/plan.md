

# Fix: Cards ficando atrás do painel de tarefas

## Problema

O painel de tarefas é `fixed right-0` com 320px de largura, mas o conteúdo principal só tem `lg:pr-12` (48px) de padding — insuficiente. Os cards ficam por trás do painel quando aberto.

## Solução

Em `src/pages/Workflow.tsx`:

- Tornar o `padding-right` do conteúdo principal dinâmico baseado no estado do painel:
  - Painel **aberto**: `lg:pr-[340px]` (320px do painel + 20px de respiro)
  - Painel **fechado**: `lg:pr-12` (48px para a barra colapsada de 40px)
- Aplicar transição suave no padding para acompanhar a abertura/fechamento

