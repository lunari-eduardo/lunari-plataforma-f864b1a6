import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/utils/currencyUtils";
import { useClienteCredito } from "@/hooks/useClienteCredito";
import { cn } from "@/lib/utils";

interface ClientCreditBannerProps {
  clienteId?: string | null;
  onApply?: (saldoDisponivel: number) => void;
  /** Restante da sessão em contexto (opcional) — usado para sugerir o valor. */
  restanteSessao?: number;
  compact?: boolean;
  className?: string;
}

/**
 * Banner reutilizável: aparece somente quando o cliente tem saldo positivo.
 * Sem toast de sucesso (política do projeto).
 */
export function ClientCreditBanner({
  clienteId,
  onApply,
  restanteSessao,
  compact = false,
  className,
}: ClientCreditBannerProps) {
  const { data, isLoading } = useClienteCredito(clienteId, false);

  if (!clienteId || isLoading) return null;
  const saldo = data?.saldo ?? 0;
  if (saldo <= 0) return null;

  const sugerido =
    typeof restanteSessao === "number" && restanteSessao > 0
      ? Math.min(saldo, restanteSessao)
      : saldo;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm",
        compact && "px-2 py-1.5 text-xs",
        className,
      )}
    >
      <Wallet className="h-4 w-4 shrink-0 text-emerald-500" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-emerald-900 dark:text-emerald-200">
          Crédito disponível: {formatCurrency(saldo)}
        </div>
        {!compact && restanteSessao != null && restanteSessao > 0 && (
          <div className="text-xs text-emerald-800/80 dark:text-emerald-200/70">
            Sugerido: {formatCurrency(sugerido)}
          </div>
        )}
      </div>
      {onApply && (
        <Button
          size="sm"
          variant="secondary"
          className="shrink-0"
          onClick={() => onApply(sugerido)}
        >
          Aplicar
        </Button>
      )}
    </div>
  );
}
