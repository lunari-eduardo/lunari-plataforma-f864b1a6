import { useLocation, useNavigate } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import { useHelpArticleByRoute } from '@/hooks/useHelpArticles';
import { useIsMobile } from '@/hooks/use-mobile';

/**
 * Botão flutuante de ajuda contextual
 * Aparece translúcido no canto inferior direito
 * Navega para o artigo de ajuda da página atual ou índice geral
 */
export function HelpFloatingButton() {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Normalizar pathname para match (ex: /app/clientes/123 → /app/clientes)
  const normalizedPath = location.pathname.replace(/\/[0-9a-f-]{36}$/i, '');
  const { data: helpArticle } = useHelpArticleByRoute(normalizedPath);

  const handleClick = () => {
    if (helpArticle) {
      navigate(`/app/ajuda/${helpArticle.slug}`);
    } else {
      navigate('/app/ajuda');
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`fixed z-50 flex items-center justify-center rounded-full 
        bg-foreground/10 backdrop-blur-sm border border-foreground/5
        opacity-30 hover:opacity-100 transition-all duration-300
        hover:bg-foreground/20 hover:scale-110 hover:shadow-lg
        ${isMobile ? 'bottom-24 right-4 h-10 w-10' : 'bottom-6 right-6 h-11 w-11'}`}
      title={helpArticle ? `Ajuda: ${helpArticle.title}` : 'Centro de Ajuda'}
      aria-label="Abrir ajuda"
    >
      <HelpCircle className="h-5 w-5 text-foreground/70" />
    </button>
  );
}
