/**
 * Seção 1 — Estado Financeiro.
 * Bloco único 4×2 (desktop): Saúde (2col×2row) + 4 KPIs (2×2).
 */
import { memo, useMemo } from 'react';
import {
  Heart, HeartCrack,
  TrendingUp, TrendingDown, ArrowDownToLine, ArrowUpFromLine,
  ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';
import { formatCurrency } from '@/utils/currencyUtils';

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
  dadosMensais: Array<{ mes: string; receita: number; lucro: number; despesas?: number }>;
  contasAPagar: number;
  qtdAReceber: number;
  qtdAPagar: number;
  aReceberMensal: number[];
  aPagarMensal: number[];
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

const statusTheme: Record<Status, { color: string; softBg: string; icon: 'heart' | 'crack'; anim: string }> = {
  saudavel: {
    color: 'hsl(var(--finance-positive))',
    softBg: 'hsl(var(--finance-positive-soft))',
    icon: 'heart',
    anim: 'animate-finance-heartbeat',
  },
  atencao: {
    color: 'hsl(var(--finance-warning))',
    softBg: 'hsl(var(--finance-warning-soft))',
    icon: 'heart',
    anim: 'animate-finance-heartbeat',
  },
  critico: {
    color: 'hsl(var(--finance-negative))',
    softBg: 'hsl(var(--finance-negative-soft))',
    icon: 'crack',
    anim: 'animate-finance-heartbeat-fast',
  },
};

type Tone = 'neutral' | 'positive' | 'negative' | 'warning';
const toneColor: Record<Tone, string> = {
  neutral: 'hsl(var(--foreground) / 0.75)',
  positive: 'hsl(var(--finance-positive))',
  negative: 'hsl(var(--finance-negative))',
  warning: 'hsl(var(--finance-warning))',
};

function Sparkline({ values, tone = 'neutral' }: { values: number[]; tone?: Tone }) {
  const width = 100;
  const height = 32;
  if (!values.length) return <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-8" />;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const stepX = values.length > 1 ? width / (values.length - 1) : width;
  const pts = values.map((v, i) => [i * stepX, height - ((v - min) / range) * height] as const);
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
  const area = `${d} L ${pts[pts.length - 1][0]} ${height} L 0 ${height} Z`;
  const color = toneColor[tone];
  const gid = `spk-${tone}-${values.length}`;
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-8 overflow-visible">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.3}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        className="transition-[stroke-width] group-hover:[stroke-width:2]"
      />
      <circle cx={last[0]} cy={last[1]} r={1.8} fill={color} className="transition-all group-hover:r-[2.6]" />
    </svg>
  );
}

function DeltaBadge({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined || !isFinite(value)) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-muted text-muted-foreground">
        <Minus className="h-3 w-3" /> —
      </span>
    );
  }
  const positive = value >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  const style = positive
    ? { color: 'hsl(var(--finance-positive))', background: 'hsl(var(--finance-positive-soft))' }
    : { color: 'hsl(var(--finance-negative))', background: 'hsl(var(--finance-negative-soft))' };
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium tabular-nums"
      style={style}
    >
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
  tone?: Tone;
  hint?: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}
function MetricCard({ label, value, delta, deltaLabel, spark, tone = 'neutral', hint, Icon }: MetricCardProps) {
  return (
    <div className="group relative rounded-2xl border border-border/60 bg-card p-5 flex flex-col justify-between overflow-hidden transition-all duration-200 hover:border-border hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-14px_rgba(0,0,0,0.12)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.12em] font-medium text-muted-foreground">
            {label}
          </div>
          <div className="mt-2 text-[26px] leading-none font-semibold tracking-tight tabular-nums text-foreground">
            {formatCurrency(value)}
          </div>
        </div>
        <div
          className="shrink-0 h-9 w-9 rounded-lg flex items-center justify-center transition-colors"
          style={{ background: 'hsl(var(--accent-gold-soft))' }}
        >
          <Icon className="h-[18px] w-[18px]" style={{ color: 'hsl(var(--accent-gold))' }} />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 min-h-[22px]">
        {delta !== undefined && <DeltaBadge value={delta ?? null} />}
        {deltaLabel && <span className="text-[11px] text-muted-foreground/80 truncate">{deltaLabel}</span>}
        {hint && !deltaLabel && <span className="text-[11px] text-muted-foreground/80 truncate">{hint}</span>}
      </div>

      <div className="mt-3 -mx-1">
        <Sparkline values={spark} tone={tone} />
      </div>
    </div>
  );
}

export const EstadoFinanceiroSection = memo(function EstadoFinanceiroSection({
  kpis, metaReceita, comparison, dadosMensais, contasAPagar, aReceberMensal, aPagarMensal,
}: Props) {
  const { status, label, hint } = useMemo(() => computeStatus(kpis, metaReceita), [kpis, metaReceita]);
  const theme = statusTheme[status];

  const cumprimentoMeta = metaReceita > 0 ? Math.min((kpis.totalReceita / metaReceita) * 100, 999) : 0;
  const margem = kpis.totalReceita > 0 ? (kpis.totalLucro / kpis.totalReceita) * 100 : 0;

  const receitaSpark = dadosMensais.map(d => d.receita);
  const lucroSpark = dadosMensais.map(d => d.lucro);

  const HeartIcon = theme.icon === 'crack' ? HeartCrack : Heart;

  return (
    <section aria-labelledby="secao-estado" className="space-y-4">
      <header>
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
          Estado Financeiro
        </div>
        <h2 id="secao-estado" className="mt-1 text-lg font-semibold tracking-tight text-foreground">
          Como está o negócio agora
        </h2>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2 gap-4 auto-rows-fr">
        {/* Saúde — 2 col × 2 row */}
        <div
          className="sm:col-span-2 lg:col-span-2 lg:row-span-2 relative rounded-2xl border border-border/60 bg-card p-7 overflow-hidden flex flex-col transition-all duration-200 hover:border-border hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-14px_rgba(0,0,0,0.12)]"
          style={{
            backgroundImage: `linear-gradient(135deg, ${theme.softBg} 0%, transparent 55%)`,
          }}
        >
          <div className="flex items-center gap-2.5">
            <HeartIcon
              className={`h-6 w-6 ${theme.anim}`}
              style={{ color: theme.color, fill: theme.color }}
            />
            <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
              Saúde Financeira
            </span>
          </div>

          <div className="mt-4 space-y-2">
            <div
              className="text-3xl font-semibold tracking-tight leading-tight"
              style={{ color: theme.color }}
            >
              {label}
            </div>
            <p className="text-sm text-muted-foreground max-w-[38ch]">{hint}</p>
          </div>

          <div className="mt-auto pt-6 border-t border-border/40 grid grid-cols-2 divide-x divide-border/40">
            <div className="pr-4">
              <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-medium">
                Margem
              </div>
              <div className="mt-1.5 text-xl font-semibold tabular-nums text-foreground">
                {margem.toFixed(1).replace('.', ',')}%
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground/80">Lucro / Receita</div>
            </div>
            <div className="pl-4">
              <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-medium">
                Meta
              </div>
              <div className="mt-1.5 text-xl font-semibold tabular-nums text-foreground">
                {metaReceita > 0 ? `${cumprimentoMeta.toFixed(0)}%` : '—'}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground/80">
                {metaReceita > 0 ? 'da meta de receita' : 'sem meta definida'}
              </div>
            </div>
          </div>
        </div>

        {/* 4 KPIs */}
        <MetricCard
          label="Receita"
          value={kpis.totalReceita}
          delta={comparison.variacaoReceita}
          deltaLabel={comparison.labelComparacao}
          spark={receitaSpark}
          tone="neutral"
          Icon={TrendingUp}
        />
        <MetricCard
          label="Lucro"
          value={kpis.totalLucro}
          delta={comparison.variacaoLucro}
          deltaLabel={comparison.labelComparacao}
          spark={lucroSpark}
          tone={kpis.totalLucro >= 0 ? 'positive' : 'negative'}
          Icon={Wallet}
        />
        <MetricCard
          label="A Receber"
          value={kpis.aReceber}
          spark={aReceberMensal}
          hint={kpis.valorPrevisto > 0 ? `Previsto: ${formatCurrency(kpis.valorPrevisto)}` : 'Vencimentos futuros'}
          tone="warning"
          Icon={ArrowDownToLine}
        />
        <MetricCard
          label="A Pagar"
          value={contasAPagar}
          spark={aPagarMensal}
          hint="Despesas em aberto"
          tone="negative"
          Icon={ArrowUpFromLine}
        />
      </div>
    </section>
  );
});

export default EstadoFinanceiroSection;
