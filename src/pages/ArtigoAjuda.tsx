import { useParams, Navigate, Link } from 'react-router-dom';
import { SEOHead } from '@/components/seo/SEOHead';
import { useHelpArticleBySlug, useHelpArticles } from '@/hooks/useHelpArticles';
import { Loader2, ArrowLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DOMPurify from 'dompurify';

/**
 * Página de artigo de ajuda individual
 * Rota: /app/ajuda/:slug
 */
export default function ArtigoAjuda() {
  const { slug } = useParams<{ slug: string }>();
  const { data: article, isLoading, error } = useHelpArticleBySlug(slug || '');
  const { data: allArticles } = useHelpArticles();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !article) {
    return <Navigate to="/app/ajuda" replace />;
  }

  // Sanitizar conteúdo
  const sanitizedContent = DOMPurify.sanitize(article.content, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'p', 'br', 'div', 'span',
      'strong', 'em', 'u', 'b', 'i',
      'ul', 'ol', 'li',
      'blockquote',
      'a', 'img',
      'figure', 'figcaption',
      'iframe', 'video', 'source'
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'class', 'target', 'rel', 'loading',
      'width', 'height', 'frameborder', 'allow', 'allowfullscreen',
      'controls', 'autoplay', 'loop', 'muted', 'type'
    ],
  });

  // Sidebar: outros artigos
  const otherArticles = allArticles?.filter(a => a.id !== article.id) || [];

  return (
    <div className="max-w-6xl mx-auto">
      <SEOHead title={`${article.title} | Ajuda Lunari`} noindex />

      <div className="flex gap-8">
        {/* Conteúdo principal */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/app/ajuda" className="hover:text-foreground transition-colors">
              Centro de Ajuda
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium truncate">{article.title}</span>
          </div>

          <Link to="/app/ajuda">
            <Button variant="ghost" size="sm" className="gap-2 -ml-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </Link>

          <article>
            <h1 className="text-3xl font-bold font-sans text-foreground mb-8 leading-tight">
              {article.title}
            </h1>

            {article.featured_image_url && (
              <div className="aspect-video rounded-xl overflow-hidden mb-8 bg-muted">
                <img
                  src={article.featured_image_url}
                  alt={article.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Conteúdo com tipografia Inter limpa */}
            <div
              className="prose prose-lg dark:prose-invert max-w-none font-sans
                prose-headings:font-sans prose-headings:text-foreground prose-headings:font-semibold
                prose-h1:text-2xl prose-h1:mt-12 prose-h1:mb-6
                prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:border-b prose-h2:border-border prose-h2:pb-2
                prose-h3:text-lg prose-h3:mt-8 prose-h3:mb-3
                prose-p:text-foreground/85 prose-p:leading-relaxed prose-p:text-base prose-p:my-4
                prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                prose-strong:text-foreground prose-strong:font-semibold
                prose-ul:text-foreground/85 prose-ul:my-4 prose-ol:text-foreground/85 prose-ol:my-4 prose-li:my-1
                prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:bg-muted/30 prose-blockquote:rounded-r-lg prose-blockquote:py-3 prose-blockquote:px-5 prose-blockquote:italic prose-blockquote:my-6
                prose-img:rounded-xl prose-img:shadow-md prose-img:mx-auto prose-img:my-6
                [&_iframe]:w-full [&_iframe]:aspect-video [&_iframe]:rounded-xl [&_iframe]:my-6
                [&_video]:w-full [&_video]:rounded-xl [&_video]:my-6"
              dangerouslySetInnerHTML={{ __html: sanitizedContent }}
            />
          </article>
        </div>

        {/* Sidebar de navegação */}
        {otherArticles.length > 0 && (
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-4 space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Outros artigos
              </h3>
              <nav className="space-y-1">
                {otherArticles.map((a) => (
                  <Link
                    key={a.id}
                    to={`/app/ajuda/${a.slug}`}
                    className="block px-3 py-2 text-sm rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    {a.title}
                  </Link>
                ))}
              </nav>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
