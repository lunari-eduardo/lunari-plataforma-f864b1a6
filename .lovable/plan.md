

# Plan: Workflow Visual Fixes and Metrics Improvement

## Issues Identified

1. **Description input too wide**: Uses `1fr` in the grid, making it fill all remaining space. Different text lengths cause cards to misalign.
2. **Layout shift on month change**: Cards render with different description widths before settling, causing a visible "flash".
3. **Metrics bar looks sparse**: Four plain text values on the left, eye toggle isolated on far right — poor visual hierarchy.
4. **Minor alignment inconsistencies** between card columns.

## Changes

### 1. Fix Description Input — `WorkflowCardCollapsed.tsx`

**Desktop grid** (line 310): Change `1fr` to a fixed width for description (e.g., `200px`) and give `1fr` to name column instead, or cap description with `max-w-[200px]`:

- Change grid template from `36px_50px_180px_1fr_150px_140px_90px_80px_90px_auto` to `36px_50px_180px_200px_150px_140px_90px_80px_90px_auto`
- Make the description input fixed-width with `max-w-[200px]`, `text-xs`, and allow up to 2 lines via a `textarea` (rows=1, auto-expand to 2) or simply truncate with `line-clamp-2`
- Use a simpler approach: keep `Input` but constrain its container to fixed width, add `truncate` on overflow

**Tablet grid** (line 456): Same fix — constrain description column width.

### 2. Prevent Layout Flash — `WorkflowCardCollapsed.tsx`

- Add `min-h-[56px]` to the card row container (line 307) so all cards have a consistent minimum height regardless of content
- This prevents layout shift when cards load with different description lengths

### 3. Redesign Metrics Bar — `Workflow.tsx` (lines 812-857)

Replace the current sparse text layout with a compact, styled bar:

- Group all 4 metrics + eye toggle into a single row with a subtle background (`bg-muted/50 rounded-lg p-3`)
- Each metric gets a colored dot indicator instead of just text color
- Eye toggle button sits right next to the metrics (not on the far right)
- When hidden, show a minimal "Mostrar métricas" link instead of an isolated icon

Layout:
```text
┌─────────────────────────────────────────────────────────┐
│ ● Receita R$ 1.460  ● Previsto R$ 7.270  ● A Receber R$ 5.810  ● 22 sessões  👁 │
└─────────────────────────────────────────────────────────┘
```

### 4. Files to Modify

| File | Change |
|------|--------|
| `src/components/workflow/WorkflowCardCollapsed.tsx` | Fix description width (desktop + tablet grids), add min-height to prevent flash |
| `src/pages/Workflow.tsx` | Redesign metrics bar with better visual grouping and eye toggle placement |

