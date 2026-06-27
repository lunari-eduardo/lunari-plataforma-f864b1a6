import React from "react";
import { Button } from "@/components/ui/button";
import { CreditCard, Plus, Send } from "lucide-react";
import { SessaoContratoButton } from "@/components/contratos/SessaoContratoButton";
import type { SessionData } from "@/types/workflow";

interface Props {
  session: SessionData;
  onCobrar: () => void;
  onAgendarPagamento: () => void;
  onAbrirPagamentos: () => void;
}

/**
 * Coluna de ações (Bloco 3) do card expandido (Onda 5c).
 */
export function ExpandedActions({
  session,
  onCobrar,
  onAgendarPagamento,
  onAbrirPagamentos,
}: Props) {
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
          Cobrar
        </Button>

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
