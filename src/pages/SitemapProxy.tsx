import { useEffect, useState } from 'react';

/**
 * Componente que serve como proxy para o sitemap.xml
 * Busca o conteúdo da Edge Function do Supabase e exibe como XML
 * Isso permite que o sitemap seja acessado via domínio principal
 */
export default function SitemapProxy() {
  const [xml, setXml] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSitemap = async () => {
      try {
        const response = await fetch(
          'https://tlnjspsywycbudhewsfv.supabase.co/functions/v1/sitemap'
        );
        const content = await response.text();
        setXml(content);
      } catch (error) {
        console.error('Error fetching sitemap:', error);
        setXml(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.lunariplataforma.com.br/landing</loc>
    <priority>1.0</priority>
  </url>
</urlset>`);
      } finally {
        setLoading(false);
      }
    };

    fetchSitemap();
  }, []);

  // Render XML content directly
  if (loading) {
    return null;
  }

  return (
    <pre
      style={{
        margin: 0,
        padding: 0,
        fontFamily: 'monospace',
        whiteSpace: 'pre-wrap',
        backgroundColor: 'white',
        color: 'black',
      }}
    >
      {xml}
    </pre>
  );
}
