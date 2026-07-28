/**
 * Seção 3 — Análise Financeira.
 * Fluxo de caixa com dados reais + previsão pontilhada opcional.
 * Header exibe o saldo inicial do ano (chip editável) e banner de descoberta.
 */
import { memo, useState } from 'react';
import { Pencil, Sparkles } from 'lucide-react';
import FluxoCaixaChart, { type FluxoCaixaPonto } from './FluxoCaixaChart';
import OpeningBalanceModal from './OpeningBalanceModal';
import { useOpeningHintDismissal, type OpeningBalanceOrigin } from '@/hooks/useOpeningBalance';
import { formatCurrency } from '@/utils/currencyUtils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  dadosMensais: FluxoCaixaPonto[];
  previsao?: FluxoCaixaPonto[];
  ano: number;
  openingBalance: number;
  openingBalanceOrigem: OpeningBalanceOrigin;
  openingBalanceAnoBase: number;
}

function tooltipText(origem: OpeningBalanceOrigin, anoBase: number) {
  if (origem === 'manual') return 'Saldo inicial definido manualmente.';
  if (origem === 'auto_rollover') return `Calculado automaticamente pelo fechamento de ${anoBase}.`;
  return 'Nenhum histórico anterior — padrão zero. Clique para definir.';
}

export const AnaliseSection = memo(function AnaliseSection({
  dadosMensais, previsao, ano, openingBalance, openingBalanceOrigem, openingBalanceAnoBase,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const { dismissedAt, dismiss } = useOpeningHintDismissal();
  const showHint = !dismissedAt && openingBalanceOrigem === 'zero';

  return (
    <section aria-labelledby="secao-analise" className="space-y-4">
      <header>
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
          Análise Financeira
        </div>
        <h2 id="secao-analise" className="mt-1 text-lg font-semibold tracking-tight text-foreground">
          Qual a tendência do negócio
        </h2>
      </header>

      <div className="rounded-2xl border border-border/60 bg-card p-6 transition-all duration-200 hover:border-border hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-14px_rgba(0,0,0,0.1)]">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-medium text-foreground">Fluxo de caixa</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Receitas, despesas e saldo acumulado — mês a mês
            </p>
          </div>

          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="group inline-flex items-center gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-1.5 text-xs text-foreground transition-colors hover:border-border hover:bg-accent/40"
                >
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Saldo inicial</span>
                  <span className="tabular-nums font-medium">{formatCurrency(openingBalance)}</span>
                  <Pencil className="h-3 w-3 text-muted-foreground opacity-60 group-hover:opacity-100" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs max-w-[240px]">
                {tooltipText(openingBalanceOrigem, openingBalanceAnoBase)}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {showHint && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--accent-gold))]" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground leading-relaxed">
                Você pode definir o <span className="font-medium">saldo inicial</span> do ano.
                Quando houver fechamento do ano anterior, ele é calculado automaticamente.
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="rounded-md px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent/60 transition-colors"
              >
                Definir
              </button>
              <button
                type="button"
                onClick={() => { void dismiss(); }}
                className="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent/40 hover:text-foreground transition-colors"
              >
                Entendi
              </button>
            </div>
          </div>
        )}

        <FluxoCaixaChart dados={dadosMensais} previsao={previsao} height={260} />
      </div>

      <OpeningBalanceModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        ano={ano}
        currentValor={openingBalance}
        currentOrigem={openingBalanceOrigem}
        anoBase={openingBalanceAnoBase}
      />
    </section>
  );
});

export default AnaliseSection;
