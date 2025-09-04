import { useState, useEffect } from 'react';
import { unifiedStorageService } from '@/services/storage/UnifiedStorageService';

type Theme = 'light' | 'dark' | 'system';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    // Load saved theme preference or default to system
    const savedTheme = unifiedStorageService.loadRaw('theme', 'system') as Theme;
    setTheme(savedTheme);
    
    // Apply theme immediately
    applyTheme(savedTheme);
  }, []);

  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement;
    
    if (newTheme === 'system') {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', systemPrefersDark);
    } else {
      root.classList.toggle('dark', newTheme === 'dark');
    }
  };

  const setThemeAndSave = (newTheme: Theme) => {
    setTheme(newTheme);
    unifiedStorageService.saveRaw('theme', newTheme);
    applyTheme(newTheme);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setThemeAndSave(newTheme);
  };

  const getCurrentTheme = () => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  };

  return {
    theme,
    setTheme: setThemeAndSave,
    toggleTheme,
    currentTheme: getCurrentTheme()
  };
}