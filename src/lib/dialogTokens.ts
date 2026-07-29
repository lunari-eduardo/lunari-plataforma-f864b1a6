/**
 * dialogTokens — Onda 0 da padronização "Silent Luxury".
 *
 * Escala única de largura de modais e padrão único de scroll,
 * para substituir os valores avulsos (`sm:max-w-[500px]`, `[600px]`,
 * `[480px]`, `sm:max-w-md/lg/2xl`, `max-h-[80vh]/[85vh]/[90vh]`).
 *
 * Uso:
 *   <DialogContent className={cn(dialogSize('md'), DIALOG_SHELL)}>
 *     <DialogHeader>...</DialogHeader>
 *     <div className={DIALOG_BODY}>...</div>
 *     <DialogFooter className={DIALOG_FOOTER}>...</DialogFooter>
 *   </DialogContent>
 */

export type DialogSize = 'sm' | 'md' | 'lg';

/** sm = confirmações · md = formulários · lg = detalhes/conflitos */
const DIALOG_WIDTHS: Record<DialogSize, string> = {
  sm: 'sm:max-w-[420px]',
  md: 'sm:max-w-[520px]',
  lg: 'sm:max-w-[640px]',
};

export function dialogSize(size: DialogSize = 'md'): string {
  return DIALOG_WIDTHS[size];
}

/**
 * Shell do DialogContent: altura máxima em `dvh` (safe-area iOS) e coluna flex,
 * para que o footer nunca seja cortado.
 */
export const DIALOG_SHELL = 'max-h-[85dvh] flex flex-col';

/** Corpo rolável — scroll nativo, nunca no filho. */
export const DIALOG_BODY = 'flex-1 min-h-0 overflow-y-auto';

/** Footer fixo ao fim do modal. */
export const DIALOG_FOOTER = 'flex-shrink-0 pt-3';

/** Escala tipográfica do título de modal (mesma do PageHeader). */
export const DIALOG_TITLE_CLS =
  'text-[15px] font-semibold tracking-tight text-foreground';

/** Descrição/subtítulo do modal. */
export const DIALOG_DESCRIPTION_CLS = 'text-xs text-muted-foreground';

/* ============================================================
 * Onda 6 — densidade interna de formulários e micro-superfícies
 * ============================================================ */

/** Label de campo (padrão Silent Luxury). */
export const FIELD_LABEL = 'text-xs font-medium text-muted-foreground';

/** Agrupamento label + controle. */
export const FIELD_GROUP = 'space-y-1.5';

/** Espaçamento entre campos dentro de uma seção. */
export const FORM_SECTION = 'space-y-3';

/** Superfície sólida de bloco interno (substitui cards glass). */
export const SECTION_SURFACE =
  'rounded-lg border border-border/20 bg-card/60 p-3';

/** Título de bloco interno. */
export const SECTION_TITLE =
  'text-xs font-semibold text-foreground flex items-center gap-2';

/** Painel de dropdown de combobox (superfície sólida, z único). */
export const DROPDOWN_PANEL =
  'absolute z-[70] w-full mt-1 dropdown-solid border border-border/20 rounded-md shadow-lg max-h-60 overflow-auto scrollbar-minimal';

/** Item de dropdown de combobox. */
export const DROPDOWN_ITEM =
  'px-3 py-2 dropdown-solid-item cursor-pointer text-xs border-b border-border/20 last:border-b-0';

