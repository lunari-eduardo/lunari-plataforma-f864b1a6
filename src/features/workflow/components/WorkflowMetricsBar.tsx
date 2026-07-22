import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";

interface Financials {
  totalMonth: number;
  paidMonth: number;
  remainingMonth: number;
  creditosGerados?: number;
  creditosUtilizados?: number;
  caixaRecebido?: number;
}

interface PhotoProduction {
  fotosTotal: number;
  fotosIncluidas: number;
  fotosExtras: number;
}

interface Props {
  showMetrics: boolean;
  onToggle: (next: boolean) => void;
  financials: Financials;
  sessionCount: number;
  isLoading?: boolean;
  photoProduction?: PhotoProduction | null;
  isPhotoLoading?: boolean;
}

const formatCurrency = (value: unknown) =>
  `R$ ${(Number(value) || 0).toFixed(2).replace(".", ",")}`;

const Skeleton = ({ w = "w-16" }: { w?: string }) => (
  <span
    className={`inline-block h-4 ${w} rounded bg-muted/60 animate-pulse`}
    aria-hidden="true"
  />
);

/**
 * Barra de métricas do Workflow.
 * Fonte canônica: RPC `workflow_month_metrics` (via useWorkflowMetricsRealtime).
 *
 * Enquanto `isLoading`, valores são substituídos por skeletons — evita
 * mostrar valores do mês anterior durante a troca.
 */
export function WorkflowMetricsBar({ showMetrics, onToggle, financials, sessionCount, isLoading = false, photoProduction, isPhotoLoading = false }: Props) {
  if (!showMetrics) {
    return (
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onToggle(true)}
          className="h-7 px-2 text-xs text-muted-foreground gap-1.5"
        >
          <Eye className="h-3.5 w-3.5" />
          Mostrar métricas
        </Button>
      </div>
    );
  }

  const fmtInt = (v: number) => new Intl.NumberFormat("pt-BR").format(Math.round(v || 0));
  const fotosTotal = Number(photoProduction?.fotosTotal) || 0;
  const fotosInc = Number(photoProduction?.fotosIncluidas) || 0;
  const fotosExt = Number(photoProduction?.fotosExtras) || 0;

  const creditosGerados = Number(financials.creditosGerados) || 0;
  const creditosUtilizados = Number(financials.creditosUtilizados) || 0;
  const caixaRecebido = Number(financials.caixaRecebido) || 0;
  const showCaixaChip = !isLoading && caixaRecebido > 0 && Math.abs(caixaRecebido - financials.paidMonth) > 0.005;

  return (
    <div className="flex items-center gap-4 sm:gap-5 flex-wrap bg-card/30 backdrop-blur-lg dark:bg-card/[0.04] border border-white/50 dark:border-white/10 rounded-lg px-4 py-2.5">
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
        <span className="text-[11px] text-muted-foreground">Receita</span>
        {isLoading
          ? <Skeleton />
          : <span className="text-sm font-bold text-green-500">{formatCurrency(financials.paidMonth)}</span>}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
        <span className="text-[11px] text-muted-foreground">Previsto</span>
        {isLoading
          ? <Skeleton />
          : <span className="text-sm font-bold text-blue-500">{formatCurrency(financials.totalMonth)}</span>}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
        <span className="text-[11px] text-muted-foreground">Pendente</span>
        {isLoading
          ? <Skeleton />
          : <span className="text-sm font-bold text-orange-500">{formatCurrency(financials.remainingMonth)}</span>}
      </div>

      {!isLoading && creditosGerados > 0 && (
        <div className="flex items-center gap-1.5" title="Crédito gerado por overpayment em sessões deste mês">
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
          <span className="text-[11px] text-muted-foreground">Créd. gerados</span>
          <span className="text-sm font-bold text-amber-500">{formatCurrency(creditosGerados)}</span>
        </div>
      )}

      {!isLoading && creditosUtilizados > 0 && (
        <div className="flex items-center gap-1.5" title="Créditos aplicados como pagamento em sessões deste mês">
          <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
          <span className="text-[11px] text-muted-foreground">Créd. utilizados</span>
          <span className="text-sm font-bold text-indigo-500">{formatCurrency(creditosUtilizados)}</span>
        </div>
      )}

      {showCaixaChip && (
        <div className="flex items-center gap-1.5" title="Pagamentos reais em caixa neste mês (exclui créditos aplicados)">
          <span className="w-2 h-2 rounded-full bg-emerald-700 shrink-0" />
          <span className="text-[11px] text-muted-foreground">Caixa</span>
          <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(caixaRecebido)}</span>
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />
        <span className="text-[11px] text-muted-foreground">Sessões</span>
        {isLoading
          ? <Skeleton w="w-8" />
          : <span className="text-sm font-bold">{sessionCount}</span>}
      </div>

      <div
        className="flex items-center gap-1.5"
        title={
          fotosTotal > 0
            ? `Fotos previstas para produção: ${fmtInt(fotosInc)} inclusas no pacote + ${fmtInt(fotosExt)} extras`
            : "Fotos previstas para produção (pacote + extras)"
        }
      >
        <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
        <span className="text-[11px] text-muted-foreground">Fotos</span>
        {isPhotoLoading
          ? <Skeleton w="w-10" />
          : (
            <span className="text-sm font-bold text-sky-600 dark:text-sky-400">
              {fmtInt(fotosTotal)}
              {fotosTotal > 0 && (
                <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                  ({fmtInt(fotosInc)}+{fmtInt(fotosExt)})
                </span>
              )}
            </span>
          )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onToggle(false)}
        className="h-7 w-7 shrink-0 ml-auto"
        title="Ocultar métricas"
      >
        <EyeOff className="h-4 w-4 text-muted-foreground" />
      </Button>
    </div>
  );
}
