import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  applyTheme,
  clearTheme,
  DEFAULT_THEME,
  loadTheme,
  saveTheme,
  THEME_PRESETS,
  VisualThemeConfig,
} from '@/lib/visualTheme';

interface VisualThemeContextValue {
  theme: VisualThemeConfig;
  update: (patch: Partial<VisualThemeConfig>) => void;
  setTheme: (next: VisualThemeConfig) => void;
  applyPreset: (presetId: string) => void;
  reset: () => void;
  presets: typeof THEME_PRESETS;
}

const VisualThemeContext = createContext<VisualThemeContextValue | null>(null);

export function VisualThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<VisualThemeConfig>(() => loadTheme());

  // Aplica ao montar e sempre que mudar
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Acompanha mudança de prefers-color-scheme quando modo === system
  useEffect(() => {
    if (theme.mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme(theme);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((next: VisualThemeConfig) => {
    setThemeState(next);
    saveTheme(next);
  }, []);

  const update = useCallback((patch: Partial<VisualThemeConfig>) => {
    setThemeState((prev) => {
      const next = { ...prev, ...patch };
      saveTheme(next);
      return next;
    });
  }, []);

  const applyPreset = useCallback((presetId: string) => {
    const preset = THEME_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setThemeState((prev) => {
      const next = { ...prev, ...preset.config };
      saveTheme(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    clearTheme();
    setThemeState(DEFAULT_THEME);
  }, []);

  const value = useMemo<VisualThemeContextValue>(
    () => ({ theme, update, setTheme, applyPreset, reset, presets: THEME_PRESETS }),
    [theme, update, setTheme, applyPreset, reset],
  );

  return <VisualThemeContext.Provider value={value}>{children}</VisualThemeContext.Provider>;
}

export function useVisualTheme() {
  const ctx = useContext(VisualThemeContext);
  if (!ctx) throw new Error('useVisualTheme deve ser usado dentro de VisualThemeProvider');
  return ctx;
}
