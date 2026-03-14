

# Fix Modal Backgrounds, Header Z-Index, and Task Card Hover

## Issues

1. **Task details modal grey background**: `.glass-modal` in `Tarefas.css` uses `rgba(255,255,255,0.80)` — translucent, not white. Plus several modals use `bg-lunar-surface` explicitly.
2. **Header never blurs behind modals**: Header is `z-50`, overlay is `z-40` — header sits above the overlay.
3. **Task card button hover**: White text on light hover makes buttons invisible. Card body has `translateY(-3px)` hover effect — user wants it removed (like Leads cards).

## Changes

### 1. Header z-index fix (`src/components/layout/Header.tsx`)
- Change header from `z-50` to `z-30` so the dialog overlay (`z-40`) covers it properly

### 2. Glass modal → white (`src/pages/Tarefas.css`)
- `.glass-modal` light: `rgba(255,255,255,0.80)` → `rgba(255,255,255,1.0)` (opaque white)
- Remove glass input overrides inside `.glass-modal` (inputs don't need translucent backgrounds in a white modal)

### 3. Remove `bg-lunar-surface` from all modal DialogContent/SelectContent/DropdownMenuContent
Files with `bg-lunar-surface` on modals:
- `src/components/tarefas/TaskFormModal.tsx` — DialogContent + 3 SelectContent + 1 DropdownMenuContent
- `src/components/tarefas/TaskDetailsModal.tsx` — 3 SelectContent + 1 DropdownMenuContent
- `src/components/tarefas/UnifiedTaskModal.tsx` — 3 SelectContent + 1 DropdownMenuContent
- `src/components/tarefas/TaskAttachmentsSection.tsx` — 2 DialogContent
- `src/components/tarefas/TaskCaptionsSection.tsx` — 1 DialogContent
- `src/components/ui/confirm-dialog.tsx` — AlertDialogContent

### 4. Task card hover fix (`src/pages/Tarefas.css`)
- Remove `transform: translateY(-3px)` from `.glass-task-card:hover` (light and dark)
- Keep the subtle background/shadow change but reduce it

### 5. Task card button hover fix (`src/components/tarefas/TaskCard.tsx`)
- "Ver detalhes" and "Concluído"/"Reabrir" buttons: change `hover:bg-white/30` to `hover:bg-black/[0.06] dark:hover:bg-white/10` so text remains visible in light mode

## Files (8)

| File | Change |
|------|--------|
| `src/components/layout/Header.tsx` | z-50 → z-30 |
| `src/pages/Tarefas.css` | White modal bg, remove card translateY hover |
| `src/components/tarefas/TaskCard.tsx` | Fix button hover colors |
| `src/components/tarefas/TaskFormModal.tsx` | Remove bg-lunar-surface from modal/selects |
| `src/components/tarefas/TaskDetailsModal.tsx` | Remove bg-lunar-surface from selects |
| `src/components/tarefas/UnifiedTaskModal.tsx` | Remove bg-lunar-surface from selects |
| `src/components/tarefas/TaskAttachmentsSection.tsx` | Remove bg-lunar-surface from dialogs |
| `src/components/tarefas/TaskCaptionsSection.tsx` | Remove bg-lunar-surface from dialog |
| `src/components/ui/confirm-dialog.tsx` | Remove bg-lunar-surface from AlertDialogContent |

