import React, { useEffect, useMemo } from 'react';
import { resolveGalleryColorTokens } from '@/components/gallery/themes/tokens';

export function hexToHsl(hex: string): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

interface PublicThemeWrapperProps {
  children: React.ReactNode;
  primaryColor?: string;
  className?: string;
}

/**
 * PublicThemeWrapper
 * 
 * Enforces 'light' mode on the document for public-facing pages (Checkouts, Forms, etc.)
 * and injects the photographer's custom primary color dynamically into standard Tailwind variables.
 */
export function PublicThemeWrapper({ children, primaryColor, className = '' }: PublicThemeWrapperProps) {
  useEffect(() => {
    const html = document.documentElement;
    const hadDark = html.classList.contains('dark');
    html.classList.remove('dark');
    html.classList.add('light');
    
    return () => {
      html.classList.remove('light');
      if (hadDark) html.classList.add('dark');
    };
  }, []);

  const themeStyles = useMemo(() => {
    const effectiveColor = primaryColor || '#C6A36A';
    // We always resolve against the 'light' base for these pages.
    const tokens = resolveGalleryColorTokens('light', effectiveColor);
    
    const styles: React.CSSProperties = {
      // Inject standard gallery tokens for components that might use them directly
      ...(tokens as any),
    };

    const primaryHsl = hexToHsl(effectiveColor);
    const primaryFgHex = tokens['--gallery-primary-fg'];
    const primaryFgHsl = hexToHsl(primaryFgHex);

    if (primaryHsl) {
      // Override standard Tailwind variables so native shadcn/ui components pick it up
      styles['--primary'] = primaryHsl;
      styles['--ring'] = primaryHsl;
    }
    if (primaryFgHsl) {
      styles['--primary-foreground'] = primaryFgHsl;
    }

    return styles;
  }, [primaryColor]);

  return (
    <div className={`min-h-screen bg-[hsl(30,20%,97%)] text-neutral-900 ${className}`} style={themeStyles}>
      {children}
    </div>
  );
}
