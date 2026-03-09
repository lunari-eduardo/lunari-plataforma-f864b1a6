

# Correção definitiva do Drag-and-Drop nos Checklists

## Causa raiz (mesmo bug nos dois painéis)

O `useSortable` fornece `transform` e `transition` para **todos** os itens da lista — não só o que está sendo arrastado. Esses valores fazem os outros itens "abrirem espaço" visualmente. O código atual aplica essas propriedades **apenas quando `isDragging` é true**, o que significa que:

1. O item arrastado não se move visualmente (o DragOverlay cuida dele, mas o placeholder fica parado)
2. Os outros itens **nunca recebem transform**, então não se deslocam — o arraste parece não funcionar

```text
ERRADO (código atual):
  transform: isDragging ? CSS.Transform.toString(transform) : undefined
  transition: isDragging ? transition : undefined

CORRETO:
  transform: CSS.Transform.toString(transform)
  transition
  opacity: isDragging ? 0.3 : 1
```

## Problema adicional no ChecklistPanel (página Tarefas)

O `DndContext` está **dentro de uma tag `<ul>`**, gerando HTML inválido (DndContext renderiza `<div>` dentro de `<ul>`). Isso pode causar comportamento imprevisível no DOM.

Além disso, na página de Tarefas, o ChecklistPanel fica **aninhado dentro do DndContext do Kanban**. Contextos aninhados do dnd-kit podem interferir entre si se não forem isolados.

## Plano de correção

### 1. `src/components/tarefas/ChecklistPanel.tsx`

- **Corrigir estilo do `SortableChecklistItem`**: aplicar `transform` e `transition` incondicionalmente
- **Corrigir estrutura HTML**: mover `DndContext` para fora do `<ul>`, usar `<div>` como container
- O grip handle já existe, apenas garantir visibilidade (mudar `opacity-0` para `opacity-30`)

### 2. `src/components/workflow/WorkflowTasksPanel.tsx`

- **Corrigir estilo do `SortableTaskRow`**: mesmo fix — aplicar `transform` e `transition` incondicionalmente

### Alterações específicas

**ChecklistPanel.tsx — SortableChecklistItem (linha ~197):**
```tsx
const style = {
  transform: CSS.Transform.toString(transform),
  transition,
  opacity: isDragging ? 0.3 : 1,
};
```

**ChecklistPanel.tsx — estrutura (linhas ~131-177):**
Substituir `<ul>` por `<div>`, mover `DndContext` para envolver o container corretamente.

**WorkflowTasksPanel.tsx — SortableTaskRow (linha ~215):**
```tsx
const style = {
  transform: CSS.Transform.toString(transform),
  transition,
  opacity: isDragging ? 0.3 : 1,
};
```

**ChecklistPanel.tsx — grip handle (linha ~241):**
Mudar `opacity-0` para `opacity-30` para consistência com o workflow.

