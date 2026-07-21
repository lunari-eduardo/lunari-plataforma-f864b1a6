/**
 * Tokens visuais compartilhados do card do Workflow.
 * Alinhamento minimalista tipo Apple/Linear: hairlines, tipografia editorial,
 * inputs "quase invisíveis" que só ganham borda inferior no hover/focus.
 */
export const HAIRLINE = "border-border/25 dark:border-border/20";

export const LABEL_CLS =
  "text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground/80";

export const VALUE_CLS = "text-[13px] leading-tight text-foreground";
export const VALUE_STRONG =
  "text-[13px] font-semibold tabular-nums text-foreground";

/**
 * Input "ghost": sem contorno em repouso, hairline inferior no hover,
 * cor primária no foco. Rounded=0 para não competir com o card.
 */
export const INPUT_GHOST =
  "h-7 px-1.5 text-[12px] bg-transparent border-0 border-b border-transparent " +
  "hover:border-border/40 focus:border-primary/50 focus:bg-transparent " +
  "focus-visible:ring-0 rounded-none transition-colors";

export const BLOCK_ICON_CLS = "h-3.5 w-3.5 text-muted-foreground/70";

export const SECTION_TITLE_CLS =
  "text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground/80";
