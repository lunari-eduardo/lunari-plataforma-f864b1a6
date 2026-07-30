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

/* ============================================================
 * Onda 6 (2ª passagem) — listas, linhas e escala tipográfica
 * ============================================================ */

/**
 * Casca de lista: o raio existe UMA única vez, aqui.
 * Os itens internos nunca têm borda nem raio próprios.
 */
export const LIST_SHELL =
  'rounded-lg border border-border/20 overflow-hidden bg-card/60';

/**
 * Divisor entre linhas — propositalmente mais aparente que a borda
 * de input (`border-border/20`), para dar ritmo à leitura.
 */
export const ROW_DIVIDER = 'divide-y divide-border/60';

/** Linha de lista: sem borda, sem raio, com hover discreto. */
export const ROW_BASE =
  'px-3 py-2 transition-colors hover:bg-muted/40';

/** Cabeçalho de tabela/lista. */
export const ROW_HEADER =
  'px-3 py-2 bg-muted/30 text-[11px] font-medium uppercase tracking-wide text-muted-foreground';

/** Faixa de adição inline (sem `border-dashed`). */
export const INLINE_ADD =
  'px-3 py-2.5 bg-muted/20 border-b border-border/60';

/** Valor numérico em linha de lista. */
export const VALUE_NUM =
  'tabular-nums text-[13px] font-medium text-foreground';

/** Ícone dourado fosco — substitui os `style={{ color: ... }}` avulsos. */
export const GOLD_ICON = 'h-4 w-4 shrink-0 text-[hsl(var(--accent-gold))]';

/**
 * Input "ghost": sem borda/fundo em repouso, borda apenas em hover/focus.
 * Reduz drasticamente a quantidade de cantos arredondados em listas editáveis.
 */
export const GHOST_INPUT =
  'h-8 text-[13px] bg-transparent border-transparent shadow-none px-2 ' +
  'hover:border-border/40 hover:bg-background/60 ' +
  'focus-visible:border-border focus-visible:bg-background';

/** Estado vazio de lista. */
export const LIST_EMPTY =
  'text-[13px] text-muted-foreground text-center py-6';


