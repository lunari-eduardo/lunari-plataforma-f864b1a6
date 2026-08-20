import { useVisualTheme } from '@/contexts/VisualThemeContext';

export function useTheme() {
  const { theme, setMode } = useVisualTheme();
  
  const currentTheme = theme.mode;
  const setTheme = setMode;

  const toggleTheme = () => {
    if (currentTheme === 'light') setMode('dark');
    else if (currentTheme === 'dark') setMode('system');
    else setMode('light');
  };
  
  return { 
    theme: currentTheme, 
    setTheme,
    currentTheme,
    toggleTheme
  };
}
