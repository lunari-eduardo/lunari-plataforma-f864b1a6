---
name: Tarefas-espelho privadas ao dock do Workflow
description: Tarefas com tag `workflow:produto` são internas do dock; nunca listar em /tarefas, dashboard, agenda ou notificações. Sincronia é unidirecional Produto → Tarefa.
type: feature
---

## Regra

- Tarefas com a tag `workflow:produto` (constante `MIRROR_ROOT_TAG`) são **tarefas-espelho** geradas pelo reconciliador `useProductTaskMirror`.
- Elas existem exclusivamente para exibição no **dock lateral do Workflow**, seção "Produção".
- **NUNCA** devem aparecer em: `/tarefas` (kanban/lista), cards do dashboard, seção de tarefas da agenda, notificações.
- Fora do dock, sempre filtrar com `excludeMirror(list)` de `src/features/workflow/domain/taskClassification.ts`.

## Sincronia

- **Unidirecional**: Produto → Tarefa. O reconciliador cria/atualiza/conclui tarefas conforme o estado das etapas do produto.
- **Não existe** direção reversa. Marcar/desmarcar a tarefa-espelho no dock **não** avança nem retrocede etapas do produto.
- Etapas só podem ser alteradas pelo modal "Gerenciar produtos" no card do Workflow.

## Dock do Workflow (`WorkflowTasksPanel`)

Três seções, nessa ordem:
1. **Produção** — todas as tarefas-espelho pendentes (independente do mês/dueDate).
2. **Vencendo neste mês** — tarefas normais (não-espelho) com `dueDate` no mês corrente. Inclui CTA "Ver todas as tarefas →" para `/app/tarefas`.
3. **Concluídas** — colapsável, agrega concluídas de ambos os grupos.
