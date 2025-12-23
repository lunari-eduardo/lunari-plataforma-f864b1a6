import { useParams, Navigate } from 'react-router-dom';
import { SEOHead } from '@/components/seo/SEOHead';
import { BlogHeader } from '@/components/blog/BlogHeader';
import { BlogCTA } from '@/components/blog/BlogCTA';
import { usePostBySlug } from '@/hooks/useBlogPosts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, CalendarDays, User } from 'lucide-react';
import DOMPurify from 'dompurify';

/**
 * Página pública de artigo individual
 * Rota: /conteudos/:slug
 */
export default function ConteudoDetalhe() {
  const { slug } = useParams<{ slug: string }>();
  const { data: post, isLoading, error } = usePostBySlug(slug || '');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !post) {
    return <Navigate to="/conteudos" replace />;
  }

  const publishedDate = post.published_at 
    ? format(new Date(post.published_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })
    : null;

  const canonicalUrl = `https://www.lunariplataforma.com.br/conteudos/${post.slug}`;
  
  // Sanitizar conteúdo HTML
  const sanitizedContent = DOMPurify.sanitize(post.content);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={post.meta_title || `${post.title} | Lunari`}
        description={post.meta_description || post.title}
        canonical={canonicalUrl}
        ogImage={post.featured_image_url || undefined}
      />
      
      <BlogHeader showBackButton />
      
      <main className="container mx-auto px-4 py-12">
        <article className="max-w-3xl mx-auto">
          {/* Header do artigo */}
          <header className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">
              {post.title}
            </h1>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {publishedDate && (
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  <time dateTime={post.published_at || ''}>{publishedDate}</time>
                </div>
              )}
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>Equipe Lunari</span>
              </div>
            </div>
          </header>
          
          {/* Imagem destacada */}
          {post.featured_image_url && (
            <div className="aspect-video rounded-xl overflow-hidden mb-8">
              <img
                src={post.featured_image_url}
                alt={post.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          
          {/* Conteúdo do artigo */}
          <div 
            className="prose prose-lg dark:prose-invert max-w-none
              prose-headings:text-foreground prose-headings:font-bold
              prose-p:text-foreground/90 prose-p:leading-relaxed
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline
              prose-strong:text-foreground prose-strong:font-semibold
              prose-ul:text-foreground/90 prose-ol:text-foreground/90
              prose-blockquote:border-primary prose-blockquote:bg-muted/50 prose-blockquote:rounded-r-lg prose-blockquote:py-1
              prose-img:rounded-lg"
            dangerouslySetInnerHTML={{ __html: sanitizedContent }}
          />
          
          {/* CTA de conversão */}
          <BlogCTA />
        </article>
      </main>
      
      <footer className="border-t border-border py-8 mt-12">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Lunari. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
