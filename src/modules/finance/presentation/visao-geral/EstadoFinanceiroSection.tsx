/**
 * Seção 1 — Estado Financeiro.
 * "Saúde" (card principal) + Receita / Lucro / A Receber / A Pagar.
 * Zero cliques necessários: leitura em ~5 segundos.
 */
import { memo, useMemo } from 'react';
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { formatCurrency } from '@/utils/currency';

interface KPIs {
  totalReceita: number;
  totalLucro: number;
  totalDespesas: number;
  aReceber: number;
  valorPrevisto: number;
}
interface Comparison {
  labelComparacao: string;
  variacaoReceita: number | null;
  variacaoLucro: number | null;
  variacaoDespesas: number | null;
}
interface Props {
  kpis: KPIs;
  metaReceita: number;
  comparison: Comparison;
  dadosMensais: Array<{ mes: string; receita: number; lucro: number }>;
  contasAPagar: number;
}

type Status = 'saudavel' | 'atencao' | 'critico';

function computeStatus(kpis: KPIs, meta: number): { status: Status; label: string; hint: string } {
  const margem = kpis.totalReceita > 0 ? (kpis.totalLucro / kpis.totalReceita) * 100 : 0;
  const cumprimento = meta > 0 ? (kpis.totalReceita / meta) * 100 : 0;

  if (margem >= 20 && cumprimento >= 70) {
    return { status: 'saudavel', label: 'Saudável', hint: 'Receita e margem dentro do esperado.' };
  }
  if (margem < 5 || (meta > 0 && cumprimento < 40)) {
    return { status: 'critico', label: 'Crítico', hint: 'Margem baixa ou meta muito distante.' };
  }
  return { status: 'atencao', label: 'Requer atenção', hint: 'Alguns indicadores fora do ideal.' };
}

const statusStyle: Record<Status, { dot: string; text: string; bg: string }> = {
  saudavel: { dot: 'bg-success',     text: 'text-success',     bg: 'bg-success/8' },
  atencao:  { dot: 'bg-warning',     text: 'text-warning',     bg: 'bg-warning/8' },
  critico:  { dot: 'bg-destructive', text: 'text-destructive', bg: 'bg-destructive/8' },
};

function Sparkline({ values, tone = 'foreground' }: { values: number[]; tone?: 'foreground' | 'success' | 'destructive' | 'warning' }) {
  const width = 120;
  const height = 32;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const stepX = values.length > 1 ? width / (values.length - 1) : width;
  const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${i * stepX} ${height - ((v - min) / range) * height}`).join(' ');
  const strokeCls =
    tone === 'success' ? 'stroke-success'
    : tone === 'destructive' ? 'stroke-destructive'
    : tone === 'warning' ? 'stroke-warning'
    : 'stroke-foreground/80';
  return (
    <svg width={width} height={height} className="overflow-visible">
      <path d={d} fill="none" className={strokeCls} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Delta({ value }: { value: number | null }) {
  if (value === null || !isFinite(value)) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> —
      </span>
    );
  }
  const positive = value >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  const cls = positive ? 'text-success' : 'text-destructive';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cls}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(value).toFixed(1).replace('.', ',')}%
    </span>
  );
}

interface MetricCardProps {
  label: string;
  value: number;
  delta?: number | null;
  deltaLabel?: string;
  spark: number[];
  tone?: 'foreground' | 'success' | 'destructive' | 'warning';
  hint?: string;
}
function MetricCard({ label, value, delta, deltaLabel, spark, tone, hint }: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card px-6 py-5 hover:border-border transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-2 text-2xl font-semibold text-foreground tracking-tight tabular-nums">
            {formatCurrency(value)}
          </div>
          {hint && <div className="mt-1 text-xs text-muted-foreground truncate">{hint}</div>}
        </div>
        <div className="shrink-0 pt-1">
          <Sparkline values={spark} tone={tone} />
        </div>
      </div>
      {delta !== undefined && (
        <div className="mt-3 flex items-center gap-2">
          <Delta value={delta ?? null} />
          {deltaLabel && <span className="text-xs text-muted-foreground truncate">{deltaLabel}</span>}
        </div>
      )}
    </div>
  );
}

export const EstadoFinanceiroSection = memo(function EstadoFinanceiroSection({
  kpis, metaReceita, comparison, dadosMensais, contasAPagar,
}: Props) {
  const { status, label, hint } = useMemo(() => computeStatus(kpis, metaReceita), [kpis, metaReceita]);
  const style = statusStyle[status];

  const cumprimentoMeta = metaReceita > 0 ? Math.min((kpis.totalReceita / metaReceita) * 100, 999) : 0;
  const margem = kpis.totalReceita > 0 ? (kpis.totalLucro / kpis.totalReceita) * 100 : 0;

  const receitaSpark = dadosMensais.map(d => d.receita);
  const lucroSpark = dadosMensais.map(d => d.lucro);
  const despesaSpark = dadosMensais.map(d => Math.max(d.receita - d.lucro, 0));

  return (
    <section aria-labelledby="secao-estado" className="space-y-5">
      <header className="flex items-baseline justify-between">
        <h2 id="secao-estado" className="text-sm uppercase tracking-[0.14em] text-muted-foreground font-medium">
          Estado Financeiro
        </h2>
      </header>

      {/* Card principal — Saúde */}
      <div className={`rounded-2xl border border-border/60 bg-card p-8 ${style.bg}`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${style.dot}`} aria-hidden />
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Saúde Financeira</span>
            </div>
            <div className={`text-4xl md:text-5xl font-serif tracking-tight ${style.text}`}>
              {label}
            </div>
            <p className="text-sm text-muted-foreground max-w-md">{hint}</p>
          </div>

          <div className="grid grid-cols-2 gap-6 min-w-[280px]">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Margem</div>
              <div className="mt-1 text-2xl font-semibold text-foreground tabular-nums">
                {margem.toFixed(1).replace('.', ',')}%
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Lucro / Receita</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Meta</div>
              <div className="mt-1 text-2xl font-semibold text-foreground tabular-nums">
                {metaReceita > 0 ? `${cumprimentoMeta.toFixed(0)}%` : '—'}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {metaReceita > 0 ? 'da meta de receita' : 'sem meta definida'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de KPIs — 4 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          label="Receita"
          value={kpis.totalReceita}
          delta={comparison.variacaoReceita}
          deltaLabel={comparison.labelComparacao}
          spark={receitaSpark}
          tone="foreground"
        />
        <MetricCard
          label="Lucro"
          value={kpis.totalLucro}
          delta={comparison.variacaoLucro}
          deltaLabel={comparison.labelComparacao}
          spark={lucroSpark}
          tone={kpis.totalLucro >= 0 ? 'success' : 'destructive'}
        />
        <MetricCard
          label="A Receber"
          value={kpis.aReceber}
          spark={receitaSpark}
          hint={kpis.valorPrevisto > 0 ? `Previsto: ${formatCurrency(kpis.valorPrevisto)}` : undefined}
          tone="warning"
        />
        <MetricCard
          label="A Pagar"
          value={contasAPagar}
          spark={despesaSpark}
          tone="destructive"
        />
      </div>
    </section>
  );
});

export default EstadoFinanceiroSection;
