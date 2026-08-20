import { useTheme as useVisualTheme } from '@/contexts/VisualThemeContext';

export function useTheme() {
  const { theme, setTheme } = useVisualTheme();
  return { theme, setTheme };
}
