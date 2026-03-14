import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface HelpArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  route_reference: string | null;
  featured_image_url: string | null;
  display_order: number;
  published_at: string | null;
  created_at: string;
}

/**
 * Busca todos os artigos de ajuda publicados
 */
export function useHelpArticles() {
  return useQuery({
    queryKey: ['help_articles'],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('blog_posts')
        .select('*') as any)
        .eq('type', 'help')
        .eq('status', 'published')
        .order('display_order', { ascending: true });

      if (error) throw error;
      return (data || []) as HelpArticle[];
    },
  });
}

/**
 * Busca artigo de ajuda por slug
 */
export function useHelpArticleBySlug(slug: string) {
  return useQuery({
    queryKey: ['help_articles', 'slug', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', slug)
        .eq('type' as any, 'help')
        .eq('status', 'published')
        .single();

      if (error) throw error;
      return data as unknown as HelpArticle;
    },
    enabled: !!slug,
  });
}

/**
 * Busca artigo de ajuda pela rota de referência (para o botão flutuante)
 */
export function useHelpArticleByRoute(route: string) {
  return useQuery({
    queryKey: ['help_articles', 'route', route],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('id, slug, title')
        .eq('type' as any, 'help')
        .eq('status', 'published')
        .eq('route_reference' as any, route)
        .maybeSingle();

      if (error) throw error;
      return data as { id: string; slug: string; title: string } | null;
    },
    enabled: !!route,
    staleTime: 5 * 60 * 1000, // Cache por 5 min
  });
}
