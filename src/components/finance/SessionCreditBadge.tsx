import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ClientCreditApplyModal } from "@/components/finance/ClientCreditApplyModal";
import { useClienteCredito } from "@/hooks/useClienteCredito";
import { useSessionCreditContext } from "@/hooks/useSessionCreditContext";
import { usePendingSessions, type PendingSession } from "@/hooks/usePendingSessions";
import { formatCurrency } from "@/utils/currencyUtils";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, Check, Wallet } from "lucide-react";

interface Props {
  clienteId: string;
  /** session_id (texto) da sessão atual. */
  sessionId?: string | null;
  /** Valor pendente da sessão atual (usado para aplicar direto). */
  sessionPendente?: number;
  className?: string;
}

/**
 * Badge de crédito por SESSÃO (não global do cliente).
 *
 * Prioridades:
 *  1. Sessão GEROU crédito e ainda tem saldo remanescente → badge âmbar
 *     "+R$X gerado". Ao clicar, abre popover para aplicar em outra sessão pendente.
 *  2. Sessão gerou crédito mas já foi TOTALMENTE consumido → chip cinza
 *     "Crédito usado".
 *  3. Cliente tem saldo global > 0 e sessão atual tem pendente > 0 → badge
 *     esmeralda "Aplicar R$Y" abre o modal para aplicar aqui.
 *  4. Cliente tem saldo global > 0 e sessão sem pendente → badge esmeralda,
 *     ao clicar mostra popover com sessões pendentes deste cliente.
 *  5. Nenhum dos casos → não renderiza.
 */
export function SessionCreditBadge({
  clienteId,
  sessionId,
  sessionPendente = 0,
  className,
}: Props) {
  const { data: credito } = useClienteCredito(clienteId, false);
  const { data: ctx } = useSessionCreditContext(sessionId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [applyTarget, setApplyTarget] = useState<{
    sessionId: string;
    pendente: number;
  } | null>(null);

  const saldo = credito?.saldo ?? 0;
  const remainingFromSession = ctx?.remainingFromSession ?? 0;
  const generatedBySession = ctx?.generatedBySession ?? 0;
  const consumedFromSession = ctx?.consumedFromSession ?? 0;

  // Popover só carrega quando necessário
  const needsPicker =
    (remainingFromSession > 0) ||
    (saldo > 0 && sessionPendente <= 0);
  const pendings = usePendingSessions(clienteId, needsPicker);
  const pendingList = (pendings.data ?? []).filter(
    (s) => !sessionId || s.session_id !== sessionId,
  );

  if (!clienteId) return null;

  // Caso 2: crédito usado nesta sessão (integralmente consumido)
  if (generatedBySession > 0 && remainingFromSession <= 0 && consumedFromSession > 0) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium",
          "border border-muted-foreground/20 bg-muted/40 text-muted-foreground",
          className,
        )}
        title={`Crédito de ${formatCurrency(generatedBySession)} consumido em outra sessão`}
      >
        <Check className="h-3.5 w-3.5 shrink-0" />
        <span>Crédito usado</span>
      </span>
    );
  }

  // Caso 1: sessão gerou crédito, ainda tem saldo → aplicar em outra
  if (remainingFromSession > 0) {
    return (
      <>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium",
                "border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                "cursor-pointer transition-colors hover:bg-amber-500/20",
                className,
              )}
              title="Crédito gerado por esta sessão. Clique para aplicar em uma sessão pendente."
            >
              <Wallet className="h-3.5 w-3.5 shrink-0" />
              <span>
                +{formatCurrency(remainingFromSession)} gerado
              </span>
            </button>
          </PopoverTrigger>
          <PickerContent
            pendingList={pendingList}
            onPick={(s) => {
              setPickerOpen(false);
              setApplyTarget({ sessionId: s.session_id, pendente: s.pendente });
            }}
          />
        </Popover>
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

  // A partir daqui: sessão não gerou crédito relevante.
  if (saldo <= 0) return null;

  // Caso 3: cliente tem saldo, sessão atual tem pendente → aplicar aqui
  if (sessionPendente > 0 && sessionId) {
    return (
      <>
        <button
          type="button"
          onClick={() =>
            setApplyTarget({ sessionId, pendente: sessionPendente })
          }
          className={cn(
            "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium",
            "border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
            "cursor-pointer transition-colors hover:bg-emerald-500/20 hover:border-emerald-500/50",
            className,
          )}
          title="Aplicar crédito disponível nesta sessão"
        >
          <Wallet className="h-3.5 w-3.5 shrink-0" />
          <span>
            Aplicar {formatCurrency(Math.min(saldo, sessionPendente))}
          </span>
        </button>
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

  // Caso 4: cliente tem saldo, sessão atual sem pendente → escolher outra
  return (
    <>
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium",
              "border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
              "cursor-pointer transition-colors hover:bg-emerald-500/20 hover:border-emerald-500/50",
              className,
            )}
            title="Crédito disponível para aplicar em outra sessão"
          >
            <Wallet className="h-3.5 w-3.5 shrink-0" />
            <span>Crédito: {formatCurrency(saldo)}</span>
          </button>
        </PopoverTrigger>
        <PickerContent
          pendingList={pendingList}
          onPick={(s) => {
            setPickerOpen(false);
            setApplyTarget({ sessionId: s.session_id, pendente: s.pendente });
          }}
        />
      </Popover>
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

function PickerContent({
  pendingList,
  onPick,
}: {
  pendingList: PendingSession[];
  onPick: (s: PendingSession) => void;
}) {
  return (
    <PopoverContent align="end" className="w-80 p-0">
      <div className="px-3 py-2 border-b text-xs font-medium">
        Aplicar crédito em sessão pendente
      </div>
      {pendingList.length === 0 ? (
        <div className="px-3 py-4 text-xs text-muted-foreground text-center">
          Sem outras sessões pendentes deste cliente.
        </div>
      ) : (
        <div className="max-h-72 overflow-y-auto">
          {pendingList.map((s) => (
            <button
              key={s.session_id}
              type="button"
              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-muted/60 transition-colors border-b last:border-b-0"
              onClick={() => onPick(s)}
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{s.pacote || "Sessão"}</div>
                <div className="text-[11px] text-muted-foreground">
                  {s.data_sessao
                    ? format(parseISO(s.data_sessao), "dd/MM/yy", { locale: ptBR })
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
  );
}
