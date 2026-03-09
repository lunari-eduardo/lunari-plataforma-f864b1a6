

# Fix: DragOverlay não se move no Workflow

## Causa raiz

A `div` container do painel (linha 109) tem `backdrop-blur-xl` e `backdrop-saturate-[1.8]`. Em CSS, **`backdrop-filter` cria um novo containing block** — qualquer elemento com `position: fixed` dentro dele passa a ser posicionado relativo a esse container, não ao viewport.

O `DragOverlay` do dnd-kit usa `position: fixed` para seguir o cursor. Como está renderizado **dentro** do container com `backdrop-filter`, ele fica preso e não se move visualmente.

O item fica esmaecido (opacity 0.3 funciona) mas o clone "fantasma" que deveria seguir o mouse fica invisível ou preso no canto do container.

## Solução

**Renderizar o `DragOverlay` via `createPortal` para `document.body`**, escapando do containing block criado pelo `backdrop-filter`.

### Alteração em `WorkflowTasksPanel.tsx`

```tsx
import { createPortal } from "react-dom";

// Dentro do JSX, trocar:
<DragOverlay dropAnimation={null}>
  {activeTask ? (...) : null}
</DragOverlay>

// Por:
{createPortal(
  <DragOverlay dropAnimation={null}>
    {activeTask ? (...) : null}
  </DragOverlay>,
  document.body
)}
```

Mesma correção deve ser aplicada no `ChecklistPanel.tsx` caso ele esteja dentro de um container com `backdrop-filter` (verificar e aplicar preventivamente).

## Escopo

- `src/components/workflow/WorkflowTasksPanel.tsx` — portal no DragOverlay
- `src/components/tarefas/ChecklistPanel.tsx` — mesma correção preventiva

