import { useEffect, useMemo } from 'react';
import { useImageProtection } from '@/hooks/useImageProtection';
import { useGalleryBranding } from '@/hooks/useGalleryBranding';
import { applyTheme, DEFAULT_THEME, type VisualThemeMode } from '@/lib/visualTheme';
import { resolveGalleryColorTokens } from '@/components/gallery/themes/tokens';
import { hexToHsl } from '../types';

interface UseClientGalleryThemeProps {
  galleryResponse: any;
  sessionName?: string;
}

export function useClientGalleryTheme({
  galleryResponse,
  sessionName,
}: UseClientGalleryThemeProps) {
  // Apply image protection (blocks print, right-click, shortcuts)
  useImageProtection();

  // Hook de branding: favicon dinâmico e título da aba com nome fantasia do fotógrafo (com fallback Lunari)
  useGalleryBranding({
    sessionName: sessionName || galleryResponse?.sessionName,
    studioSettings: galleryResponse?.studioSettings,
  });

  // Priority: clientMode (gallery decision) > theme.backgroundMode > 'light'
  const effectiveBackgroundMode: 'light' | 'dark' = useMemo(() => {
    const raw = galleryResponse?.clientMode || galleryResponse?.theme?.backgroundMode || 'light';
    return raw === 'dark' ? 'dark' : 'light';
  }, [galleryResponse?.clientMode, galleryResponse?.theme?.backgroundMode]);

  // Aplica tema do Studio do fotógrafo (preset + mode) na galeria pública.
  // Não persiste no localStorage — apenas overlay temporário enquanto o visitante
  // está na rota pública.
  useEffect(() => {
    if (galleryResponse) {
      const mode = galleryResponse.clientMode || galleryResponse.studioSettings?.clientTheme || 'light';
      applyTheme({
        presetId: 'graphite',
        mode: mode as VisualThemeMode,
      });
    }
  }, [galleryResponse]);

  // Restaurar default ao sair da rota pública
  useEffect(() => {
    return () => {
      applyTheme(DEFAULT_THEME);
    };
  }, []);

  // Preconnect para o host do provedor de pagamento assim que sabemos qual é.
  // Reduz DNS + TLS na hora do redirect (~200-500ms perceptivos).
  // Só dispara quando saleMode === 'sale_with_payment' para não abrir socket desnecessário em galerias no_sale.
  useEffect(() => {
    if (!galleryResponse) return;
    const g: any = (galleryResponse as any).gallery || galleryResponse;
    const settings: any =
      (galleryResponse as any).saleSettings ||
      g?.saleSettings ||
      g?.configuracoes?.saleSettings ||
      null;
    if (!settings || settings.mode !== 'sale_with_payment') return;
    const method: string | undefined = settings.paymentMethod || g?.venda_pagamento_provedor;
    const HOSTS: Record<string, string> = {
      infinitepay: 'https://checkout.infinitepay.io',
      mercadopago: 'https://www.mercadopago.com.br',
    };
    const host = method ? HOSTS[method] : undefined;
    if (!host) return;

    const links: HTMLLinkElement[] = [];
    const mk = (rel: string) => {
      const l = document.createElement('link');
      l.rel = rel;
      l.href = host;
      if (rel === 'preconnect') l.crossOrigin = 'anonymous';
      document.head.appendChild(l);
      links.push(l);
    };
    mk('preconnect');
    mk('dns-prefetch');
    return () => {
      links.forEach((l) => l.parentNode?.removeChild(l));
    };
  }, [galleryResponse]);

  // Build dynamic CSS variables from custom theme
  const themeStyles = useMemo(() => {
    const theme = galleryResponse?.theme;
    const backgroundMode: 'light' | 'dark' = (galleryResponse?.clientMode === 'dark' || theme?.backgroundMode === 'dark') ? 'dark' : 'light';
    const customPrimary = theme?.primaryColor || undefined;
    
    // Resolve standard gallery tokens (--gallery-primary, --gallery-primary-fg, etc.)
    const galleryTokens = resolveGalleryColorTokens(backgroundMode, customPrimary);
    
    // Base colors depend on background mode (always applied, even for system theme)
    const baseColors = backgroundMode === 'dark' ? {
      '--background': '0 0% 5%',
      '--foreground': '0 0% 95%',
      '--card': '0 0% 9%',
      '--card-foreground': '0 0% 95%',
      '--muted': '0 0% 14%',
      '--muted-foreground': '0 0% 60%',
      '--border': '0 0% 16%',
      '--primary-foreground': '0 0% 5%',
      '--popover': '0 0% 9%',
      '--popover-foreground': '0 0% 95%',
      // Gradients for dark mode
      '--gradient-card': 'linear-gradient(180deg, hsl(0 0% 10%) 0%, hsl(0 0% 7%) 100%)',
    } : {
      '--background': '30 25% 97%',
      '--foreground': '25 20% 15%',
      '--card': '30 20% 99%',
      '--card-foreground': '25 20% 15%',
      '--muted': '30 15% 92%',
      '--muted-foreground': '25 10% 45%',
      '--border': '30 15% 88%',
      '--primary-foreground': '30 25% 98%',
      '--popover': '30 20% 99%',
      '--popover-foreground': '25 20% 15%',
      // Gradients for light mode
      '--gradient-card': 'linear-gradient(180deg, hsl(30 20% 99%) 0%, hsl(30 15% 96%) 100%)',
    };
    
    const primaryHex = customPrimary || galleryTokens['--gallery-primary'];
    const primaryHsl = hexToHsl(primaryHex);
    const accentHsl = theme?.accentColor ? hexToHsl(theme.accentColor) : null;
    
    return {
      ...baseColors,
      ...galleryTokens,
      '--gallery-primary': primaryHex,
      '--gallery-primary-fg': galleryTokens['--gallery-primary-fg'],
      '--gallery-primary-foreground': galleryTokens['--gallery-primary-fg'],
      '--primary': primaryHsl || '39 35% 60%',
      '--accent': accentHsl || '39 35% 60%',
      '--ring': primaryHsl || '39 35% 60%',
    } as React.CSSProperties;
  }, [galleryResponse?.theme, galleryResponse?.clientMode]);

  return {
    effectiveBackgroundMode,
    themeStyles,
  };
}
