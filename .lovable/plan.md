

# Fix Task Card Drag — Match Leads Behavior

## Problems (3 differences from Leads)

1. **DraggableTaskCard visibility**: Shows transform-based placeholder instead of hiding completely. Leads use `opacity: 0, pointerEvents: 'none'` when `isDragging || activeId === id`.

2. **No optimistic update**: `useSupabaseTasks.ts` updates local state only AFTER Supabase succeeds (line 188). Card stays in old column during network round-trip.

3. **Immediate activeId reset**: `Tarefas.tsx` calls `setActiveId(null)` synchronously. Leads wrap it in `requestAnimationFrame`.

## Changes (3 files)

### `src/components/tarefas/dnd/DraggableTaskCard.tsx`
- Match DraggableLeadCard pattern: `const isHidden = isDragging || activeId === task.id`
- Style: `isHidden ? { opacity: 0, pointerEvents: 'none' } : (transform ? { transform } : undefined)`

### `src/hooks/useSupabaseTasks.ts` — `updateTask`
- Move `setTasks(prev => ...)` to BEFORE `await supabase.update()` (optimistic)
- On error: roll back with snapshot

### `src/pages/Tarefas.tsx` — `onDragEnd`
- Wrap `setActiveId(null)` in `requestAnimationFrame`

