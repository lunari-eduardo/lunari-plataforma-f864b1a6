import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/seo/SEOHead';
import { useHelpArticles } from '@/hooks/useHelpArticles';
import { Loader2, BookOpen, ArrowRight } from 'lucide-react';

/**
 * Centro de Ajuda — Lista de artigos de ajuda
 * Rota: /app/ajuda
 */
export default function CentroAjuda() {
  const { data: articles, isLoading } = useHelpArticles();

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <SEOHead title="Centro de Ajuda | Lunari" noindex />

      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold font-sans text-foreground">Centro de Ajuda</h1>
        <p className="text-muted-foreground text-lg">
          Tutoriais e guias para usar o Lunari
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : articles && articles.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {articles.map((article) => (
            <Link
              key={article.id}
              to={`/app/ajuda/${article.slug}`}
              className="group p-6 rounded-xl border border-border bg-card hover:bg-muted/50 transition-all duration-200 hover:shadow-md"
            >
              {article.featured_image_url && (
                <div className="aspect-video rounded-lg overflow-hidden mb-4 bg-muted">
                  <img
                    src={article.featured_image_url}
                    alt={article.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold font-sans text-foreground group-hover:text-primary transition-colors">
                    {article.title}
                  </h2>
                  {article.route_reference && (
                    <p className="text-xs text-muted-foreground font-mono">
                      {article.route_reference.replace('/app/', '')}
                    </p>
                  )}
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 border rounded-xl bg-muted/20">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhum artigo de ajuda disponível ainda.</p>
        </div>
      )}
    </div>
  );
}
