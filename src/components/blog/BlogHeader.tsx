import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface BlogHeaderProps {
  showBackButton?: boolean;
}

export function BlogHeader({ showBackButton = false }: BlogHeaderProps) {
  return (
    <header className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {showBackButton && (
            <Link to="/conteudos">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
            </Link>
          )}
          <Link to="/conteudos" className="flex items-center gap-2">
            <span className="text-xl font-bold text-foreground">Lunari</span>
            <span className="text-sm text-muted-foreground">| Conteúdos</span>
          </Link>
        </div>
        
        <Button
          variant="default"
          size="sm"
          onClick={() => window.open('https://app.lunarihub.com/escolher-plano', '_blank')}
        >
          Experimentar grátis
        </Button>
      </div>
    </header>
  );
}
