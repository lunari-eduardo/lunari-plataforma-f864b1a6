/**
 * Fluxo de Caixa — gráfico SVG premium com 3 linhas (Receita, Despesa, Saldo Acumulado).
 * - Curvas Catmull-Rom → Bézier suaves
 * - Hover crosshair com tooltip mês/valor por linha
 * - Coordenadas 1:1 CSS↔viewBox (via ResizeObserver) → hover perfeitamente alinhado
 * - Nenhuma dependência externa (recharts/etc.) — SVG puro
 */
import { memo, useMemo, useRef, useState, useCallback, useLayoutEffect } from 'react';
import { formatCurrency } from '@/utils/currencyUtils';

export interface FluxoCaixaPonto {
  mes: string;
  receita: number;
  despesas: number;
  saldoAcumulado: number;
}

interface Props {
  dados: FluxoCaixaPonto[];
  previsao?: FluxoCaixaPonto[];
  height?: number;
}

const SERIES = [
  { key: 'receita', label: 'Receita', color: 'hsl(var(--finance-positive))', dash: undefined },
  { key: 'despesas', label: 'Despesas', color: 'hsl(var(--finance-negative))', dash: undefined },
  { key: 'saldoAcumulado', label: 'Saldo acumulado', color: 'hsl(var(--accent-gold))', dash: '3 3' },
] as const;

function catmullRom2bezier(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  const d: string[] = [`M ${points[0].x} ${points[0].y}`];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`);
  }
  return d.join(' ');
}

export const FluxoCaixaChart = memo(function FluxoCaixaChart({ dados, height = 240 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(Math.round(el.getBoundingClientRect().width));
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.round(entry.contentRect.width);
        if (w > 0) setContainerWidth(w);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => {
    const width = Math.max(1, containerWidth ?? 0);
    const padding = { top: 20, right: 24, bottom: 30, left: 12 };
    const w = Math.max(1, width - padding.left - padding.right);
    const h = height - padding.top - padding.bottom;

    const vals = dados.flatMap((d) => [d.receita, d.despesas, d.saldoAcumulado]);
    const rawMax = Math.max(...vals, 0);
    const rawMin = Math.min(...vals, 0);
    const pad = (rawMax - rawMin) * 0.1 || 1;
    const max = rawMax + pad;
    const min = rawMin - pad;
    const range = max - min || 1;
    const stepX = dados.length > 1 ? w / (dados.length - 1) : 0;

    const project = (v: number, i: number) => ({
      x: padding.left + i * stepX,
      y: padding.top + h - ((v - min) / range) * h,
    });

    const zeroY = padding.top + h - ((0 - min) / range) * h;

    const series = SERIES.map((s) => ({
      ...s,
      points: dados.map((d, i) => project((d as any)[s.key], i)),
    }));

    const gridLines = Array.from({ length: 4 }, (_, i) => {
      const yy = padding.top + (h / 3) * i;
      return { y: yy };
    });

    return { width, height, padding, w, h, stepX, zeroY, series, gridLines, min, max };
  }, [dados, height, containerWidth]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      if (dados.length === 0) return;
      if (dados.length === 1) { setHoverIdx(0); return; }
      const rect = svg.getBoundingClientRect();
      const cssX = e.clientX - rect.left;
      const { padding, w, stepX } = layout;
      const clamped = Math.max(padding.left, Math.min(padding.left + w, cssX));
      const idx = Math.round((clamped - padding.left) / stepX);
      setHoverIdx(Math.max(0, Math.min(dados.length - 1, idx)));
    },
    [dados.length, layout],
  );

  const handleMouseLeave = useCallback(() => setHoverIdx(null), []);

  if (!dados.length) return null;

  const ready = containerWidth != null && containerWidth > 0;
  const hover = hoverIdx != null ? dados[hoverIdx] : null;
  const hoverX = hoverIdx != null ? layout.padding.left + hoverIdx * layout.stepX : 0;

  return (
    <div ref={containerRef} className="relative w-full" style={{ minHeight: height + 28 }}>
      {ready && (
        <svg
          ref={svgRef}
          width={layout.width}
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          style={{ display: 'block' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Grid horizontal */}
          {layout.gridLines.map((g, i) => (
            <line
              key={i}
              x1={layout.padding.left}
              x2={layout.padding.left + layout.w}
              y1={g.y}
              y2={g.y}
              className="stroke-border/40"
              strokeWidth={1}
            />
          ))}

          {/* Linha zero */}
          <line
            x1={layout.padding.left}
            x2={layout.padding.left + layout.w}
            y1={layout.zeroY}
            y2={layout.zeroY}
            className="stroke-border/70"
            strokeDasharray="2 4"
            strokeWidth={1}
          />

          {/* Séries */}
          {layout.series.map((s) => (
            <g key={s.key}>
              <path
                d={catmullRom2bezier(s.points)}
                fill="none"
                stroke={s.color}
                strokeWidth={1.75}
                strokeDasharray={s.dash}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {s.points.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={hoverIdx === i ? 4 : 2.5}
                  fill={s.color}
                  className="transition-all"
                />
              ))}
            </g>
          ))}

          {/* Rótulos meses */}
          {dados.map((d, i) => (
            <text
              key={d.mes + i}
              x={layout.padding.left + i * layout.stepX}
              y={layout.height - 8}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px] uppercase tracking-wider"
              style={{
                fontWeight: hoverIdx === i ? 600 : 400,
                fill: hoverIdx === i ? 'hsl(var(--foreground))' : undefined,
              }}
            >
              {d.mes}
            </text>
          ))}

          {/* Crosshair */}
          {hover && (
            <line
              x1={hoverX}
              x2={hoverX}
              y1={layout.padding.top}
              y2={layout.padding.top + layout.h}
              className="stroke-foreground/25"
              strokeWidth={1}
              strokeDasharray="2 3"
            />
          )}
        </svg>
      )}

      {/* Legenda */}
      {ready && (
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] text-muted-foreground">
          {SERIES.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <span
                className="inline-block h-[2px] w-4 rounded-full"
                style={{
                  background: s.color,
                  boxShadow: s.dash ? 'none' : undefined,
                  borderTop: s.dash ? `2px dashed ${s.color}` : undefined,
                  height: s.dash ? 0 : 2,
                }}
              />
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tooltip */}
      {ready && hover && (
        <div
          className="pointer-events-none absolute top-2 rounded-lg border border-border/70 bg-card/95 backdrop-blur px-3 py-2 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.15)] text-xs min-w-[180px]"
          style={{
            left: hoverX + 8,
            transform: hoverX > layout.width * 0.7 ? 'translateX(-105%)' : undefined,
          }}
        >
          <div className="mb-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
            {hover.mes}
          </div>
          <div className="space-y-1">
            {SERIES.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-[6px] w-[6px] rounded-full"
                    style={{ background: s.color }}
                  />
                  <span className="text-foreground/80">{s.label}</span>
                </div>
                <span className="tabular-nums font-medium text-foreground">
                  {formatCurrency((hover as any)[s.key])}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export default FluxoCaixaChart;
