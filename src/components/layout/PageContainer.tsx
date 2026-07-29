/**
 * PageContainer — largura padrão para todas as páginas do produto.
 * Espelha o padrão de Finanças (`max-w-6xl`) e oferece variantes.
 *
 * Variantes:
 *  - `default` → max-w-6xl (Dashboard, Config, Integrações, Assistente, etc.)
 *  - `wide`    → max-w-7xl (Workflow, Análise de Vendas, telas densas)
 *  - `narrow`  → max-w-4xl (Onboarding, Consent, formulários públicos)
 *  - `full`    → sem limite (fallback opt-out)
 */
import { memo, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'wide' | 'narrow' | 'full';

interface Props {
  children: ReactNode;
  className?: string;
  variant?: Variant;
}

const WIDTHS: Record<Variant, string> = {
  default: 'max-w-[79rem]',
  wide: 'max-w-7xl',
  narrow: 'max-w-4xl',
  full: '',
};

export const PageContainer = memo(function PageContainer({
  children,
  className,
  variant = 'default',
}: Props) {
  return (
    <div className={cn(WIDTHS[variant], 'mx-auto w-full px-4 md:px-6', className)}>
      {children}
    </div>
  );
});

export default PageContainer;
