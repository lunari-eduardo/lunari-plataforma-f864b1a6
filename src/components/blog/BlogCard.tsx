import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, ArrowRight } from 'lucide-react';
import type { BlogPost } from '@/hooks/useBlogPosts';

interface BlogCardProps {
  post: BlogPost;
}

export function BlogCard({ post }: BlogCardProps) {
  const publishedDate = post.published_at 
    ? format(new Date(post.published_at), "d 'de' MMMM, yyyy", { locale: ptBR })
    : null;

  return (
    <Link
      to={`/conteudos/${post.slug}`}
      className="group block bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 hover:shadow-lg transition-all duration-300"
    >
      {post.featured_image_url && (
        <div className="aspect-video bg-muted overflow-hidden">
          <img
            src={post.featured_image_url}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}
      
      <div className="p-6">
        {publishedDate && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <CalendarDays className="h-4 w-4" />
            <time dateTime={post.published_at || ''}>{publishedDate}</time>
          </div>
        )}
        
        <h2 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors mb-2 line-clamp-2">
          {post.title}
        </h2>
        
        {post.meta_description && (
          <p className="text-muted-foreground line-clamp-3 mb-4">
            {post.meta_description}
          </p>
        )}
        
        <div className="flex items-center gap-2 text-primary font-medium">
          <span>Ler artigo</span>
          <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </Link>
  );
}
