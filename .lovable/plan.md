

# Painel de Tarefas Fixo na Borda Direita com Barra Colapsável Vertical

## Contexto

Atualmente o painel de tarefas fica dentro do flex layout como uma coluna ao lado dos cards (320-350px). Quando colapsado, vira um botão quadrado. O usuário quer que seja uma barra vertical fixa na borda direita da tela, com um mecanismo de collapse integrado — similar a um drawer lateral.

## Mudanças

### `src/pages/Workflow.tsx`

- Remover o painel de tarefas do flex layout principal (`flex-col lg:flex-row`)
- Tornar o painel `fixed right-0 top-0 h-screen` com z-index adequado
- Quando colapsado: renderizar uma barra vertical estreita fixa na borda direita (~40px) com ícone de tarefas e indicador de contagem
- Quando aberto: painel desliza da direita (~320px) com transição suave
- Ajustar `max-w-[1300px]` do conteúdo principal para não precisar compensar o painel (conteúdo ocupa 100% da largura disponível)
- Manter persistência via `usePersistedState`

### `src/components/workflow/WorkflowTasksPanel.tsx`

- Nenhuma mudança estrutural significativa — já tem `onCollapse` e botão de fechar

### Layout Visual

```text
┌─────────────────────────────────────┬──┐
│                                     │  │  ← Barra colapsada (40px)
│         Workflow Cards              │📋│     com ícone + badge
│         (largura total)             │  │
│                                     │  │
└─────────────────────────────────────┴──┘

┌──────────────────────────┬──────────────┐
│                          │              │  ← Painel aberto (320px)
│     Workflow Cards       │  Tarefas de  │     fixed right-0
│                          │  Março       │     h-screen
│                          │              │
└──────────────────────────┴──────────────┘
```

### Detalhes Técnicos

- Barra colapsada: `fixed right-0 top-[60px] bottom-0 w-10` com `border-l`, ícone `CalendarDays` rotacionado verticalmente e badge com contagem de pendentes
- Painel aberto: `fixed right-0 top-[60px] bottom-0 w-[320px]` com `transition-transform duration-200`
- O conteúdo principal não precisa de `padding-right` extra — o painel flutua sobre a área lateral que geralmente é espaço morto
- No mobile: manter comportamento empilhado (não fixo)

