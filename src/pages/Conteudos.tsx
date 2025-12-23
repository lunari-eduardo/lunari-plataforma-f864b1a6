import { SEOHead } from '@/components/seo/SEOHead';
import { BlogHeader } from '@/components/blog/BlogHeader';
import { BlogCard } from '@/components/blog/BlogCard';
import { usePublishedPosts } from '@/hooks/useBlogPosts';
import { Loader2, FileText } from 'lucide-react';

/**
 * Página pública de listagem de conteúdos/blog
 * Rota: /conteudos
 */
export default function Conteudos() {
  const { data: posts, isLoading, error } = usePublishedPosts();

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Conteúdos para Fotógrafos | Lunari"
        description="Dicas, tutoriais e conteúdos exclusivos para fotógrafos que querem crescer no mercado. Aprenda sobre precificação, gestão e muito mais."
        canonical="https://www.lunariplataforma.com.br/conteudos"
      />
      
      <BlogHeader />
      
      <main className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Conteúdos para Fotógrafos
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Dicas, tutoriais e insights para você crescer como fotógrafo profissional
          </p>
        </div>
        
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        
        {error && (
          <div className="text-center py-12">
            <p className="text-destructive">Erro ao carregar conteúdos.</p>
          </div>
        )}
        
        {!isLoading && !error && posts && posts.length === 0 && (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum conteúdo publicado ainda.</p>
          </div>
        )}
        
        {posts && posts.length > 0 && (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <BlogCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </main>
      
      <footer className="border-t border-border py-8 mt-12">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Lunari. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
