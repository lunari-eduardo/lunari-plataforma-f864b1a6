/**
 * Sanitizes an extra-photo unit price coming from any source (Gestão params,
 * frozen rules, manual UI input, etc).
 *
 * Behavior:
 * - Coerces to number; invalid/negative values become 0;
 * - Clamps to a maximum of R$ 999,99 (any value above is considered an
 *   upstream bug and gets clamped + logged) — this prevents incidents like
 *   "R$ 250,05" or "R$ 2.500,50" from propagating into galleries;
 * - Returns the value rounded to 2 decimal places.
 *
 * IMPORTANT: this function does NOT convert cents to reals. Gestão already
 * stores prices in reals; if a future migration ever stores in cents it MUST
 * be handled explicitly at the source, not via heuristics here.
 */
export function sanitizeExtraPrice(value: unknown): number {
  const v = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  if (!isFinite(v) || v < 0) return 0;
  if (v > 999.99) {
    console.warn('[sanitizeExtraPrice] valor acima do limite esperado (clamped to 999.99):', v);
    return 999.99;
  }
  return Math.round(v * 100) / 100;
}

/**
 * @deprecated Use `sanitizeExtraPrice` instead. Kept as a thin alias for
 * backward compatibility with existing call sites. The old "if value > 1000
 * divide by 100" heuristic was unreliable (it failed for the R$ 250,05 bug
 * and would corrupt legitimate premium packages above R$ 1.000) and has been
 * removed.
 */
export function normalizarValor(valor: number, _forceSkip = false): number {
  return sanitizeExtraPrice(valor);
}
