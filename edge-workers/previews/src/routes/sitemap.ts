import { Context } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { Bindings } from '../index.js';

export async function sitemapRoute(c: Context<{ Bindings: Bindings }>) {
  try {
    const supabaseUrl = c.env.SUPABASE_URL;
    const supabaseAnonKey = c.env.SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Fetch published blog posts
    const { data: posts, error } = await supabase
      .from('blog_posts')
      .select('slug, updated_at, published_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false });

    if (error) {
      console.error('Error fetching posts:', error);
      throw error;
    }

    const baseUrl = 'https://www.lunarihub.com';
    const today = new Date().toISOString().split('T')[0];

    // Build sitemap XML with all public pages
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/conteudos</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;

    if (posts && posts.length > 0) {
      for (const post of posts) {
        const lastmod = post.updated_at 
          ? new Date(post.updated_at).toISOString().split('T')[0]
          : post.published_at 
            ? new Date(post.published_at).toISOString().split('T')[0]
            : today;

        xml += `
  <url>
    <loc>${baseUrl}/conteudos/${post.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;
      }
    }

    xml += `
</urlset>`;

    console.log(`Sitemap generated with ${posts?.length || 0} posts`);

    // Hono will automatically set Content-Type if we use c.text and then we can override it,
    // or just use c.body and set headers manually.
    c.header('Content-Type', 'application/xml');
    
    // Add cache headers for Cloudflare Edge (Cache for 1 hour, stale-while-revalidate for 24 hours)
    c.header('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400');
    
    return c.text(xml);
  } catch (error) {
    console.error('Error generating sitemap:', error);
    const fallbackXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.lunarihub.com/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <priority>1.0</priority>
  </url>
</urlset>`;
    
    c.header('Content-Type', 'application/xml');
    return c.text(fallbackXml);
  }
}
