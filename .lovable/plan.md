

# Fix: Drag-and-Drop no Painel de Tarefas

## Problemas Identificados

1. **Último item não pode ser arrastado para cima** — provável incompatibilidade com `closestCenter` collision detection em listas curtas
2. **Itens se reposicionam imediatamente durante o arraste** — comportamento padrão do `useSortable` que move os vizinhos em tempo real. O esperado é que a lista só reordene quando o usuário solta o item.

## Solução em `src/components/workflow/WorkflowTasksPanel.tsx`

### Corrigir collision detection
- Trocar `closestCenter` por `rectIntersection` (mais confiável para listas verticais curtas)

### Reordenar apenas no drop (não durante o arraste)
- No `SortableTaskRow`, suprimir o `transform` dos itens que **não** estão sendo arrastados — assim eles ficam parados no lugar original enquanto o usuário arrasta
- Apenas o `DragOverlay` se move seguindo o cursor
- O `arrayMove` já acontece apenas no `onDragEnd`, então a lista visual só muda ao soltar

### Mudança técnica
```tsx
// SortableTaskRow - suprimir transform em itens não-ativos
const style = {
  transform: isDragging ? CSS.Transform.toString(transform) : undefined,
  transition: isDragging ? transition : undefined,
  opacity: isDragging ? 0.4 : 1,
};
```

- Importar `rectIntersection` de `@dnd-kit/core` no lugar de `closestCenter`

