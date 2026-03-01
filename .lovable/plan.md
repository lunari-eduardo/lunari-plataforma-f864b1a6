

# Workflow Cards: Gallery UX, Visual Fixes, Mobile Layout

## Summary of Changes

### 1. Gallery Button UX Redesign

**Current:** Single icon that creates selection gallery, or shows status badge if gallery exists.

**New:** Two-button system:
- **"Criar Galeria" button** (always visible, text label) — on click, shows a small popover/dropdown with two options:
  - "Galeria de Seleção" → redirects to `gallery.lunarihub.com/gallery/new?session_id=...` (existing flow)
  - "Galeria de Entrega" → redirects to `gallery.lunarihub.com/deliver/new?session_id=...` (new)
- **"Ver" button with Eye icon** (only visible when at least one gallery exists) — on click, shows a dropdown listing existing galleries for this session (fetched from `galerias` table by `session_id`), each showing type (Seleção/Entrega) and clicking opens the gallery in a new tab.

**Data:** Query `galerias` by `session_id` to find all linked galleries (both `tipo: 'selecao'` and `tipo: 'entrega'`). The `galeriaId` field currently stores only one; we need to fetch dynamically.

**Files:**
- `src/config/externalUrls.ts` — add `DELIVER_NEW: '/deliver/new'`
- `src/utils/galleryRedirect.ts` — add `buildGalleryDeliverUrl()` function (simpler params: session_id, session_uuid, cliente_id, cliente_nome)
- `src/components/workflow/WorkflowCardCollapsed.tsx` — replace Zona 10 (desktop/tablet/mobile) with new "Criar Galeria" + "Ver" buttons using Popover components
- `src/components/workflow/WorkflowCardExpanded.tsx` — replace Block 3 gallery section with same pattern (larger buttons)
- `src/hooks/useSessionGalerias.ts` — new hook to fetch all galleries for a session from `galerias` table

### 2. Visual/Style Fixes

**Remove left border accent:**
- `src/components/workflow/WorkflowCard.tsx` — remove `border-l-[3px] border-l-primary/40` and related hover/expanded border classes

**Fix gradient colors (no blue in dark mode):**
- `src/components/workflow/WorkflowCard.tsx` — change dark mode gradient to warm grays: `dark:from-[#1a1a1a] dark:via-[#1f1f1f] dark:to-[#1a1a1a]`
- `src/components/workflow/WorkflowCardList.tsx` — change container dark background to pure dark: `dark:from-[#111] dark:via-[#141414] dark:to-[#111]`

**White/gray gradient for light mode:**
- Light mode card: `bg-gradient-to-br from-white via-gray-50/50 to-stone-50/30` (neutral, no orange)
- Light mode container: `bg-gradient-to-b from-gray-50/60 via-white to-gray-50/40`

**Fix inverted hover effect:**
- Card currently has expanded-state shadows applied on base, making hover look like it loses effect. Fix by ensuring base shadow is minimal and hover adds shadow.

### 3. Mobile Card Layout Fix

**Problem:** Cards wrap/collapse on mobile, becoming unreadable (image 5).

**Fix in `WorkflowCardList.tsx`:**
- Mobile cards get a fixed minimum width (`min-w-[360px]`)
- Container allows horizontal scroll on mobile: `overflow-x-auto`
- Cards never shrink: `flex-shrink-0`

### Files to Modify

| File | Change |
|------|--------|
| `src/config/externalUrls.ts` | Add `DELIVER_NEW` path |
| `src/utils/galleryRedirect.ts` | Add `buildGalleryDeliverUrl()` |
| `src/hooks/useSessionGalerias.ts` | **New file** — hook to fetch galleries by session_id |
| `src/components/workflow/WorkflowCardCollapsed.tsx` | Replace gallery zone with "Criar Galeria" + "Ver" popover system |
| `src/components/workflow/WorkflowCardExpanded.tsx` | Replace Block 3 gallery section with same pattern |
| `src/components/workflow/WorkflowCard.tsx` | Remove left border; fix gradients for light/dark; fix hover |
| `src/components/workflow/WorkflowCardList.tsx` | Fix container gradients; add mobile horizontal scroll with fixed card width |

