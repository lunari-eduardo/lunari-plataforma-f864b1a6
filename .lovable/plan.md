

# Fix Dropdown Hover: Neutral Gray Instead of Accent Brown

## Root Cause

- `--accent` = terracotta brown (`19 49% 45%`)
- `--accent-foreground` = near-white (`30 30% 98%`)
- CommandItem uses `data-[selected='true']:bg-accent/20` and `data-[selected=true]:text-accent-foreground`
- All workflow combobox items use `hover:bg-accent/10`
- Result: brown hover background + white/invisible text in light mode

## Fix

### 1. `src/components/ui/command.tsx` — CommandItem base class

Replace accent-based selected/hover with neutral gray:
- `data-[selected='true']:bg-accent/20` → `data-[selected='true']:bg-black/[0.04] dark:data-[selected='true']:bg-white/[0.08]`
- `data-[selected=true]:text-accent-foreground` → `data-[selected=true]:text-foreground`

### 2. Workflow combobox files — Replace `hover:bg-accent/10`

All items in these files use `hover:bg-accent/10` which produces a brownish hover. Replace with `hover:bg-black/[0.04] dark:hover:bg-white/[0.08]`:

- `WorkflowPackageCombobox.tsx` (lines 125, 148)
- `ProductCombobox.tsx` (lines 93, 108)
- `PackageCombobox.tsx` (line 78)
- `CategoryCombobox.tsx` (line 69)
- `GerenciarProdutosModal.tsx` (line 409): `hover:bg-accent` → `hover:bg-black/[0.04] dark:hover:bg-white/[0.08]`

### 3. `src/components/ui/dropdown-menu.tsx` — DropdownMenuItem

The `focus:bg-accent focus:text-accent-foreground` on DropdownMenuItem also produces brown+white-text. Replace with:
- `focus:bg-black/[0.04] dark:focus:bg-white/[0.08] focus:text-foreground`

Same for DropdownMenuCheckboxItem, DropdownMenuRadioItem, DropdownMenuSubTrigger.

### Visual Result

- Light mode: hover = very subtle gray (`rgba(0,0,0,0.04)`), text stays dark
- Dark mode: hover = subtle white glow (`rgba(255,255,255,0.08)`), text stays light
- No more brown backgrounds or white text on hover

7 files, className-only changes.

