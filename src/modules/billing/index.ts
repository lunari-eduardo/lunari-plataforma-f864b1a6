/**
 * Entry-point público do módulo Billing.
 * Importe SOMENTE deste arquivo no resto do app.
 */

// Registra os eventos do módulo no LunariEvents
import "./domain/events";

// Capabilities (registram-se no registry ao importar)
import "./application/commands/createGalleryPayment";
import "./application/commands/registerManualPayment";
import "./application/queries/listSessionPayments";

export { createGalleryPayment } from "./application/commands/createGalleryPayment";
export { registerManualPayment } from "./application/commands/registerManualPayment";
export { listSessionPayments } from "./application/queries/listSessionPayments";

// Tipos públicos
export type {
  BillingProvider,
  CreateGalleryPaymentInput,
  CreateGalleryPaymentOutput,
} from "./domain/types";

import { createGalleryPayment as _c1 } from "./application/commands/createGalleryPayment";
import { registerManualPayment as _c2 } from "./application/commands/registerManualPayment";
import { listSessionPayments as _q1 } from "./application/queries/listSessionPayments";
export const billingCapabilities = [_c1, _c2, _q1] as const;
