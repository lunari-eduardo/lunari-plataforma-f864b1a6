/**
 * Tokens visuais compartilhados do card do Workflow.
 * Alinhamento minimalista tipo Apple/Linear: hairlines, tipografia editorial,
 * inputs claros e elegantes com affordance refinada.
 */
export const HAIRLINE = "border-border/25 dark:border-border/20";

export const LABEL_CLS =
  "text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground/80";

export const VALUE_CLS = "text-[13px] leading-tight text-foreground";
export const VALUE_STRONG =
  "text-[13px] font-semibold tabular-nums text-foreground";

/**
 * Input editável padrão: visual limpo, borda suave, fundo sutil e affordance clara de campo editável.
 */
export const INPUT_EDITABLE =
  "h-7 px-2 text-[12px] tabular-nums font-medium text-right " +
  "bg-muted/25 dark:bg-muted/35 hover:bg-muted/50 focus:bg-background " +
  "border border-border/40 hover:border-border/70 focus:border-primary/60 " +
  "focus-visible:ring-1 focus-visible:ring-primary/20 rounded-md " +
  "transition-all duration-150 shadow-2xs placeholder:text-muted-foreground/40";

/** @deprecated use INPUT_EDITABLE */
export const INPUT_GHOST = INPUT_EDITABLE;

export const BLOCK_ICON_CLS = "h-3.5 w-3.5 text-muted-foreground/70";

export const SECTION_TITLE_CLS =
  "text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground/80";

