import React from "react";
import { Button } from "@/components/ui/button";
import { CreditCard, Plus, Send, Images } from "lucide-react";
import { SessaoContratoButton } from "@/components/contratos/SessaoContratoButton";
import type { SessionData } from "@/types/workflow";

interface Props {
  session: SessionData;
  onCobrar: () => void;
  onCobrarExtras?: () => void;
  extrasPendente?: number;
  extrasFullyPaid?: boolean;
  onAgendarPagamento: () => void;
  onAbrirPagamentos: () => void;
}

/**
 * Coluna de ações (Bloco 3) do card expandido.
 *
 * "Cobrar extras" aparece quando a sessão está vinculada a uma galeria com
 * saldo > 0 (via RPC canônica `calculate_gallery_extra_payment`). Nunca
 * bloqueia "Cobrar" (sessão) — ambos independentes (handoff §3).
 */
export function ExpandedActions({
  session,
  onCobrar,
  onCobrarExtras,
  extrasPendente = 0,
  extrasFullyPaid = false,
  onAgendarPagamento,
  onAbrirPagamentos,
}: Props) {
  const hasGaleria = Boolean(session.galeriaId);
  const showExtras = hasGaleria && (extrasPendente > 0 || !extrasFullyPaid);

  return (
    <div className="space-y-3 flex flex-col items-center justify-center py-4">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Ações
      </h4>

      <div className="flex flex-col items-center gap-2 w-full max-w-[220px]">
        <Button
          variant="outline"
          size="sm"
          onClick={onCobrar}
          className="gap-2 w-full border-primary text-primary hover:bg-primary/10"
        >
          <Send className="h-3.5 w-3.5" />
          Cobrar sessão
        </Button>

        {showExtras && onCobrarExtras && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCobrarExtras}
            disabled={extrasPendente <= 0}
            className="gap-2 w-full border-amber-500/60 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
          >
            <Images className="h-3.5 w-3.5" />
            Cobrar extras
          </Button>
        )}

        <Button size="sm" onClick={onAgendarPagamento} className="gap-2 w-full">
          <Plus className="h-3.5 w-3.5" />
          Agendar pagamento manual
        </Button>

        <div className="w-full border-t border-border/20 my-1" />

        <Button variant="outline" size="sm" onClick={onAbrirPagamentos} className="gap-2 w-full">
          <CreditCard className="h-4 w-4" />
          Pagamentos
        </Button>

        {session.clienteId && (
          <SessaoContratoButton
            sessionId={session.sessionId || session.id}
            clienteId={session.clienteId}
            clienteNome={session.nome}
          />
        )}
      </div>
    </div>
  );
}
