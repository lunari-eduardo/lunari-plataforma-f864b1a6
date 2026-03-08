

# Layout do Workflow: Cards 70% + Painel de Tarefas Lateral

## Visão Geral

Reestruturar a página Workflow para um layout split-view: cards ocupando ~70% (max ~1300px) à esquerda e um painel de tarefas inteligente (~30%) à direita no desktop. Em mobile/tablet, layout empilhado com scroll horizontal nos cards.

## Arquitetura

```text
Desktop (≥1024px):
┌─────────────────────────────┬──────────────┐
│  Métricas / Mês / Filtros   │              │
├─────────────────────────────┤  Painel de   │
│  QuickAdd                   │  Tarefas     │
├─────────────────────────────┤  do Mês      │
│  Cards (scroll vertical)    │  (~30%)      │
│  min-w: 1100px              │              │
│  max-w: ~1300px             │              │
│  overflow-x: auto           │              │
└─────────────────────────────┴──────────────┘

Mobile/Tablet (<1024px):
┌─────────────────────────────┐
│  Métricas / Mês / Filtros   │
├─────────────────────────────┤
│  Cards (scroll horizontal)  │
├─────────────────────────────┤
│  Painel de Tarefas (full)   │
└─────────────────────────────┘
```

## Mudanças

### 1. `src/pages/Workflow.tsx`
- Envolver o conteúdo principal (métricas + mês + filtros + tabela) e o novo painel em um layout `flex` horizontal no desktop
- Lado esquerdo: conteúdo atual, com `flex-1` e `max-w-[1300px]` ou ~70%
- Lado direito: novo componente `WorkflowTasksPanel` com `w-[350px]` fixo no desktop
- Em mobile/tablet: `flex-col` com o painel abaixo

### 2. `src/components/workflow/WorkflowTasksPanel.tsx` (NOVO)
- Componente placeholder para o painel lateral de tarefas do mês
- Recebe `currentMonth` como prop para filtrar tarefas relevantes
- Layout inicial: header com título "Tarefas do Mês", lista de tarefas com checkboxes, botão de adicionar
- Integrar com o sistema de tarefas existente (`src/types/tasks.ts`) filtrando por mês
- Estilo glassmorphism consistente com os cards do workflow
- Sticky no desktop (`sticky top-0 h-screen overflow-y-auto`)

### 3. `src/components/workflow/WorkflowCardList.tsx`
- Remover `min-w-[1100px]` do wrapper individual dos cards (manter no container interno para scroll horizontal em mobile)
- Cards devem respeitar a largura do container pai sem forçar overflow no desktop

## Comportamento Responsivo

| Viewport | Cards | Painel |
|----------|-------|--------|
| Desktop ≥1280px | Lado esquerdo, flex-1 | Sidebar direita, w-[350px] |
| Desktop 1024-1279px | Lado esquerdo, flex-1 | Sidebar direita, w-[300px] |
| Tablet/Mobile <1024px | Full width, scroll-x | Abaixo dos cards, full width |

## Arquivos

| Arquivo | Ação |
|---------|------|
| `src/pages/Workflow.tsx` | Reestruturar layout com flex horizontal + painel lateral |
| `src/components/workflow/WorkflowTasksPanel.tsx` | Criar componente do painel de tarefas |
| `src/components/workflow/WorkflowCardList.tsx` | Ajustar largura dos cards para respeitar container |

