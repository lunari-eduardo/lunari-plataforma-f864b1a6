import { Wallet } from "lucide-react";
import { formatCurrency } from "@/utils/currencyUtils";
import { useClienteCredito } from "@/hooks/useClienteCredito";
import { cn } from "@/lib/utils";

interface ClientCreditBadgeProps {
  clienteId?: string | null;
  onClick?: () => void;
  className?: string;
  /** Prefixo do texto. Default "Crédito". */
  label?: string;
}

/**
 * Badge compacto para exibir saldo de crédito do cliente inline no rodapé
 * de cards/painéis. Aparece somente quando saldo > 0. Clicável quando
 * `onClick` é fornecido (abre modal de aplicação).
 */
export function ClientCreditBadge({
  clienteId,
  onClick,
  className,
  label = "Crédito",
}: ClientCreditBadgeProps) {
  const { data, isLoading } = useClienteCredito(clienteId, false);

  if (!clienteId || isLoading) return null;
  const saldo = data?.saldo ?? 0;
  if (saldo <= 0) return null;

  const content = (
    <>
      <Wallet className="h-3.5 w-3.5 shrink-0" />
      <span className="whitespace-nowrap">
        {label}: <span className="font-semibold">{formatCurrency(saldo)}</span>
      </span>
    </>
  );

  const baseClass = cn(
    "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium",
    "border border-emerald-500/30 bg-emerald-500/10",
    "text-emerald-700 dark:text-emerald-300",
    onClick && "cursor-pointer transition-colors hover:bg-emerald-500/20 hover:border-emerald-500/50",
    className,
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={baseClass} title="Aplicar crédito nesta sessão">
        {content}
      </button>
    );
  }

  return <span className={baseClass}>{content}</span>;
}
