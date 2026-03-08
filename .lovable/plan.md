

# Adicionar Drag-and-Drop ao ChecklistPanel da página de Tarefas

O checklist da página de tarefas já possui adicionar, excluir no hover e toggle. A funcionalidade que falta em comparação com o painel do workflow é o **arrastar e soltar para reordenar**.

## Alterações em `src/components/tarefas/ChecklistPanel.tsx`

1. **Integrar `@dnd-kit`** — Envolver a lista com `DndContext` + `SortableContext` (vertical), cada item com `useSortable`
2. **Grip handle** — Adicionar ícone `GripVertical` visível no hover para indicar que o item é arrastável
3. **Reordenação no drop** — Mesmo padrão do workflow: `transform` só no item ativo, `DragOverlay` para feedback visual, `arrayMove` no `onDragEnd`
4. **Estado local de ordem** — `orderedIds` sincronizado com a lista filtrada, reordenação visual/local
5. **Manter funcionalidades existentes** — Toggle, delete hover, hide completed, add item

### Componentes extraídos
- `SortableChecklistItem` — wrapper sortable
- `ChecklistItemContent` — conteúdo visual (checkbox, texto, delete, grip)

