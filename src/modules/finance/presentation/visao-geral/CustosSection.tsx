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
  receitaOperacional?: number;
  receitaNaoOperacional?: number;
}

function LinhaDRE({ label, valor, tone, strong, sub }: { label: string; valor: number; tone?: 'success' | 'destructive' | 'muted'; strong?: boolean; sub?: boolean }) {
  const color =
    tone === 'success'
      ? 'hsl(var(--finance-positive))'
      : tone === 'destructive'
      ? 'hsl(var(--finance-negative))'
      : 'hsl(var(--foreground))';
  return (
    <div className={`flex items-baseline justify-between ${sub ? 'py-1.5 pl-4' : 'py-3'} ${strong ? 'border-t border-border/60 pt-4 mt-1' : ''}`}>
      <span className={`${sub ? 'text-xs' : 'text-sm'} ${strong ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>{label}</span>
      <span
        className={`tabular-nums ${strong ? 'text-lg font-semibold' : sub ? 'text-xs' : 'text-sm'}`}
        style={{ color }}
      >
        {formatCurrency(valor)}
      </span>
    </div>
  );
}

export const CustosSection = memo(function CustosSection({ receita, despesas, lucro, composicao, receitaOperacional, receitaNaoOperacional }: Props) {
  const totalDespesas = useMemo(
    () => composicao.reduce((s, c) => s + c.valor, 0),
    [composicao],
  );

  const hasSplit = receitaOperacional !== undefined && receitaNaoOperacional !== undefined;

  return (
    <section aria-labelledby="secao-custos" className="space-y-4">
      <header>
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
          Custos e Resultado
        </div>
        <h2 id="secao-custos" className="mt-1 text-lg font-semibold tracking-tight text-foreground">
          Para onde o dinheiro está indo
        </h2>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Mini DRE */}
        <div className="rounded-2xl border border-border/60 bg-card p-6 transition-all duration-200 hover:border-border hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-14px_rgba(0,0,0,0.1)]">
          <h3 className="text-sm font-medium text-foreground mb-2">Demonstrativo simplificado</h3>
          <div>
            {hasSplit ? (
              <>
                <LinhaDRE label="Receita operacional" valor={receitaOperacional!} sub tone="success" />
                <LinhaDRE label="Receita não operacional" valor={receitaNaoOperacional!} sub tone="success" />
                <LinhaDRE label="Receita total" valor={receita} tone="success" />
              </>
            ) : (
              <LinhaDRE label="Receita" valor={receita} tone="success" />
            )}
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
        <div className="rounded-2xl border border-border/60 bg-card p-6 transition-all duration-200 hover:border-border hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-14px_rgba(0,0,0,0.1)]">
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
