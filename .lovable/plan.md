

# Corrigir Criação de Tarefas no Painel do Workflow

## Problema

Ao criar uma tarefa no painel, o `dueDate` é forçado para o dia 1 do mês atual (`format(monthStart, "yyyy-MM-dd")`). A imagem mostra uma tarefa criada dia 08/03 com prazo 01/03, que já aparece como "Vencida há 7 dia(s)".

Além disso, o filtro `monthTasks` descarta tarefas sem `dueDate` (linha 35: `if (!t.dueDate) return false`), o que impediria tarefas sem prazo de aparecerem no painel.

## Mudanças

### `src/components/workflow/WorkflowTasksPanel.tsx`

1. **Remover `dueDate` da criação** — tarefas criadas no painel não terão prazo por padrão
2. **Ajustar filtro `monthTasks`** — incluir tarefas sem `dueDate` que foram criadas no mês atual (usando `createdAt`), além das que têm `dueDate` no mês
3. **Separar visualmente** — tarefas com prazo mostram a data; tarefas sem prazo aparecem normalmente sem indicação de vencimento

### Lógica do filtro atualizada

```
monthTasks = tasks que:
  - têm dueDate dentro do mês atual, OU
  - não têm dueDate E foram criadas (createdAt) dentro do mês atual
```

Isso garante que tarefas criadas no painel apareçam no mês correto sem prazo artificial.

