interface LegendDotProps {
  color: string;
  label: string;
}

function LegendDot({ color, label }: LegendDotProps) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
      <span
        className="h-2 w-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {label}
    </div>
  );
}

export default function AgendaLegend() {
  return (
    <div className="rounded-lg border border-white/30 dark:border-white/10 bg-card/40 dark:bg-card/[0.05] p-3 space-y-1.5">
      <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
        Legenda
      </div>
      <LegendDot color="hsl(var(--event-budget))" label="Orçamento fechado" />
      <LegendDot color="hsl(var(--event-confirmed))" label="Confirmado" />
      <LegendDot color="hsl(var(--event-pending))" label="A confirmar" />
      <LegendDot color="hsl(var(--event-available))" label="Disponível" />
      <LegendDot color="hsl(var(--event-blocked))" label="Bloqueado" />
    </div>
  );
}
