/**
 * FinancePageContainer — largura única compartilhada pelas abas de Finanças.
 * Garante que PeriodActionBar e conteúdo fiquem alinhados entre Visão Geral,
 * Fluxo Financeiro e Gerenciar.
 */
import { memo, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  children: ReactNode;
  className?: string;
}

export const FinancePageContainer = memo(function FinancePageContainer({ children, className }: Props) {
  return <div className={cn('max-w-6xl mx-auto w-full', className)}>{children}</div>;
});

export default FinancePageContainer;
