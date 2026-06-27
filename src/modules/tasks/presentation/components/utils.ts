/** Convert hex color (#RRGGBB) to "r, g, b" string for CSS rgba() */
export function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '107, 114, 128';
  return `${r}, ${g}, ${b}`;
}
