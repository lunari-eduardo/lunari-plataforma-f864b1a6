/**
 * Catálogo de eventos do módulo Billing.
 * Declaration merging em LunariEvents — Workflow, Notificações, IA podem
 * assinar com tipagem total.
 */
import "@/shared/event-bus";

declare module "@/shared/event-bus" {
  interface LunariEvents {
    "billing.charge_created": {
      cobrancaId: string;
      provider: "asaas" | "mercadopago" | "infinitepay";
      photographerId: string;
      clienteId: string;
      sessionId: string | null;
      galleryId: string | null;
      valor: number;
      paymentUrl: string | null;
      reused: boolean;
    };
  }
}

export {};
