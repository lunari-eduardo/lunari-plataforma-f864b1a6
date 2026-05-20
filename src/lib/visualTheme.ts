/**
 * Visual Theme Engine — Fase 3
 *
 * Aplica overrides em runtime sobre as variáveis CSS definidas em
 * `src/index.css`. A persistência inicial usa localStorage; uma
 * migração para Supabase pode ser adicionada futuramente (tabelas
 * `user_visual_preferences` / `system_visual_config`).
 */

export type VisualThemeMode = 'light' | 'dark' | 'system';

export interface VisualThemeConfig {
  /** Brand (HSL components, sem alfa) */
  brandH: number;
  brandS: number; // 0-100
  brandL: number; // 0-100
  brandHoverL: number;
  brandGlowL: number;

  /** Glass intensity */
  glassAlphaLight: number;  // 0..1
  glassAlphaMedium: number; // 0..1
  glassAlphaHeavy: number;  // 0..1
  glassBlurSm: number;  // px
  glassBlurMd: number;  // px
  glassBlurLg: number;  // px

  /** Surface neutral tone (tilt em hue + saturação) */
  surfaceHue: number;          // 0-360
  surfaceSaturation: number;   // 0-100

  /** Radius global (px) — ajusta --radius */
  radius: number;

  /** Modo claro/escuro */
  mode: VisualThemeMode;
}

export const DEFAULT_THEME: VisualThemeConfig = {
  brandH: 19,
  brandS: 49,
  brandL: 45,
  brandHoverL: 38,
  brandGlowL: 60,
  glassAlphaLight: 0.45,
  glassAlphaMedium: 0.55,
  glassAlphaHeavy: 0.75,
  glassBlurSm: 8,
  glassBlurMd: 16,
  glassBlurLg: 24,
  surfaceHue: 30,
  surfaceSaturation: 30,
  radius: 12,
  mode: 'system',
};

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  config: Partial<VisualThemeConfig>;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'lunari-terracotta',
    name: 'Lunari Terracota',
    description: 'Identidade original — quente e elegante',
    config: { ...DEFAULT_THEME },
  },
  {
    id: 'midnight-indigo',
    name: 'Midnight Indigo',
    description: 'Sofisticação tecnológica em índigo profundo',
    config: { brandH: 234, brandS: 70, brandL: 58, brandHoverL: 50, brandGlowL: 70, surfaceHue: 230, surfaceSaturation: 12 },
  },
  {
    id: 'emerald-prestige',
    name: 'Emerald Prestige',
    description: 'Verde esmeralda premium e autoridade',
    config: { brandH: 162, brandS: 55, brandL: 38, brandHoverL: 32, brandGlowL: 50, surfaceHue: 160, surfaceSaturation: 8 },
  },
  {
    id: 'ocean-deep',
    name: 'Ocean Deep',
    description: 'Azul profissional e confiável',
    config: { brandH: 205, brandS: 60, brandL: 42, brandHoverL: 36, brandGlowL: 55, surfaceHue: 210, surfaceSaturation: 14 },
  },
  {
    id: 'noir-gold',
    name: 'Noir & Gold',
    description: 'Editorial luxo com dourado',
    config: { brandH: 42, brandS: 55, brandL: 50, brandHoverL: 42, brandGlowL: 65, surfaceHue: 40, surfaceSaturation: 6 },
  },
  {
    id: 'neutral-mono',
    name: 'Neutro Mono',
    description: 'Plataforma SaaS internacional, mínima',
    config: { brandH: 222, brandS: 18, brandL: 28, brandHoverL: 22, brandGlowL: 45, surfaceHue: 220, surfaceSaturation: 6, glassAlphaMedium: 0.6 },
  },
];

const STORAGE_KEY = 'lunari:visual-theme:v1';

export function loadTheme(): VisualThemeConfig {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_THEME;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_THEME, ...parsed };
  } catch {
    return DEFAULT_THEME;
  }
}

export function saveTheme(theme: VisualThemeConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
  } catch {
    /* ignore */
  }
}

export function clearTheme(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Aplica config como CSS custom properties no :root */
export function applyTheme(theme: VisualThemeConfig): void {
  if (typeof document === 'undefined') return;
  const r = document.documentElement.style;

  r.setProperty('--brand-h', String(theme.brandH));
  r.setProperty('--brand-s', `${theme.brandS}%`);
  r.setProperty('--brand-l', `${theme.brandL}%`);
  r.setProperty('--brand-hover-l', `${theme.brandHoverL}%`);
  r.setProperty('--brand-glow-l', `${theme.brandGlowL}%`);

  r.setProperty('--glass-alpha-light', String(theme.glassAlphaLight));
  r.setProperty('--glass-alpha-medium', String(theme.glassAlphaMedium));
  r.setProperty('--glass-alpha-heavy', String(theme.glassAlphaHeavy));
  r.setProperty('--glass-blur-sm', `${theme.glassBlurSm}px`);
  r.setProperty('--glass-blur-md', `${theme.glassBlurMd}px`);
  r.setProperty('--glass-blur-lg', `${theme.glassBlurLg}px`);

  r.setProperty('--radius', `${theme.radius}px`);

  // Dark / light mode
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const useDark = theme.mode === 'dark' || (theme.mode === 'system' && prefersDark);
  root.classList.toggle('dark', useDark);
}

/** Pré-visualização sem persistir (usada nos sliders) */
export function previewTheme(partial: Partial<VisualThemeConfig>, base: VisualThemeConfig): VisualThemeConfig {
  return { ...base, ...partial };
}
