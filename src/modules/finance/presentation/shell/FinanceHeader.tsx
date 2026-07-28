/**
 * FinanceHeader — cabeçalho global do módulo Financeiro.
 * Contém apenas o título e o botão "Novo lançamento" fixo no canto superior direito.
 * Este botão NÃO pertence ao conteúdo da página: sua posição é imutável entre
 * Visão Geral, Fluxo Financeiro e Gerenciar (padrão de UX definitivo).
 */
import { memo } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FinanceHeaderProps {
  onNovoLancamento: () => void;
}

export const FinanceHeader = memo(function FinanceHeader({ onNovoLancamento }: FinanceHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-4 pb-4">
      <div className="flex items-center gap-3">
        <h1 className="font-heading text-[15px] font-semibold tracking-tight text-foreground">
          Financeiro
        </h1>
      </div>

      <Button
        onClick={onNovoLancamento}
        size="sm"
        className="gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
      >
        <Plus className="h-4 w-4" strokeWidth={2} />
        Novo lançamento
      </Button>
    </header>
  );
});

export default FinanceHeader;
