

# Fix: Workflow Cards - Visual, Hover, Sizing, and Layout

## Problems Identified

1. **No gradient visible** — `bg-gradient-to-br` with `dark:from-[#1a1a1a]` doesn't work because Tailwind gradient `from-`/`via-`/`to-` utilities in dark mode need the gradient direction repeated or the gradient base class applied in both modes. The card and container backgrounds appear flat.

2. **Hover inverted** — The hover shadow (`0_6px_20px`) is WEAKER than the expanded state shadow (`0_8px_24px`). On non-expanded cards, base shadow is so subtle hover barely adds anything. Fix: increase hover shadow significantly, and for expanded cards, ensure hover adds even more depth.

3. **No left border** — Already removed per plan. Good.

4. **Cards resize on mobile** — `min-w-[360px] md:min-w-0` means on desktop cards lose their min-width. The card itself has `w-full lg:w-[70%]` which makes it shrink. Cards need a FIXED width that never changes, with horizontal scrolling in the container.

5. **Content overflowing** — The desktop grid template `grid-cols-[40px_50px_180px_1fr_140px_130px_90px_90px_100px_36px]` doesn't account for the new "Criar + Ver" gallery buttons which need more space than `36px`.

## Plan

### File: `src/components/workflow/WorkflowCard.tsx`

**Fix gradient + hover + sizing:**
- Remove `w-full lg:w-[70%]` and `ml-0` — card should NOT set its own width (parent controls it)
- Fix gradient: use a single `style` prop for the gradient background that works in both light/dark, OR use proper Tailwind classes with `dark:bg-gradient-to-br` pattern
- Actually the issue is simpler: Tailwind gradient classes work fine, but `bg-gradient-to-br` must be present and the `from-`/`via-`/`to-` must be on the same element. Check if `dark:from-*` works with the base `bg-gradient-to-br`. It should — the direction class isn't mode-specific. The real problem might be that `bg-card` or other background utilities are overriding the gradient. Let me verify there's no conflicting `bg-` class.
- Looking at the code: no `bg-card` present, just `bg-gradient-to-br from-white via-gray-50/50 to-stone-50/30` which should work. The dark mode uses `dark:from-[#1a1a1a]` etc. This SHOULD work in Tailwind. The issue might be that `from-white` in light mode looks identical to white background — no visible gradient. Need more contrast: `from-white via-gray-100/60 to-gray-50/80`.
- **Hover fix**: Base shadow stays minimal. Hover gets a strong lift: `hover:shadow-[0_8px_28px_rgba(0,0,0,0.12)]`. Expanded state uses `shadow-[0_4px_16px_rgba(0,0,0,0.08)]` (LESS than hover, so hovering expanded card still adds depth).
- Add `border border-gray-200/60 dark:border-gray-700/40` for visual card separation.

### File: `src/components/workflow/WorkflowCardList.tsx`

**Fix container gradient + fixed card width + horizontal scroll:**
- Container: stronger gradient `from-gray-100/80 via-gray-50 to-gray-100/60` in light, `dark:from-[#0e0e0e] dark:via-[#131313] dark:to-[#0e0e0e]`
- Inner flex: `overflow-x-auto` always (not just mobile)
- Card wrapper: fixed `min-w-[1100px]` so card never shrinks, container scrolls horizontally
- Remove `md:min-w-0` and `md:flex-shrink` — card is ALWAYS fixed width

### File: `src/components/workflow/WorkflowCard.tsx` (sizing)

- Remove `w-full lg:w-[70%]` — let card fill its fixed-width parent
- Just use `w-full`

### File: `src/components/workflow/WorkflowCardCollapsed.tsx`

- Widen desktop grid last column from `36px` to `auto` or `120px` to fit "Criar" + "Ver" buttons
- Grid template: `grid-cols-[40px_50px_180px_1fr_140px_130px_90px_90px_100px_auto]`

## Files to Modify

| File | Change |
|------|--------|
| `src/components/workflow/WorkflowCard.tsx` | Fix gradient contrast, add border, fix hover/expanded shadows, remove width constraints |
| `src/components/workflow/WorkflowCardList.tsx` | Stronger gradient, fixed card min-width (1100px), always horizontal scroll |
| `src/components/workflow/WorkflowCardCollapsed.tsx` | Widen last grid column for gallery buttons |

