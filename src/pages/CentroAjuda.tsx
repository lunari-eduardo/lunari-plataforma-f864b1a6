import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/seo/SEOHead';
import { useHelpArticles } from '@/hooks/useHelpArticles';
import { Loader2, BookOpen, ChevronRight, HelpCircle } from 'lucide-react';

/**
 * Centro de Ajuda — Lista de artigos de ajuda
 * Rota: /app/ajuda
 */
export default function CentroAjuda() {
  const { data: articles, isLoading } = useHelpArticles();

  return (
    <div className="max-w-6xl mx-auto w-full px-4 md:px-6 py-4 space-y-6">
      <SEOHead title="Centro de Ajuda | Lunari" noindex />

      <header className="flex items-start justify-between gap-4 pb-4">
        <div className="min-w-0 flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-muted-foreground" />
          <div>
            <h1 className="font-heading text-[15px] font-semibold tracking-tight text-foreground">
              Centro de Ajuda
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tutoriais e guias para usar o Lunari
            </p>
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : articles && articles.length > 0 ? (
        <nav className="border rounded-lg bg-card divide-y divide-border">
          {articles.map((article) => (
            <Link
              key={article.id}
              to={`/app/ajuda/${article.slug}`}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50 transition-colors group first:rounded-t-lg last:rounded-b-lg"
            >
              <div className="min-w-0">
                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                  {article.title}
                </span>
                {article.route_reference && (
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    {article.route_reference.replace('/app/', '')}
                  </p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </Link>
          ))}
        </nav>
      ) : (
        <div className="text-center py-16 border rounded-xl bg-muted/20">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhum artigo de ajuda disponível ainda.</p>
        </div>
      )}
    </div>
  );
}
