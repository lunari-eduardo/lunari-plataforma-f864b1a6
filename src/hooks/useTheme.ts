import { useVisualTheme } from '@/contexts/VisualThemeContext';

/**
 * useTheme — shim compatível com API antiga.
 * Encaminha para VisualThemeContext (fonte única de verdade).
 */
export function useTheme() {
  const { theme, setMode } = useVisualTheme();

  const currentTheme: 'light' | 'dark' = (() => {
    if (theme.mode === 'system') {
      if (typeof window === 'undefined') return 'light';
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme.mode;
  })();

  return {
    theme: theme.mode,
    setTheme: setMode,
    toggleTheme: () => setMode(currentTheme === 'dark' ? 'light' : 'dark'),
    currentTheme,
  };
}
