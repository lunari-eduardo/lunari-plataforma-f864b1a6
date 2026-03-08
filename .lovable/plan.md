

# Botão de Excluir + Drag-and-Drop no Painel de Tarefas do Workflow

## Mudanças em `src/components/workflow/WorkflowTasksPanel.tsx`

### 1. Botão de excluir no hover
- Adicionar ícone `Trash2` que aparece no hover de cada `TaskRow` (usando `opacity-0 group-hover:opacity-100`)
- Chamar `deleteTask` do hook `useSupabaseTasks` (já existe e está exportado)
- Posicionar à direita, substituindo o indicador de prioridade ou ao lado dele

### 2. Drag-and-drop para reordenar tarefas
- Usar `@dnd-kit/core` + `@dnd-kit/sortable` (já instalados no projeto)
- Envolver a lista de pendentes com `SortableContext` e cada `TaskRow` com `useSortable`
- No `onDragEnd`, reordenar o array local de tarefas
- Adicionar grip handle sutil (ícone `GripVertical`) visível no hover para indicar que é arrastável
- A ordenação será visual/local (não persistida no banco por enquanto, pois não há campo `sort_order` na tabela)

### Detalhes técnicos
- `DndContext` com `closestCenter` strategy e `restrictToVerticalAxis` modifier
- `SortableContext` com `verticalListSortingStrategy`
- `useSortable` no `TaskRow` para listeners e transform
- Estado local `orderedPendingTasks` derivado de `pendingTasks` com `arrayMove` no drag end

