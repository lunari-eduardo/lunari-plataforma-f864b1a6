/**
 * Seção 1 — Estado Financeiro.
 * Saúde ponderada, meta proporcional ao período, sparklines só com dados reais.
 */
import { memo, useMemo } from 'react';
import {
  Heart, HeartCrack, Sparkles, Info,
  TrendingUp, TrendingDown, ArrowDownToLine, ArrowUpFromLine,
  ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';
// Sparklines removidos dos KPIs para reduzir ruído visual.
import { formatCurrency } from '@/utils/currencyUtils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { computeHealth, type Health } from '@/modules/finance/domain/healthScore';
import type { PeriodoEfetivo } from '@/modules/finance/domain/periodoEfetivo';

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
  metaReceitaProporcional?: number;
  periodoEfetivo?: PeriodoEfetivo;
  comparison: Comparison;
  dadosMensais: Array<{ mes: string; receita: number; lucro: number; despesas?: number; saldoAcumulado?: number }>;
  contasAPagar: number;
  qtdAReceber: number;
  qtdAPagar: number;
  aReceberMensal: number[];
  aPagarMensal: number[];
}

const statusTheme: Record<Health, { color: string; softBg: string; icon: 'heart' | 'crack' | 'sparkles'; anim: string }> = {
  excelente: {
    color: 'hsl(var(--accent-gold))',
    softBg: 'hsl(var(--accent-gold-soft))',
    icon: 'sparkles',
    anim: 'animate-finance-heartbeat',
  },
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
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium tabular-nums" style={style}>
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
          <div className="text-[11px] uppercase tracking-[0.12em] font-medium text-muted-foreground">{label}</div>
          <div className="mt-2 text-[26px] leading-none font-semibold tracking-tight tabular-nums text-foreground">
            {formatCurrency(value)}
          </div>
        </div>
        <div className="shrink-0 h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: 'hsl(var(--accent-gold-soft))' }}>
          <Icon className="h-[18px] w-[18px]" style={{ color: 'hsl(var(--accent-gold))' }} />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 min-h-[22px]">
        {delta !== undefined && <DeltaBadge value={delta ?? null} />}
        {deltaLabel && <span className="text-[11px] text-muted-foreground/80 truncate">{deltaLabel}</span>}
        {hint && !deltaLabel && <span className="text-[11px] text-muted-foreground/80 truncate">{hint}</span>}
      </div>
      <div className="mt-3 -mx-1"><Sparkline values={spark} tone={tone} /></div>
    </div>
  );
}

const MESES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export const EstadoFinanceiroSection = memo(function EstadoFinanceiroSection({
  kpis, metaReceita, metaReceitaProporcional, periodoEfetivo, comparison, dadosMensais,
  contasAPagar, qtdAReceber, qtdAPagar, aReceberMensal, aPagarMensal,
}: Props) {
  const metaProporcional = metaReceitaProporcional ?? metaReceita;

  const health = useMemo(() => computeHealth({
    receita: kpis.totalReceita,
    despesas: kpis.totalDespesas,
    lucro: kpis.totalLucro,
    aReceber: kpis.aReceber,
    aPagar: contasAPagar,
    metaReceitaProporcional: metaProporcional,
    dadosMensaisReais: dadosMensais,
    temDados: kpis.totalReceita > 0 || kpis.totalDespesas > 0,
  }), [kpis, contasAPagar, metaProporcional, dadosMensais]);

  const theme = statusTheme[health.status];
  const HeartIcon = theme.icon === 'crack' ? HeartCrack : theme.icon === 'sparkles' ? Sparkles : Heart;

  const margem = kpis.totalReceita > 0 ? (kpis.totalLucro / kpis.totalReceita) * 100 : 0;
  const cumprimentoProporcional = metaProporcional > 0 ? (kpis.totalReceita / metaProporcional) * 100 : 0;

  // Sparklines só sobre meses reais (dadosMensais já vem cortado no VisaoGeralPage)
  const nReais = dadosMensais.length;
  const receitaSpark = dadosMensais.map(d => d.receita);
  const despesasSpark = dadosMensais.map(d => d.despesas ?? 0);
  const aReceberSpark = aReceberMensal.slice(0, Math.max(nReais, 1));
  const aPagarSpark = aPagarMensal.slice(0, Math.max(nReais, 1));

  const lucroPositivo = kpis.totalLucro >= 0;
  const lucroColor = lucroPositivo ? 'hsl(var(--finance-positive))' : 'hsl(var(--finance-negative))';

  const hintReceber = (() => {
    const base = `${qtdAReceber} ${qtdAReceber === 1 ? 'recebimento pendente' : 'recebimentos pendentes'}`;
    return kpis.valorPrevisto > 0 ? `Previsto ${formatCurrency(kpis.valorPrevisto)} · ${base}` : base;
  })();
  const hintPagar = `${qtdAPagar} ${qtdAPagar === 1 ? 'vencimento em aberto' : 'vencimentos em aberto'}`;

  const metaSublabel = (() => {
    if (metaReceita <= 0) return 'sem meta definida';
    if (periodoEfetivo?.modo === 'anual' && periodoEfetivo.mesesDecorridos > 0 && periodoEfetivo.mesesDecorridos < 12) {
      const nomeMes = MESES_NOMES[periodoEfetivo.mesesDecorridos - 1];
      return `esperado até ${nomeMes}`;
    }
    return 'da meta de receita';
  })();

  return (
    <section aria-labelledby="secao-estado" className="space-y-4">
      <header>
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-medium">Estado Financeiro</div>
        <h2 id="secao-estado" className="mt-1 text-lg font-semibold tracking-tight text-foreground">Como está o negócio agora</h2>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2 gap-4 auto-rows-fr">
        {/* Saúde */}
        <div
          className="sm:col-span-2 lg:col-span-2 lg:row-span-2 relative rounded-2xl border border-border/60 bg-card p-6 overflow-hidden flex flex-col transition-all duration-200 hover:border-border hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-14px_rgba(0,0,0,0.12)]"
          style={{ backgroundImage: `linear-gradient(135deg, ${theme.softBg} 0%, transparent 55%)` }}
        >
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <HeartIcon className={`h-6 w-6 ${theme.anim}`} style={{ color: theme.color, fill: theme.icon === 'sparkles' ? 'none' : theme.color }} />
              <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-medium">Saúde Financeira</span>
            </div>
            {health.sinais.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="text-muted-foreground/70 hover:text-foreground transition-colors" aria-label="Ver detalhamento">
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 p-3">
                  <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-medium mb-2">
                    Como este diagnóstico foi calculado
                  </div>
                  <ul className="space-y-2">
                    {health.sinais.map(s => (
                      <li key={s.key} className="text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-foreground">{s.label}</span>
                          <span className="tabular-nums text-muted-foreground">{s.score.toFixed(0)}/100</span>
                        </div>
                        <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${s.score}%`, background: s.impacto === 'positivo' ? 'hsl(var(--finance-positive))' : s.impacto === 'negativo' ? 'hsl(var(--finance-negative))' : 'hsl(var(--finance-warning))' }} />
                        </div>
                        {s.detalhe && <div className="mt-0.5 text-[10.5px] text-muted-foreground/80">{s.detalhe}</div>}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 pt-2 border-t border-border/50 text-[10.5px] text-muted-foreground/80">
                    Score final: <span className="tabular-nums font-medium text-foreground">{health.score.toFixed(0)}/100</span>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>

          <div className="mt-4 space-y-2">
            <div className="text-3xl font-semibold tracking-tight leading-tight" style={{ color: theme.color }}>
              {health.titulo}
            </div>
            <p className="text-sm text-muted-foreground max-w-[42ch]">{health.justificativa}</p>
          </div>

          <div className="mt-auto pt-6 border-t border-border/40 grid grid-cols-3 divide-x divide-border/40">
            <div className="pr-4">
              <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-medium">Margem</div>
              <div className="mt-1.5 text-xl font-semibold tabular-nums text-foreground">
                {margem.toFixed(1).replace('.', ',')}%
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground/80">Lucro / Receita</div>
            </div>
            <div className="px-4">
              <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-medium">Lucro do período</div>
              <div className="mt-1.5 text-xl font-semibold tabular-nums" style={{ color: lucroColor }}>
                {formatCurrency(kpis.totalLucro)}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground/80">Receita − Despesas</div>
            </div>
            <div className="pl-4">
              <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-medium">Meta do período</div>
              <div className="mt-1.5 text-xl font-semibold tabular-nums text-foreground" title={metaProporcional > 0 ? `${formatCurrency(kpis.totalReceita)} de ${formatCurrency(metaProporcional)}` : undefined}>
                {metaProporcional > 0 ? `${cumprimentoProporcional.toFixed(0)}%` : '—'}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground/80">{metaSublabel}</div>
            </div>
          </div>
        </div>

        <MetricCard label="Receita operacional" value={kpis.totalReceita} delta={comparison.variacaoReceita}
          deltaLabel={comparison.labelComparacao} spark={receitaSpark} tone="neutral" Icon={TrendingUp} />
        <MetricCard label="Despesas" value={kpis.totalDespesas} delta={comparison.variacaoDespesas}
          deltaLabel={comparison.labelComparacao} spark={despesasSpark} tone="negative" Icon={TrendingDown} />
        <MetricCard label="A Receber" value={kpis.aReceber} spark={aReceberSpark} hint={hintReceber}
          tone="warning" Icon={ArrowDownToLine} />
        <MetricCard label="A Pagar" value={contasAPagar} spark={aPagarSpark} hint={hintPagar}
          tone="negative" Icon={ArrowUpFromLine} />
      </div>
    </section>
  );
});

export default EstadoFinanceiroSection;
