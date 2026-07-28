/**
 * Seção 3 — Análise Financeira.
 * Resultado mês a mês (barras horizontais) + Fluxo de caixa (linha).
 * Monocromático — grafite/cinza. Sem cores de série extras.
 */
import { memo, useMemo } from 'react';
import { formatCurrency } from '@/utils/currencyUtils';

interface DadoMes { mes: string; receita: number; lucro: number; }
interface Props { dadosMensais: DadoMes[]; }

function BarraResultado({ mes, receita, lucro, maxAbs }: DadoMes & { maxAbs: number }) {
  const receitaPct = (receita / maxAbs) * 100;
  const lucroPct = (Math.abs(lucro) / maxAbs) * 100;
  const lucroPositivo = lucro >= 0;
  return (
    <div className="grid grid-cols-[40px_1fr_140px] items-center gap-4 py-2">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{mes}</span>
      <div className="space-y-1.5">
        <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
          <div className="h-full bg-foreground/85 rounded-full" style={{ width: `${receitaPct}%` }} />
        </div>
        <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${lucroPct}%`,
              background: lucroPositivo ? 'hsl(var(--finance-positive))' : 'hsl(var(--finance-negative))',
            }}
          />
        </div>
      </div>
      <div className="text-right text-xs tabular-nums text-muted-foreground">
        <div className="text-foreground">{formatCurrency(receita)}</div>
        <div className={lucroPositivo ? 'text-success' : 'text-destructive'}>{formatCurrency(lucro)}</div>
      </div>
    </div>
  );
}

function FluxoLinha({ dados }: { dados: DadoMes[] }) {
  const width = 640;
  const height = 160;
  const padding = { top: 16, right: 12, bottom: 24, left: 12 };
  const w = width - padding.left - padding.right;
  const h = height - padding.top - padding.bottom;

  let acc = 0;
  const pontos = dados.map(d => {
    acc += d.lucro;
    return acc;
  });
  const max = Math.max(...pontos, 1);
  const min = Math.min(...pontos, 0);
  const range = max - min || 1;
  const stepX = dados.length > 1 ? w / (dados.length - 1) : w;

  const coord = (v: number, i: number) => ({
    x: padding.left + i * stepX,
    y: padding.top + h - ((v - min) / range) * h,
  });

  const linePath = pontos.map((v, i) => {
    const { x, y } = coord(v, i);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  const areaPath = `${linePath} L ${padding.left + (dados.length - 1) * stepX} ${padding.top + h} L ${padding.left} ${padding.top + h} Z`;
  const zeroY = padding.top + h - ((0 - min) / range) * h;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40">
      <line x1={padding.left} x2={padding.left + w} y1={zeroY} y2={zeroY} className="stroke-border/60" strokeDasharray="2 4" />
      <path d={areaPath} className="fill-foreground/5" />
      <path d={linePath} fill="none" className="stroke-foreground" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {pontos.map((v, i) => {
        const { x, y } = coord(v, i);
        const positive = v >= 0;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={2.5}
            fill={positive ? 'hsl(var(--finance-positive))' : 'hsl(var(--finance-negative))'}
          />
        );
      })}
      {dados.map((d, i) => (
        <text
          key={d.mes}
          x={padding.left + i * stepX}
          y={height - 6}
          textAnchor="middle"
          className="fill-muted-foreground text-[10px] uppercase tracking-wider"
        >
          {d.mes}
        </text>
      ))}
    </svg>
  );
}

export const AnaliseSection = memo(function AnaliseSection({ dadosMensais }: Props) {
  const maxAbs = useMemo(() => {
    const vals = dadosMensais.flatMap(d => [d.receita, Math.abs(d.lucro)]);
    return Math.max(...vals, 1);
  }, [dadosMensais]);

  return (
    <section aria-labelledby="secao-analise" className="space-y-4">
      <header>
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
          Análise Financeira
        </div>
        <h2 id="secao-analise" className="mt-1 text-lg font-serif tracking-tight text-foreground">
          Qual a tendência do negócio
        </h2>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Resultado mensal — 3/5 */}
        <div className="lg:col-span-3 rounded-2xl border border-border/60 bg-card p-6 transition-all duration-200 hover:border-border hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-14px_rgba(0,0,0,0.1)]">
          <div className="mb-4">
            <h3 className="text-sm font-medium text-foreground">Resultado mês a mês</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Receita (barra superior) e Lucro (barra inferior)</p>
          </div>
          <div className="divide-y divide-border/30">
            {dadosMensais.map(d => (
              <BarraResultado key={d.mes} {...d} maxAbs={maxAbs} />
            ))}
          </div>
        </div>

        {/* Fluxo de caixa — 2/5 */}
        <div className="lg:col-span-2 rounded-2xl border border-border/60 bg-card p-6 flex flex-col transition-all duration-200 hover:border-border hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-14px_rgba(0,0,0,0.1)]">
          <div className="mb-4">
            <h3 className="text-sm font-medium text-foreground">Fluxo de caixa acumulado</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Soma progressiva do lucro no ano</p>
          </div>
          <div className="flex-1 flex items-center">
            <FluxoLinha dados={dadosMensais} />
          </div>
        </div>
      </div>
    </section>
  );
});

export default AnaliseSection;
