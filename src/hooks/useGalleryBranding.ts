import { useEffect } from 'react';

export interface GalleryBrandingSettings {
  studio_name?: string | null;
  brand_name?: string | null;
  empresa?: string | null;
  photographer_name?: string | null;
  studio_logo_url?: string | null;
  favicon_url?: string | null;
}

interface UseGalleryBrandingProps {
  sessionName?: string | null;
  studioSettings?: GalleryBrandingSettings | null;
}

const DEFAULT_LUNARI_TITLE = 'Lunari';
const DEFAULT_LUNARI_FAVICON = '/favicon.png';

/**
 * Hook para sincronizar dinamicamente o favicon e o título da aba do navegador (Nome Fantasia)
 * nas galerias de seleção e de entrega.
 * Se o fotógrafo não tiver configurado nome fantasia / favicon, utiliza a base Lunari.
 * Restaura o estado padrão da aplicação quando o usuário sai da galeria.
 */
export function useGalleryBranding({ sessionName, studioSettings }: UseGalleryBrandingProps) {
  useEffect(() => {
    // 1. Resolver o Nome Fantasia / Marca do Fotógrafo
    const brandCandidate = (
      (studioSettings?.brand_name && String(studioSettings.brand_name).trim()) ||
      (studioSettings?.studio_name && String(studioSettings.studio_name).trim() !== 'Meu Estúdio' && String(studioSettings.studio_name).trim()) ||
      (studioSettings?.empresa && String(studioSettings.empresa).trim()) ||
      (studioSettings?.photographer_name && String(studioSettings.photographer_name).trim()) ||
      null
    );

    // 2. Definir o título da aba
    const cleanSession = (sessionName || '').trim();
    let computedTitle = DEFAULT_LUNARI_TITLE;

    if (cleanSession && brandCandidate) {
      computedTitle = `${cleanSession} — ${brandCandidate}`;
    } else if (cleanSession) {
      computedTitle = `${cleanSession} — ${DEFAULT_LUNARI_TITLE}`;
    } else if (brandCandidate) {
      computedTitle = `${brandCandidate} — ${DEFAULT_LUNARI_TITLE}`;
    }

    const previousTitle = document.title;
    document.title = computedTitle;

    // 3. Resolver o Favicon
    const customFavicon = (
      (studioSettings?.favicon_url && String(studioSettings.favicon_url).trim()) ||
      (studioSettings?.studio_logo_url && String(studioSettings.studio_logo_url).trim()) ||
      null
    );

    let iconLink = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    const previousFavicon = iconLink?.href || DEFAULT_LUNARI_FAVICON;

    if (customFavicon) {
      if (!iconLink) {
        iconLink = document.createElement('link');
        iconLink.rel = 'icon';
        document.head.appendChild(iconLink);
      }
      iconLink.href = customFavicon;
    } else if (iconLink) {
      iconLink.href = DEFAULT_LUNARI_FAVICON;
    }

    // 4. Restaurar estado ao sair da rota pública
    return () => {
      document.title = previousTitle || DEFAULT_LUNARI_TITLE;
      if (iconLink) {
        iconLink.href = previousFavicon || DEFAULT_LUNARI_FAVICON;
      }
    };
  }, [sessionName, studioSettings]);
}
