

# Painel de Tarefas Colapsável com Persistência

## Mudanças

### 1. `src/pages/Workflow.tsx`
- Adicionar `usePersistedState` para `workflow_tasks_panel_open` (default: `true`)
- Adicionar botão toggle ao lado do painel (ícone `PanelRightOpen`/`PanelRightClose`)
- Quando colapsado: esconder o `WorkflowTasksPanel`, mostrar apenas um botão estreito na lateral direita
- Quando aberto: layout atual com painel de 320-350px
- O conteúdo principal (cards) expande para ocupar o espaço livre quando o painel fecha

### 2. `src/components/workflow/WorkflowTasksPanel.tsx`
- Aceitar prop `onCollapse` para callback do botão de fechar
- Adicionar botão de colapsar no header do painel (ícone `PanelRightClose`)

### Comportamento
- Estado persistido em `sessionStorage` via `usePersistedState` (mesmo padrão dos filtros)
- Ao reabrir a página/PWA, o painel mantém o último estado (aberto/fechado)
- Transição suave com `transition-all duration-200`
- No mobile (<1024px): painel sempre visível abaixo dos cards (sem botão de colapsar)

