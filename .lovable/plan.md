

# Fix Categorias: Remove Color, Compact List, Fix Save

## Problems Identified

1. **Save not persisting**: The `handleBlur` triggers `handleSave()`, but when the input blurs (e.g., clicking elsewhere), the realtime subscription receives the update and overwrites local state via `useEffect` sync — this can race with the save. Also, the `handleBlur` check for `relatedTarget` may fail in some cases, causing premature saves or cancellations.

2. **Color picker not wanted**: User wants to remove the color input from both the add form and the list rows.

3. **List too spread out**: `py-3` + color input + gap makes rows tall. Need tighter spacing.

## Changes

### `src/components/configuracoes/Categorias.tsx` — Full rewrite of the component

**Add form**:
- Remove color input entirely
- Assign a default color programmatically (cycle through a preset palette based on index)
- Single row: input + "Adicionar" button

**List rows (InlineEditCategoriaRow)**:
- Remove color `<Input type="color">` — show only a small `w-3 h-3` colored dot (read-only)
- Reduce padding: `py-2 px-3` instead of `py-3 px-4`
- Fix inline editing: click name → shows input inline, Enter saves, Escape cancels, blur saves
- Fix the blur/save race: use a `savingRef` to prevent double-saves, and ensure `handleBlur` doesn't fire when clicking the delete button
- Fix hover: `hover:bg-accent/50` → `hover:bg-black/[0.04] dark:hover:bg-white/[0.08]` (neutral)
- Remove the `useEffect` that syncs props back during edit — it's the main cause of edits being overwritten

**Save logic fix**:
- The `useEffect` at line 220-225 resets `editNome`/`editCor` whenever `categoria.nome` changes AND `!isEditing`. But when `handleSave` sets `isEditing=false` and then the realtime update arrives, `isEditing` is already false and the effect runs — this is fine. The real issue: `handleBlur` fires when clicking the delete button or elsewhere, but `relatedTarget` may be null in some browsers. Fix by using a `mousedown` guard ref.

### `src/hooks/useCategorias.ts` — No changes needed (not used by the component directly)

## Technical Details

- Default color palette: `['#7950F2', '#228BE6', '#12B886', '#E64980', '#FD7E14', '#868E96', '#40C057', '#BE4BDB']`
- Color assigned as `palette[categorias.length % palette.length]` on add
- Existing categories keep their stored colors (dot still shows them)

1 file changed.

