import { SheetTitle } from '@/components/ui/sheet';
import { CreditCard, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChargeStepBadge, ChargeStep } from '../ChargeStepBadge';

interface ChargeModalHeaderProps {
  finalidade?: 'sessao' | 'fotos_extras' | 'sessao_e_extras';
  clienteNome?: string;
  step?: ChargeStep | null;
  nomeSessao?: string;
  activeTab: 'cobrar' | 'historico';
  onTabChange: (tab: 'cobrar' | 'historico') => void;
  cobrancasCount: number;
}

export function ChargeModalHeader({
  finalidade = 'sessao',
  clienteNome,
  step,
  nomeSessao,
  activeTab,
  onTabChange,
  cobrancasCount,
}: ChargeModalHeaderProps) {
  return (
    <header className="shrink-0 pt-3.5 pb-0 px-4 border-b border-border/60 relative">
      <div className="flex items-center justify-between mb-3 pr-6">
        <SheetTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
          <CreditCard className="h-4 w-4 text-accent-gold" />
          {finalidade === 'fotos_extras'
            ? 'Cobrar fotos extras'
            : finalidade === 'sessao_e_extras'
            ? 'Cobrar tudo (link único)'
            : 'Cobrar cliente'}
          <span className="text-sm font-normal text-muted-foreground ml-1">· {clienteNome}</span>
        </SheetTitle>
        {step ? <ChargeStepBadge step={step} /> : null}
      </div>

      {nomeSessao && (
        <div className="text-xs text-muted-foreground mb-2">
          Sessão: <strong className="text-foreground">{nomeSessao}</strong>
        </div>
      )}

      <div className="flex items-center gap-6">
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 pb-2.5 border-b-2 text-xs font-semibold transition-colors cursor-pointer",
            activeTab === 'cobrar' ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          onClick={() => onTabChange('cobrar')}
        >
          <CreditCard className="h-3.5 w-3.5" />
          Nova cobrança
        </button>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 pb-2.5 border-b-2 text-xs font-semibold transition-colors cursor-pointer",
            activeTab === 'historico' ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          onClick={() => onTabChange('historico')}
        >
          <History className="h-3.5 w-3.5" />
          Histórico ({cobrancasCount})
        </button>
      </div>
    </header>
  );
}
