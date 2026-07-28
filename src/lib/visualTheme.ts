/**
 * Visual Theme Engine — v3 (Lunari Grafite único)
 *
 * A partir de v3 o Lunari possui UM único preset oficial: "graphite".
 * Toda a paleta (grafite + dourado) é fixa em `src/index.css` via os
 * blocos `:root` e `.dark`. Este módulo cuida apenas do modo
 * (light/dark/system) e mantém a API pública anterior para não
 * quebrar imports existentes.
 */

export type VisualThemeMode = 'light' | 'dark' | 'system';
export type ThemePresetId = 'graphite';

export interface ThemePreset {
  id: ThemePresetId;
  name: string;
  description: string;
  hex: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'graphite',
    name: 'Lunari Grafite',
    description: 'Identidade oficial — grafite com detalhes em dourado.',
    hex: '#171717',
  },
];

export interface VisualThemeConfig {
  presetId: ThemePresetId;
  mode: VisualThemeMode;
}

export const DEFAULT_THEME: VisualThemeConfig = {
  presetId: 'graphite',
  mode: 'system',
};

const STORAGE_KEY = 'lunari:theme-preference:v3';
const LEGACY_KEYS = ['lunari:theme-preference:v2', 'lunari:visual-theme:v1'];

function normalize(raw: unknown): VisualThemeConfig {
  const mode: VisualThemeMode =
    raw && typeof raw === 'object' && 'mode' in raw &&
    (raw as { mode?: string }).mode === 'light' ||
    (raw as { mode?: string })?.mode === 'dark' ||
    (raw as { mode?: string })?.mode === 'system'
      ? ((raw as { mode: VisualThemeMode }).mode)
      : 'system';
  return { presetId: 'graphite', mode };
}

export function loadTheme(): VisualThemeConfig {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalize(JSON.parse(raw));
    // Migra chaves legadas preservando apenas o modo
    for (const key of LEGACY_KEYS) {
      const legacy = localStorage.getItem(key);
      if (legacy) {
        try {
          const parsed = JSON.parse(legacy);
          const migrated = normalize(parsed);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          localStorage.removeItem(key);
          return migrated;
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME;
}

export function saveTheme(theme: VisualThemeConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...theme, presetId: 'graphite' }));
  } catch {
    /* ignore */
  }
}

export function clearTheme(): void {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

/**
 * Aplica o tema — apenas toggla a classe `.dark` no <html>.
 * Toda a paleta é resolvida em CSS.
 */
export function applyTheme(theme: VisualThemeConfig): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const useDark = theme.mode === 'dark' || (theme.mode === 'system' && prefersDark);
  root.classList.toggle('dark', useDark);
  root.dataset.theme = 'graphite';
  root.dataset.mode = useDark ? 'dark' : 'light';
}
