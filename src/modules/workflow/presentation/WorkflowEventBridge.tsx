/**
 * Bridge entre o `eventBus` (domínio) e a UI do Workflow/Financeiro.
 *
 * Assina `billing.charge_created` e:
 *  1. Invalida queries financeiras (extrato, transações) para que UIs
 *     baseadas em TanStack Query reflitam a cobrança recém-criada;
 *  2. Re-emite `workflow.payment_attached` quando a cobrança está
 *     vinculada a uma sessão do funil — fonte única para qualquer parte
 *     da UI reagir (cards do workflow, notificações, IA, etc.).
 *
 * Montar UMA vez perto da raiz da app, dentro de `QueryClientProvider`.
 */
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { eventBus } from "@/shared/event-bus";
import { deriveWorkflowPaymentAttached } from "../application/handlers/onBillingChargeCreated";

export const WorkflowEventBridge: React.FC = () => {
  const qc = useQueryClient();

  React.useEffect(() => {
    const off = eventBus.on("billing.charge_created", async (event) => {
      // 1) Cache financeiro
      qc.invalidateQueries({ queryKey: ["financial-transactions"] });
      qc.invalidateQueries({ queryKey: ["extrato-unificado"] });

      // 2) Evento derivado para o funil
      const derived = deriveWorkflowPaymentAttached(event.payload);
      if (derived) {
        await eventBus.emit("workflow.payment_attached", derived, {
          source: "workflow.bridge",
          actorId: event.actorId ?? null,
        });
      }
    });
    return off;
  }, [qc]);

  return null;
};
