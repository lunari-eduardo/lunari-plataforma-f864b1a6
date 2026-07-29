import { Camera, Layers, TrendingUp } from "lucide-react";
import { MetricIconBadge } from "@/components/ui/metric-icon";

interface Props {
  fotosTotal: number;
  fotosIncluidas: number;
  fotosExtras: number;
  mediaFotosPorSessao: number;
  categoriaTop: string | null;
  fotosCategoriaTop: number;
  sessoesComPacote: number;
  sessoesSemPacote: number;
  isLoading?: boolean;
  scopeLabel: string; // e.g. "no ano" / "no mês"
}

const fmtInt = (v: number) => new Intl.NumberFormat("pt-BR").format(Math.round(v || 0));
const fmtDec = (v: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(v || 0);

function Card({
  label,
  primary,
  secondary,
  icon: Icon,
  isLoading,
}: {
  label: string;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  isLoading?: boolean;
}) {
  return (
    <div className="group relative rounded-2xl border border-border/60 bg-card p-3 sm:p-5 transition-all duration-200 hover:border-border hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-14px_rgba(0,0,0,0.12)]">
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.12em] font-medium text-muted-foreground truncate">
            {label}
          </div>
          {isLoading ? (
            <div className="mt-2 h-6 w-24 rounded bg-muted/60 animate-pulse" />
          ) : (
            <div className="mt-1.5 sm:mt-2 text-[18px] sm:text-[26px] leading-tight font-semibold tracking-tight tabular-nums text-foreground">
              {primary}
            </div>
          )}
        </div>
        <MetricIconBadge Icon={Icon} />
      </div>
      {secondary && !isLoading && (
        <div className="mt-2 text-[10.5px] sm:text-[11px] text-muted-foreground/80 truncate">{secondary}</div>
      )}
    </div>
  );
}


export function ProductionMetricsCards(props: Props) {
  const totalSessoes = props.sessoesComPacote + props.sessoesSemPacote;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <Card
        icon={<Camera className="h-3.5 w-3.5" />}
        label={`Fotos ${props.scopeLabel}`}
        primary={fmtInt(props.fotosTotal)}
        secondary={
          <>
            {fmtInt(props.fotosIncluidas)} inclusas · {fmtInt(props.fotosExtras)} extras
          </>
        }
        isLoading={props.isLoading}
      />
      <Card
        icon={<TrendingUp className="h-3.5 w-3.5" />}
        label="Média por sessão"
        primary={`${fmtDec(props.mediaFotosPorSessao)}`}
        secondary={totalSessoes > 0 ? `sobre ${fmtInt(totalSessoes)} sessões` : "sem sessões no período"}
        isLoading={props.isLoading}
      />
      <Card
        icon={<Layers className="h-3.5 w-3.5" />}
        label="Categoria líder"
        primary={props.categoriaTop ?? "—"}
        secondary={
          props.categoriaTop
            ? `${fmtInt(props.fotosCategoriaTop)} fotos`
            : "categoria com maior volume de fotos"
        }
        isLoading={props.isLoading}
      />
    </div>
  );
}
