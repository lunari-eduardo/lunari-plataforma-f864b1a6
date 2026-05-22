import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  applyTheme,
  clearTheme,
  DEFAULT_THEME,
  loadTheme,
  saveTheme,
  THEME_PRESETS,
  VisualThemeConfig,
  ThemePresetId,
  VisualThemeMode,
} from '@/lib/visualTheme';
import { useRemoteThemeSync } from '@/hooks/useThemePreference';

interface VisualThemeContextValue {
  theme: VisualThemeConfig;
  setPreset: (id: ThemePresetId) => void;
  setMode: (mode: VisualThemeMode) => void;
  reset: () => void;
  presets: typeof THEME_PRESETS;
}

const VisualThemeContext = createContext<VisualThemeContextValue | null>(null);

export function VisualThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<VisualThemeConfig>(() => loadTheme());

  // Aplica ao montar e a cada mudança
  useEffect(() => {
    applyTheme(theme);
    saveTheme(theme);
  }, [theme]);

  // Acompanha prefers-color-scheme quando modo === system
  useEffect(() => {
    if (theme.mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme(theme);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  // Sincroniza com Supabase (quando logado)
  useRemoteThemeSync(theme, setThemeState);

  const setPreset = useCallback((id: ThemePresetId) => {
    setThemeState((prev) => ({ ...prev, presetId: id }));
  }, []);

  const setMode = useCallback((mode: VisualThemeMode) => {
    setThemeState((prev) => ({ ...prev, mode }));
  }, []);

  const reset = useCallback(() => {
    clearTheme();
    setThemeState(DEFAULT_THEME);
  }, []);

  const value = useMemo<VisualThemeContextValue>(
    () => ({ theme, setPreset, setMode, reset, presets: THEME_PRESETS }),
    [theme, setPreset, setMode, reset],
  );

  return <VisualThemeContext.Provider value={value}>{children}</VisualThemeContext.Provider>;
}

export function useVisualTheme() {
  const ctx = useContext(VisualThemeContext);
  if (!ctx) throw new Error('useVisualTheme deve ser usado dentro de VisualThemeProvider');
  return ctx;
}
