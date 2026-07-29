/**
 * PageTabs — linguagem única de abas de página (Silent Luxury).
 *
 * Sublinhado transparente, densidade baixa e scroll horizontal no mobile.
 * Usar com os primitivos Radix já existentes (`@/components/ui/tabs`).
 */

export const PAGE_TABS_LIST =
  'w-full justify-start gap-1 border-b border-border/20 bg-transparent overflow-x-auto no-scrollbar';

export const PAGE_TABS_TRIGGER =
  'shrink-0 gap-2 px-3 py-2 text-[13px] font-medium';

export const PAGE_TABS_CONTENT = 'mt-5';

/** Shell de scroll nativo (iOS-friendly) para páginas com abas. */
export const PAGE_SCROLL_SHELL =
  'h-full min-h-0 flex-1 overflow-y-auto overscroll-contain';
