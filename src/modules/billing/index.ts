/**
 * Entry-point público do módulo Billing.
 * Importe SOMENTE deste arquivo no resto do app.
 */

// Registra os eventos do módulo no LunariEvents
import "./domain/events";

// Capabilities (commands)
export { createGalleryPayment } from "./application/commands/createGalleryPayment";

// Tipos públicos
export type {
  BillingProvider,
  CreateGalleryPaymentInput,
  CreateGalleryPaymentOutput,
} from "./domain/types";

// Lista explícita para exposição ao AI Assistant
import { createGalleryPayment as _c1 } from "./application/commands/createGalleryPayment";
export const billingCapabilities = [_c1] as const;
