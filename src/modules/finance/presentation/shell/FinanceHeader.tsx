/**
 * FinanceHeader — cabeçalho global do módulo Financeiro.
 * Hospeda o botão único "+ Novo lançamento" + menu contextual (Etapa 2).
 * Posição imutável entre Visão Geral, Fluxo Financeiro e Gerenciar.
 */
import { memo } from 'react';
import NovoLancamentoMenu from './NovoLancamentoMenu';
import type { LancamentoTipo } from '@/modules/finance/domain/lancamentoTipos';

interface FinanceHeaderProps {
  onSelectTipo: (tipo: LancamentoTipo) => void;
}

export const FinanceHeader = memo(function FinanceHeader({ onSelectTipo }: FinanceHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-4 pb-4">
      <div className="flex items-center gap-3">
        <h1 className="font-heading text-[15px] font-semibold tracking-tight text-foreground">
          Financeiro
        </h1>
      </div>

      <NovoLancamentoMenu onSelectTipo={onSelectTipo} />
    </header>
  );
});

export default FinanceHeader;
