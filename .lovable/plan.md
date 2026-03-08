

# Fix: Drag-and-Drop não funciona no checklist do Workflow

## Problema

O `DndContext` está dentro de um `ScrollArea` (Radix), que usa um viewport com `overflow: scroll` que captura os eventos de ponteiro antes do `PointerSensor` do dnd-kit conseguir ativá-los. Isso impede o arraste de funcionar.

## Solução em `src/components/workflow/WorkflowTasksPanel.tsx`

1. **Substituir `ScrollArea` por `div` com overflow nativo** — Trocar o componente `<ScrollArea>` por um `<div className="flex-1 min-h-0 overflow-y-auto">` para que o scroll não interfira com os eventos de ponteiro do dnd-kit.

2. **Tornar o grip handle sempre visível (sutil)** — Mudar a opacidade base do ícone de `opacity-0` para `opacity-30` no `group-hover:opacity-60`, garantindo que o handle seja descobrível mesmo sem hover prolongado.

## Escopo

- Apenas `src/components/workflow/WorkflowTasksPanel.tsx`
- Mesma correção conceitual que já funciona no `ChecklistPanel.tsx` (que não usa `ScrollArea`)

