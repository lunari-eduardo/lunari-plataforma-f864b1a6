import { Camera, Layers, TrendingUp } from "lucide-react";

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
  icon,
  isLoading,
}: {
  label: string;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  icon: React.ReactNode;
  isLoading?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 flex flex-col gap-1.5 shadow-none">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
        <span className="text-[hsl(var(--accent-gold))]">{icon}</span>
        {label}
      </div>
      {isLoading ? (
        <div className="h-7 w-24 rounded bg-muted/60 animate-pulse" />
      ) : (
        <div className="text-2xl font-semibold text-foreground leading-none">{primary}</div>
      )}
      {secondary && !isLoading && (
        <div className="text-xs text-muted-foreground">{secondary}</div>
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
