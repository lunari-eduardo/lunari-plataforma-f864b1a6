/**
 * Entry-point público do módulo Workflow.
 * Importe SOMENTE deste arquivo no resto do app.
 */

// Registra eventos do módulo no LunariEvents
import "./domain/events";

// Capabilities (registram-se no registry global ao serem importadas)
import "./application/commands/advanceCard";
import "./application/commands/updateSessionFields";
import "./application/commands/deleteSession";
import "./application/commands/addPayment";
import "./application/commands/refundPayment";
import "./application/commands/reconcileFotosExtras";

import "./application/commands/syncFromAgenda";
import "./application/queries/getCardBySession";
import "./application/queries/listSessionsByMonth";
import "./application/queries/listStatusOptions";
import "./application/queries/searchSessions";
import "./application/queries/metricsForMonth";
import "./application/queries/pendingPayments";

// Re-export para uso direto via TanStack hooks ou execute()
export { advanceCard } from "./application/commands/advanceCard";
export { updateSessionFields } from "./application/commands/updateSessionFields";
export { deleteSession } from "./application/commands/deleteSession";
export { addPayment } from "./application/commands/addPayment";
export { refundPayment } from "./application/commands/refundPayment";
export { reconcileFotosExtras } from "./application/commands/reconcileFotosExtras";

export { syncFromAgenda } from "./application/commands/syncFromAgenda";
export { getCardBySession } from "./application/queries/getCardBySession";
export { listSessionsByMonth } from "./application/queries/listSessionsByMonth";
export { listStatusOptions } from "./application/queries/listStatusOptions";
export { searchSessions } from "./application/queries/searchSessions";
export { metricsForMonth } from "./application/queries/metricsForMonth";
export { pendingPayments } from "./application/queries/pendingPayments";

export { WorkflowCardSchema, WorkflowSessionStatusSchema } from "./domain/types";
export type { WorkflowCard } from "./domain/types";

// Handlers puros (reusáveis em testes e em outros bridges)
export { deriveWorkflowPaymentAttached } from "./application/handlers/onBillingChargeCreated";
export type {
  WorkflowPaymentAttached,
  BillingChargeCreated,
} from "./application/handlers/onBillingChargeCreated";

// Bridge de apresentação
export { WorkflowEventBridge } from "./presentation/WorkflowEventBridge";
