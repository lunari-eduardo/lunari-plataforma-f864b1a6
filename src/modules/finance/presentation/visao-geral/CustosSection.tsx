/**
 * Seção 4 — Custos e Resultado.
 * Mini DRE (Receita → Despesas → Lucro) + composição de despesas (barras horizontais).
 */
import { memo, useMemo } from 'react';
import { formatCurrency } from '@/utils/currencyUtils';

interface Comp { grupo: string; valor: number; percentual: number; }
interface Props {
  receita: number;
  despesas: number;
  lucro: number;
  composicao: Comp[];
}

function LinhaDRE({ label, valor, tone, strong }: { label: string; valor: number; tone?: 'success' | 'destructive' | 'muted'; strong?: boolean }) {
  const cls = tone === 'success' ? 'text-success' : tone === 'destructive' ? 'text-destructive' : 'text-foreground';
  return (
    <div className={`flex items-baseline justify-between py-3 ${strong ? 'border-t border-border/60 pt-4 mt-1' : ''}`}>
      <span className={`text-sm ${strong ? 'font-medium' : 'text-muted-foreground'}`}>{label}</span>
      <span className={`tabular-nums ${strong ? 'text-lg font-semibold' : 'text-sm'} ${cls}`}>
        {formatCurrency(valor)}
      </span>
    </div>
  );
}

export const CustosSection = memo(function CustosSection({ receita, despesas, lucro, composicao }: Props) {
  const totalDespesas = useMemo(
    () => composicao.reduce((s, c) => s + c.valor, 0),
    [composicao],
  );

  return (
    <section aria-labelledby="secao-custos" className="space-y-5">
      <header className="flex items-baseline justify-between">
        <h2 id="secao-custos" className="text-sm uppercase tracking-[0.14em] text-muted-foreground font-medium">
          Custos e Resultado
        </h2>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Mini DRE */}
        <div className="rounded-2xl border border-border/60 bg-card p-6">
          <h3 className="text-sm font-medium text-foreground mb-2">Demonstrativo simplificado</h3>
          <div>
            <LinhaDRE label="Receita" valor={receita} />
            <LinhaDRE label="(−) Despesas" valor={-despesas} tone="destructive" />
            <LinhaDRE
              label="Resultado"
              valor={lucro}
              tone={lucro >= 0 ? 'success' : 'destructive'}
              strong
            />
          </div>
        </div>

        {/* Composição de despesas */}
        <div className="rounded-2xl border border-border/60 bg-card p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="text-sm font-medium text-foreground">Composição de despesas</h3>
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatCurrency(totalDespesas)}
            </span>
          </div>
          {composicao.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Sem despesas registradas no período.</div>
          ) : (
            <div className="space-y-4">
              {composicao.map(c => (
                <div key={c.grupo}>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-sm text-foreground">{c.grupo}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatCurrency(c.valor)} · {c.percentual.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                    <div
                      className="h-full bg-foreground/75 rounded-full"
                      style={{ width: `${Math.min(c.percentual, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
});

export default CustosSection;
