import { createContext, useContext, ReactNode, useMemo } from 'react';
import { GalleryTheme } from '@/types/themes';
import { GallerySettings, GlobalSettings } from '@/types/gallery';
import { getSafeTheme, mergeThemeOverrides } from '@/lib/themeUtils';
import { resolveGalleryColorTokens } from '@/components/gallery/themes/tokens';


interface GalleryThemeContextType {
  theme: GalleryTheme;
  cssVars: Record<string, string>;
  backgroundMode: 'light' | 'dark';
  footer?: {
    whatsapp?: string;
    maps?: string;
    instagrams?: string[];
  };
}

const GalleryThemeContext = createContext<GalleryThemeContextType | undefined>(undefined);

interface GalleryThemeProviderProps {
  children: ReactNode;
  gallerySettings?: Partial<GallerySettings>;
  globalSettings?: Partial<GlobalSettings>;
  activeThemeId?: string;
  themeOverrides?: Partial<GalleryTheme>;
  backgroundMode?: 'light' | 'dark';
  customPrimaryColor?: string;
  footer?: {
    whatsapp?: string;
    maps?: string;
    instagrams?: string[];
  };
}

export function GalleryThemeProvider({
  children,
  gallerySettings,
  globalSettings,
  activeThemeId,
  themeOverrides,
  backgroundMode = 'light',
  customPrimaryColor,
  footer
}: GalleryThemeProviderProps) {
  
  const resolvedTheme = useMemo(() => {
    const themeId = activeThemeId || globalSettings?.defaultThemeId || 'lunari';
    let theme = getSafeTheme(themeId);

    if (globalSettings?.themeOverrides) {
      theme = mergeThemeOverrides(theme, globalSettings.themeOverrides as any);
    }
    
    if (themeOverrides) {
      theme = mergeThemeOverrides(theme, themeOverrides as any);
    }

    // Gap handling: Prefer themeOverrides.layout.gap if it exists
    if ((themeOverrides as any)?.layout?.gap !== undefined) {
      theme.layout.gap = Number((themeOverrides as any).layout.gap);
    } else if (gallerySettings?.photoSpacing !== undefined) {
      theme.layout.gap = Number(gallerySettings.photoSpacing);
    } else if (globalSettings?.defaultPhotoSpacing !== undefined) {
      theme.layout.gap = Number(globalSettings.defaultPhotoSpacing);
    }
    
    if (gallerySettings?.sessionFont) {
      theme.typography = { ...theme.typography, sessionFont: gallerySettings.sessionFont };
    }
    
    if (gallerySettings?.titleCaseMode) {
      theme.typography = { ...theme.typography, titleCaseMode: gallerySettings.titleCaseMode };
    }

    return theme;
  }, [gallerySettings, globalSettings, activeThemeId, themeOverrides]);

  const cssVars = useMemo(() => {
    // Resolve a cor primária: custom do fotógrafo > padrão do tema > dourado Lunari
    const resolvedPrimary = customPrimaryColor
      || resolvedTheme.surface.primaryColor
      || undefined;

    // Tokens de cor (light/dark) a partir da paleta centralizada
    const colorTokens = resolveGalleryColorTokens(backgroundMode, resolvedPrimary);

    // O fundo do tema de layout (Lunari, Clean, Editorial) sobrescreve o token de bg
    // apenas no modo light — no dark, sempre usamos o grafite da paleta
    const layoutBg = backgroundMode === 'light'
      ? (resolvedTheme.surface.background || colorTokens['--gallery-bg'])
      : colorTokens['--gallery-bg'];

    const vars: Record<string, string> = {
      ...colorTokens,
      '--gallery-bg': layoutBg,
      // Tokens de layout
      '--gallery-gap': `${resolvedTheme.layout.gap ?? 8}px`,
      '--gallery-cols-m': `${resolvedTheme.layout.columns.mobile}`,
      '--gallery-cols-t': `${resolvedTheme.layout.columns.tablet}`,
      '--gallery-cols-d': `${resolvedTheme.layout.columns.desktop}`,
      '--gallery-hover-scale': `${resolvedTheme.motion?.hoverScale ?? 1.005}`,
      '--gallery-row-unit': `${resolvedTheme.layout.rowUnit || 220}px`,
      '--gallery-radius': resolvedTheme.surface.borderRadius || '0px',
    };
    return vars;
  }, [resolvedTheme, backgroundMode, customPrimaryColor]);


  return (
    <GalleryThemeContext.Provider value={{ theme: resolvedTheme, cssVars, backgroundMode, footer }}>
      <div
        style={cssVars as any}
        className={`gallery-theme-root contents min-h-screen${backgroundMode === 'dark' ? ' dark' : ''}`}
        id="gallery-root"
      >
        {children}
      </div>
    </GalleryThemeContext.Provider>
  );
}

export function useGalleryDisplayTheme() {
  const context = useContext(GalleryThemeContext);
  if (!context) {
    throw new Error('useGalleryDisplayTheme must be used within a GalleryThemeProvider');
  }
  return context;
}
