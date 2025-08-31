import { memo, ReactNode } from 'react';
import { useResponsiveFinancas } from '@/hooks/useResponsiveFinancas';

interface FinancasLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}

/**
 * Layout padrão centralizado para páginas financeiras
 * Implementa responsividade e padrões visuais consistentes
 */
const FinancasLayout = memo(function FinancasLayout({
  children,
  title,
  subtitle,
  actions
}: FinancasLayoutProps) {
  const { isMobile, layout } = useResponsiveFinancas();
  
  return (
    <div className="min-h-screen bg-lunar-bg">
      <div className={`
        w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 
        ${layout.espacamento} 
        py-4 md:py-6
      `}>
        {/* Cabeçalho da página */}
        {(title || actions) && (
          <header className={`
            flex flex-col ${isMobile ? 'space-y-4' : 'sm:flex-row sm:items-center sm:justify-between'}
            mb-6
          `}>
            {title && (
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-lunar-text">
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-sm text-lunar-textSecondary mt-1">
                    {subtitle}
                  </p>
                )}
              </div>
            )}
            
            {actions && (
              <div className="flex items-center gap-3">
                {actions}
              </div>
            )}
          </header>
        )}
        
        {/* Conteúdo principal */}
        <main className={layout.espacamento}>
          {children}
        </main>
      </div>
    </div>
  );
});

export default FinancasLayout;