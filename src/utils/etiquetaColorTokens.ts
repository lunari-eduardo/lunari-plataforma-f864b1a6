/**
 * Tokens semânticos de cores para etiquetas de produto.
 * Nunca usar hex em componentes — sempre referenciar este mapa.
 */

export const ETIQUETA_COLOR_KEYS = [
  'slate', 'gray', 'red', 'orange', 'amber', 'yellow',
  'lime', 'green', 'emerald', 'teal', 'cyan', 'sky',
  'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'
] as const;

export type EtiquetaColor = typeof ETIQUETA_COLOR_KEYS[number];

export interface EtiquetaColorTokens {
  dot: string;
  chip: string;
  chipActive: string;
  swatch: string;
}

export const ETIQUETA_COLORS: Record<EtiquetaColor, EtiquetaColorTokens> = {
  slate:   { dot: 'bg-slate-500',   chip: 'bg-slate-500/10 text-slate-700 dark:text-slate-200 ring-1 ring-inset ring-slate-500/30',     chipActive: 'bg-slate-500/25 text-slate-700 dark:text-slate-100 ring-1 ring-inset ring-slate-500/60',     swatch: 'bg-slate-500' },
  gray:    { dot: 'bg-gray-500',    chip: 'bg-gray-500/10 text-gray-700 dark:text-gray-200 ring-1 ring-inset ring-gray-500/30',         chipActive: 'bg-gray-500/25 text-gray-700 dark:text-gray-100 ring-1 ring-inset ring-gray-500/60',          swatch: 'bg-gray-500' },
  red:     { dot: 'bg-red-500',     chip: 'bg-red-500/10 text-red-700 dark:text-red-300 ring-1 ring-inset ring-red-500/30',             chipActive: 'bg-red-500/25 text-red-700 dark:text-red-200 ring-1 ring-inset ring-red-500/60',              swatch: 'bg-red-500' },
  orange:  { dot: 'bg-orange-500',  chip: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 ring-1 ring-inset ring-orange-500/30', chipActive: 'bg-orange-500/25 text-orange-700 dark:text-orange-200 ring-1 ring-inset ring-orange-500/60',  swatch: 'bg-orange-500' },
  amber:   { dot: 'bg-amber-500',   chip: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-1 ring-inset ring-amber-500/30',     chipActive: 'bg-amber-500/25 text-amber-700 dark:text-amber-200 ring-1 ring-inset ring-amber-500/60',      swatch: 'bg-amber-500' },
  yellow:  { dot: 'bg-yellow-500',  chip: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 ring-1 ring-inset ring-yellow-500/30', chipActive: 'bg-yellow-500/25 text-yellow-700 dark:text-yellow-200 ring-1 ring-inset ring-yellow-500/60',  swatch: 'bg-yellow-500' },
  lime:    { dot: 'bg-lime-500',    chip: 'bg-lime-500/10 text-lime-700 dark:text-lime-300 ring-1 ring-inset ring-lime-500/30',         chipActive: 'bg-lime-500/25 text-lime-700 dark:text-lime-200 ring-1 ring-inset ring-lime-500/60',          swatch: 'bg-lime-500' },
  green:   { dot: 'bg-green-500',   chip: 'bg-green-500/10 text-green-700 dark:text-green-300 ring-1 ring-inset ring-green-500/30',     chipActive: 'bg-green-500/25 text-green-700 dark:text-green-200 ring-1 ring-inset ring-green-500/60',      swatch: 'bg-green-500' },
  emerald: { dot: 'bg-emerald-500', chip: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-inset ring-emerald-500/30', chipActive: 'bg-emerald-500/25 text-emerald-700 dark:text-emerald-200 ring-1 ring-inset ring-emerald-500/60', swatch: 'bg-emerald-500' },
  teal:    { dot: 'bg-teal-500',    chip: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 ring-1 ring-inset ring-teal-500/30',         chipActive: 'bg-teal-500/25 text-teal-700 dark:text-teal-200 ring-1 ring-inset ring-teal-500/60',          swatch: 'bg-teal-500' },
  cyan:    { dot: 'bg-cyan-500',    chip: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 ring-1 ring-inset ring-cyan-500/30',         chipActive: 'bg-cyan-500/25 text-cyan-700 dark:text-cyan-200 ring-1 ring-inset ring-cyan-500/60',          swatch: 'bg-cyan-500' },
  sky:     { dot: 'bg-sky-500',     chip: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-1 ring-inset ring-sky-500/30',             chipActive: 'bg-sky-500/25 text-sky-700 dark:text-sky-200 ring-1 ring-inset ring-sky-500/60',              swatch: 'bg-sky-500' },
  blue:    { dot: 'bg-blue-500',    chip: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-1 ring-inset ring-blue-500/30',         chipActive: 'bg-blue-500/25 text-blue-700 dark:text-blue-200 ring-1 ring-inset ring-blue-500/60',          swatch: 'bg-blue-500' },
  indigo:  { dot: 'bg-indigo-500',  chip: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-1 ring-inset ring-indigo-500/30', chipActive: 'bg-indigo-500/25 text-indigo-700 dark:text-indigo-200 ring-1 ring-inset ring-indigo-500/60',  swatch: 'bg-indigo-500' },
  violet:  { dot: 'bg-violet-500',  chip: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 ring-1 ring-inset ring-violet-500/30', chipActive: 'bg-violet-500/25 text-violet-700 dark:text-violet-200 ring-1 ring-inset ring-violet-500/60',  swatch: 'bg-violet-500' },
  purple:  { dot: 'bg-purple-500',  chip: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 ring-1 ring-inset ring-purple-500/30', chipActive: 'bg-purple-500/25 text-purple-700 dark:text-purple-200 ring-1 ring-inset ring-purple-500/60',  swatch: 'bg-purple-500' },
  fuchsia: { dot: 'bg-fuchsia-500', chip: 'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300 ring-1 ring-inset ring-fuchsia-500/30', chipActive: 'bg-fuchsia-500/25 text-fuchsia-700 dark:text-fuchsia-200 ring-1 ring-inset ring-fuchsia-500/60', swatch: 'bg-fuchsia-500' },
  pink:    { dot: 'bg-pink-500',    chip: 'bg-pink-500/10 text-pink-700 dark:text-pink-300 ring-1 ring-inset ring-pink-500/30',         chipActive: 'bg-pink-500/25 text-pink-700 dark:text-pink-200 ring-1 ring-inset ring-pink-500/60',          swatch: 'bg-pink-500' },
  rose:    { dot: 'bg-rose-500',    chip: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-1 ring-inset ring-rose-500/30',         chipActive: 'bg-rose-500/25 text-rose-700 dark:text-rose-200 ring-1 ring-inset ring-rose-500/60',          swatch: 'bg-rose-500' },
};

export function getEtiquetaTokens(cor: string | undefined | null): EtiquetaColorTokens {
  if (cor && (ETIQUETA_COLOR_KEYS as readonly string[]).includes(cor)) {
    return ETIQUETA_COLORS[cor as EtiquetaColor];
  }
  return ETIQUETA_COLORS.slate;
}
