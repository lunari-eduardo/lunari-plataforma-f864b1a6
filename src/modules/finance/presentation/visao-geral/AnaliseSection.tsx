/**
 * Seção 3 — Análise Financeira.
 * Fluxo de caixa com dados reais + previsão pontilhada opcional.
 */
import { memo } from 'react';
import FluxoCaixaChart, { type FluxoCaixaPonto } from './FluxoCaixaChart';

interface Props {
  dadosMensais: FluxoCaixaPonto[];
  previsao?: FluxoCaixaPonto[];
}

export const AnaliseSection = memo(function AnaliseSection({ dadosMensais, previsao }: Props) {
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
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <div>
            <h3 className="text-sm font-medium text-foreground">Fluxo de caixa</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Receitas, despesas e saldo acumulado — mês a mês
            </p>
          </div>
        </div>
        <FluxoCaixaChart dados={dadosMensais} previsao={previsao} height={260} />
      </div>
    </section>
  );
});

export default AnaliseSection;
