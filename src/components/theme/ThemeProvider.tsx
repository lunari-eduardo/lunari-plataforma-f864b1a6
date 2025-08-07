import { createContext, useContext, useEffect, useState } from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { useUserPreferences } from '@/hooks/useUserProfile';

type Theme = 'light' | 'dark' | 'system';

type ThemeProviderContextType = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeProviderContext = createContext<ThemeProviderContextType | undefined>(undefined);

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange={false}
      {...props}
    >
      <ThemeSync>
        {children}
      </ThemeSync>
    </NextThemesProvider>
  );
}

function ThemeSync({ children }: { children: React.ReactNode }) {
  const { preferences, savePreferences } = useUserPreferences();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && preferences?.tema) {
      const themeMap: Record<string, string> = {
        'claro': 'light',
        'escuro': 'dark'
      };
      
      const nextTheme = themeMap[preferences.tema] || 'light';
      
      // Apply theme directly to document
      if (nextTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [mounted, preferences?.tema]);

  if (!mounted) {
    return null;
  }

  return <>{children}</>;
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  
  return context;
};