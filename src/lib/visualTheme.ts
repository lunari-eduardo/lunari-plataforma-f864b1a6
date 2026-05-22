/**
 * Visual Theme Engine — v2 (User-facing presets)
 *
 * Cada usuário escolhe 1 preset entre 7 cores curadas. Sliders manuais
 * foram removidos: brilho/saturação são derivados automaticamente para
 * garantir contraste AA em light e dark mode.
 */

export type VisualThemeMode = 'light' | 'dark' | 'system';
export type ThemePresetId =
  | 'lunari'
  | 'sage'
  | 'ocean'
  | 'lavender'
  | 'rose'
  | 'coral'
  | 'mono';

export interface ThemePreset {
  id: ThemePresetId;
  name: string;
  description: string;
  hex: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'lunari',   name: 'Lunari',     description: 'Terracota — identidade original', hex: '#893806' },
  { id: 'sage',     name: 'Sage',       description: 'Verde sereno e natural',          hex: '#8eb882' },
  { id: 'ocean',    name: 'Ocean',      description: 'Azul-petróleo calmo',             hex: '#82b5b8' },
  { id: 'lavender', name: 'Lavender',   description: 'Lilás sofisticado',               hex: '#a282b8' },
  { id: 'rose',     name: 'Rose',       description: 'Rosé contemporâneo',              hex: '#b88299' },
  { id: 'coral',    name: 'Coral',      description: 'Coral quente e elegante',         hex: '#c27e7e' },
  { id: 'mono',     name: 'Preto & Branco', description: 'Mínimo, alto contraste',      hex: '#1a1a1a' },
];

export interface VisualThemeConfig {
  presetId: ThemePresetId;
  mode: VisualThemeMode;
}

export const DEFAULT_THEME: VisualThemeConfig = {
  presetId: 'lunari',
  mode: 'system',
};

const STORAGE_KEY = 'lunari:theme-preference:v2';
const LEGACY_KEY = 'lunari:visual-theme:v1';

export function loadTheme(): VisualThemeConfig {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_THEME, ...parsed };
    }
    // Legacy migration
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      try {
        const { brandH, mode } = JSON.parse(legacy) || {};
        const presetId: ThemePresetId =
          typeof brandH === 'number' ? mapHueToPreset(brandH) : 'lunari';
        const migrated = { presetId, mode: (mode as VisualThemeMode) || 'system' };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        localStorage.removeItem(LEGACY_KEY);
        return migrated;
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME;
}

export function saveTheme(theme: VisualThemeConfig): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(theme)); } catch { /* ignore */ }
}

export function clearTheme(): void {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

function mapHueToPreset(h: number): ThemePresetId {
  const buckets: Array<[number, ThemePresetId]> = [
    [19, 'lunari'], [110, 'sage'], [183, 'ocean'],
    [275, 'lavender'], [340, 'rose'], [0, 'coral'],
  ];
  let best: ThemePresetId = 'lunari';
  let bestD = 360;
  for (const [bh, id] of buckets) {
    const d = Math.min(Math.abs(h - bh), 360 - Math.abs(h - bh));
    if (d < bestD) { bestD = d; best = id; }
  }
  return best;
}

/* ── HEX → HSL ─────────────────────────────────────────────── */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const m = hex.replace('#', '').match(/.{1,2}/g);
  if (!m) return { h: 0, s: 0, l: 0 };
  const [r, g, b] = m.map((x) => parseInt(x, 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: h = ((b - r) / d + 2); break;
      case b: h = ((r - g) / d + 4); break;
    }
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/* ── Resolução inteligente por modo ────────────────────────── */
export interface ResolvedTokens {
  brandH: number; brandS: number; brandL: number;
  brandHoverL: number; brandGlowL: number;
  primaryForegroundL: number; // 0 ou 100
  surfaceHue: number; surfaceSat: number;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function resolvePresetTokens(
  presetId: ThemePresetId,
  effectiveMode: 'light' | 'dark',
): ResolvedTokens {
  const preset = THEME_PRESETS.find((p) => p.id === presetId) ?? THEME_PRESETS[0];

  // Mono recebe tratamento especial: inverte conforme modo
  if (preset.id === 'mono') {
    return effectiveMode === 'dark'
      ? { brandH: 0, brandS: 0, brandL: 92, brandHoverL: 82, brandGlowL: 100, primaryForegroundL: 0, surfaceHue: 220, surfaceSat: 4 }
      : { brandH: 0, brandS: 0, brandL: 10, brandHoverL: 4,  brandGlowL: 25,  primaryForegroundL: 100, surfaceHue: 220, surfaceSat: 4 };
  }

  const { h, s, l } = hexToHsl(preset.hex);

  // Ajuste para garantir vivacidade + contraste mínimo
  // Light: queremos brilho moderado (35-55) para que texto branco contraste
  // Dark : elevamos lightness para 60-72 para legibilidade sobre fundo escuro
  const brandL = effectiveMode === 'dark'
    ? clamp(Math.max(l, 60), 55, 75)
    : clamp(Math.min(l, 55), 30, 55);

  // Saturação: levemente reduzida no dark para evitar vibração
  const brandS = effectiveMode === 'dark' ? clamp(s - 5, 25, 75) : clamp(s, 30, 85);

  const brandHoverL = effectiveMode === 'dark' ? clamp(brandL + 8, 0, 90) : clamp(brandL - 8, 5, 100);
  const brandGlowL  = effectiveMode === 'dark' ? clamp(brandL + 15, 0, 95) : clamp(brandL + 15, 0, 90);

  // foreground branco se a cor for escura o suficiente; preto se for clara
  const primaryForegroundL = brandL < 60 ? 100 : 10;

  // Surface tilt: leve toque na hue da marca, saturação muito baixa
  const surfaceHue = h;
  const surfaceSat = effectiveMode === 'dark' ? 6 : 10;

  return { brandH: h, brandS, brandL, brandHoverL, brandGlowL, primaryForegroundL, surfaceHue, surfaceSat };
}

/** Aplica tokens no :root e toggla a classe `dark`. */
export function applyTheme(theme: VisualThemeConfig): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const useDark = theme.mode === 'dark' || (theme.mode === 'system' && prefersDark);
  root.classList.toggle('dark', useDark);

  const t = resolvePresetTokens(theme.presetId, useDark ? 'dark' : 'light');
  const r = root.style;
  r.setProperty('--brand-h', String(t.brandH));
  r.setProperty('--brand-s', `${t.brandS}%`);
  r.setProperty('--brand-l', `${t.brandL}%`);
  r.setProperty('--brand-hover-l', `${t.brandHoverL}%`);
  r.setProperty('--brand-glow-l', `${t.brandGlowL}%`);
  r.setProperty('--primary-foreground', `0 0% ${t.primaryForegroundL}%`);
  r.setProperty('--surface-hue', String(t.surfaceHue));
  r.setProperty('--surface-sat', `${t.surfaceSat}%`);
}
