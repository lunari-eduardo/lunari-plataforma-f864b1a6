/**
 * Entry-point público do módulo Workflow.
 * Importe SOMENTE deste arquivo no resto do app.
 */

// Registra eventos do módulo no LunariEvents
import "./domain/events";

// Handlers puros (reusáveis em testes e em outros bridges)
export { deriveWorkflowPaymentAttached } from "./application/handlers/onBillingChargeCreated";
export type {
  WorkflowPaymentAttached,
  BillingChargeCreated,
} from "./application/handlers/onBillingChargeCreated";

// Bridge de apresentação
export { WorkflowEventBridge } from "./presentation/WorkflowEventBridge";
