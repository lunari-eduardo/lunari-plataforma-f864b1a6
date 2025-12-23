import { useEffect } from 'react';

interface SEOHeadProps {
  title: string;
  description?: string;
  canonical?: string;
  noindex?: boolean;
  ogImage?: string;
  ogType?: string;
}

/**
 * Componente para gerenciar meta tags SEO dinamicamente
 */
export function SEOHead({
  title,
  description,
  canonical,
  noindex = false,
  ogImage,
  ogType = 'article',
}: SEOHeadProps) {
  useEffect(() => {
    // Title
    document.title = title;

    // Meta tags helper
    const setMeta = (name: string, content: string, isProperty = false) => {
      const attr = isProperty ? 'property' : 'name';
      let meta = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attr, name);
        document.head.appendChild(meta);
      }
      meta.content = content;
    };

    // Description
    if (description) {
      setMeta('description', description);
      setMeta('og:description', description, true);
    }

    // Robots
    if (noindex) {
      setMeta('robots', 'noindex, nofollow');
    } else {
      const robotsMeta = document.querySelector('meta[name="robots"]');
      if (robotsMeta) {
        robotsMeta.remove();
      }
    }

    // Canonical
    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (canonical) {
      if (!canonicalLink) {
        canonicalLink = document.createElement('link');
        canonicalLink.rel = 'canonical';
        document.head.appendChild(canonicalLink);
      }
      canonicalLink.href = canonical;
    } else if (canonicalLink) {
      canonicalLink.remove();
    }

    // Open Graph
    setMeta('og:title', title, true);
    setMeta('og:type', ogType, true);
    
    if (ogImage) {
      setMeta('og:image', ogImage, true);
    }

    if (canonical) {
      setMeta('og:url', canonical, true);
    }

    // Cleanup on unmount
    return () => {
      // Reset to default title
      document.title = 'Lunari';
    };
  }, [title, description, canonical, noindex, ogImage, ogType]);

  return null;
}
