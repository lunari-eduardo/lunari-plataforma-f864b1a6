/**
 * Handler puro: dado o payload de `billing.charge_created`, decide se
 * deve emitir `workflow.payment_attached` (ou seja, se a cobrança pertence
 * a uma sessão do funil) e devolve o payload derivado.
 *
 * Manter PURO — sem efeitos colaterais aqui. O bridge de apresentação é
 * quem invalida cache e emite eventos no `eventBus`.
 */
import type { EventPayload } from "@/shared/event-bus";

export type WorkflowPaymentAttached = EventPayload<"workflow.payment_attached">;
export type BillingChargeCreated = EventPayload<"billing.charge_created">;

export function deriveWorkflowPaymentAttached(
  payload: BillingChargeCreated,
): WorkflowPaymentAttached | null {
  if (!payload.sessionId) return null;
  return {
    sessionId: payload.sessionId,
    cobrancaId: payload.cobrancaId,
    provider: payload.provider,
    photographerId: payload.photographerId,
    clienteId: payload.clienteId,
    galleryId: payload.galleryId,
    valor: payload.valor,
    reused: payload.reused,
  };
}
