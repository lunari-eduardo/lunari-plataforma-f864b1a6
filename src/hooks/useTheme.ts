import { useVisualTheme } from '@/contexts/VisualThemeContext';

export function useTheme() {
  const { theme, setMode } = useVisualTheme();
  
  return { 
    theme: theme.mode, 
    setTheme: setMode 
  };
}
