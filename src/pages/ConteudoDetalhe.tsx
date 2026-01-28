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

  const canonicalUrl = `https://app.lunarihub.com/conteudos/${post.slug}`;
  
  // Decodificar HTML entities caso o conteúdo tenha sido escapado incorretamente
  const decodeHtmlEntities = (text: string): string => {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  };

  // Remover tags wrapper indesejadas (h2 com data-attributes) e limpar conteúdo
  const cleanContent = (html: string): string => {
    // Decodificar entities escapadas
    let cleaned = decodeHtmlEntities(html);
    // Remover tags h2 vazias com atributos data-*
    cleaned = cleaned.replace(/<h2[^>]*data-[^>]*>(\s*<br\s*\/?>\s*)?<\/h2>/gi, '');
    // Remover <br> soltos entre tags
    cleaned = cleaned.replace(/<\/h[1-6]>\s*<br\s*\/?>\s*<h[1-6]/gi, (match) => 
      match.replace(/<br\s*\/?>/gi, '')
    );
    return cleaned;
  };
  
  // Sanitizar conteúdo HTML com tags semânticas permitidas para SEO
  const sanitizedContent = DOMPurify.sanitize(cleanContent(post.content), {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'div', 'span',
      'strong', 'em', 'u', 'b', 'i',
      'ul', 'ol', 'li',
      'blockquote',
      'a', 'img',
      'figure', 'figcaption'
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'target', 'rel', 'loading']
  });

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
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold font-serif text-foreground mb-4 leading-tight">
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
          
          {/* Conteúdo do artigo com tipografia editorial */}
          <div 
            className="prose prose-lg dark:prose-invert max-w-none font-body
              prose-headings:font-serif prose-headings:text-foreground prose-headings:font-semibold
              prose-h1:text-3xl prose-h1:mt-16 prose-h1:mb-8
              prose-h2:text-2xl prose-h2:mt-14 prose-h2:mb-6 prose-h2:border-b prose-h2:border-border prose-h2:pb-3
              prose-h3:text-xl prose-h3:mt-10 prose-h3:mb-4
              prose-p:text-foreground/90 prose-p:leading-[1.8] prose-p:text-lg prose-p:my-6
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline
              prose-strong:text-foreground prose-strong:font-semibold
              prose-ul:text-foreground/90 prose-ul:my-6 prose-ol:text-foreground/90 prose-ol:my-6 prose-li:my-2
              prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:bg-muted/30 prose-blockquote:rounded-r-lg prose-blockquote:py-4 prose-blockquote:px-6 prose-blockquote:italic prose-blockquote:font-serif prose-blockquote:text-lg prose-blockquote:my-10
              prose-figure:my-12 prose-figure:mx-0
              prose-figcaption:text-center prose-figcaption:text-sm prose-figcaption:text-muted-foreground prose-figcaption:mt-4 prose-figcaption:italic prose-figcaption:font-body
              prose-img:rounded-xl prose-img:shadow-lg prose-img:mx-auto prose-img:my-0"
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
