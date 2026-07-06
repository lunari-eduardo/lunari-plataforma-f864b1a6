import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ClientCreditBadge } from "@/components/finance/ClientCreditBadge";
import { ClientCreditApplyModal } from "@/components/finance/ClientCreditApplyModal";
import { useClienteCredito } from "@/hooks/useClienteCredito";
import { usePendingSessions, type PendingSession } from "@/hooks/usePendingSessions";
import { formatCurrency } from "@/utils/currencyUtils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight } from "lucide-react";

interface Props {
  clienteId: string;
  /** Contexto opcional — quando a sessão atual tem pendente, o click aplica direto nela. */
  currentSessionId?: string | null;
  currentSessionPendente?: number;
  className?: string;
}

/**
 * Badge de crédito do cliente com comportamento bidirecional:
 *  - Se a sessão atual tem pendente > 0: click abre modal de aplicação nela.
 *  - Caso contrário: click abre um popover com a lista de sessões pendentes
 *    do cliente para escolha manual.
 * Não renderiza nada quando saldo <= 0.
 */
export function ClientCreditActionButton({
  clienteId,
  currentSessionId,
  currentSessionPendente = 0,
  className,
}: Props) {
  const { data } = useClienteCredito(clienteId, false);
  const saldo = data?.saldo ?? 0;

  const [pickerOpen, setPickerOpen] = useState(false);
  const [applyTarget, setApplyTarget] = useState<{
    sessionId: string;
    pendente: number;
  } | null>(null);

  const canApplyToCurrent = Boolean(currentSessionId) && currentSessionPendente > 0;
  const pendings = usePendingSessions(clienteId, saldo > 0 && !canApplyToCurrent);
  const pendingList = pendings.data ?? [];

  if (!clienteId || saldo <= 0) return null;

  const handleClick = () => {
    if (canApplyToCurrent && currentSessionId) {
      setApplyTarget({
        sessionId: currentSessionId,
        pendente: currentSessionPendente,
      });
      return;
    }
    setPickerOpen(true);
  };

  return (
    <>
      {canApplyToCurrent ? (
        <ClientCreditBadge
          clienteId={clienteId}
          onClick={handleClick}
          className={className}
        />
      ) : (
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button type="button" className="contents">
              <ClientCreditBadge
                clienteId={clienteId}
                onClick={handleClick}
                className={className}
              />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="px-3 py-2 border-b text-xs font-medium">
              Aplicar crédito em sessão pendente
            </div>
            {pendingList.length === 0 ? (
              <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                Sem sessões pendentes deste cliente.
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                {pendingList.map((s: PendingSession) => (
                  <button
                    key={s.session_id}
                    type="button"
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-muted/60 transition-colors border-b last:border-b-0"
                    onClick={() => {
                      setPickerOpen(false);
                      setApplyTarget({
                        sessionId: s.session_id,
                        pendente: s.pendente,
                      });
                    }}
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {s.pacote || "Sessão"}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {s.data_sessao
                          ? format(parseISO(s.data_sessao), "dd/MM/yy", {
                              locale: ptBR,
                            })
                          : "sem data"}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-amber-600 font-semibold tabular-nums shrink-0">
                      {formatCurrency(s.pendente)}
                      <ArrowRight className="h-3 w-3" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>
      )}

      {applyTarget && (
        <ClientCreditApplyModal
          isOpen={Boolean(applyTarget)}
          onClose={() => setApplyTarget(null)}
          clienteId={clienteId}
          sessionId={applyTarget.sessionId}
          restanteSessao={applyTarget.pendente}
          onApplied={() => setApplyTarget(null)}
        />
      )}
    </>
  );
}
