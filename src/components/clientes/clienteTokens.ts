/**
 * clienteTokens — Onda 4 da padronização "Silent Luxury" (Clientes + Perfil).
 *
 * Superfícies sólidas, bordas hairline (/20) e paleta semântica.
 * Substitui cores cruas (`bg-green-100`, `text-blue-600`, `border-lunar-border`).
 */

/** Card sólido de cliente (lista em grid). */
export const CLIENT_CARD =
  'rounded-xl border border-border/20 bg-card transition-colors hover:border-border/40';

/** Linha de tabela (modo lista). */
export const CLIENT_ROW = 'border-border/20';

/** Nome do cliente em card/linha. */
export const CLIENT_NAME =
  'text-[15px] font-semibold tracking-tight text-foreground hover:text-accent-gold transition-colors';

/** Rótulo de métrica financeira. */
export const CLIENT_METRIC_LABEL = 'text-[11px] text-muted-foreground';

/** Valor de métrica financeira. */
export const CLIENT_METRIC_VALUE =
  'text-[15px] font-semibold tabular-nums text-foreground';

/** Valor recebido (positivo). */
export const CLIENT_METRIC_PAID =
  'text-[15px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-500';

/** Valor pendente (atenção discreta). */
export const CLIENT_METRIC_DUE =
  'text-[15px] font-semibold tabular-nums text-accent-gold';

/** Badge de status — cliente ativo. */
export const STATUS_BADGE_ACTIVE =
  'inline-flex items-center rounded-full border border-border/20 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-foreground';

/** Badge de status — cliente novo. */
export const STATUS_BADGE_NEW =
  'inline-flex items-center rounded-full border border-border/20 bg-transparent px-2 py-0.5 text-[11px] font-medium text-muted-foreground';

/** Botão de ação em ícone (neutro; destrutivo só no hover). */
export const CLIENT_ICON_ACTION =
  'h-8 w-8 p-0 text-muted-foreground hover:text-foreground';

export const CLIENT_ICON_ACTION_DANGER =
  'h-8 w-8 p-0 text-muted-foreground hover:text-destructive';
