/**
 * Catálogo de eventos do módulo Workflow.
 * Declaration merging em LunariEvents — outros módulos (Notificações, IA,
 * Analytics) podem assinar com tipagem total.
 */
import "@/shared/event-bus";

declare module "@/shared/event-bus" {
  interface LunariEvents {
    /**
     * Disparado quando uma cobrança recém-criada está vinculada a uma
     * sessão do funil de trabalho. Permite reagir (ex.: atualizar cards,
     * disparar notificação) sem acoplar o Workflow ao módulo Billing.
     */
    "workflow.payment_attached": {
      sessionId: string;
      cobrancaId: string;
      provider: "asaas" | "mercadopago" | "infinitepay";
      photographerId: string;
      clienteId: string;
      galleryId: string | null;
      valor: number;
      reused: boolean;
    };

    /**
     * Disparado quando um card do funil avança (ou retrocede) de etapa.
     * Permite que Notificações, IA e Analytics reajam sem depender da UI.
     */
    "workflow.card_advanced": {
      sessionId: string;
      fromStatus: string | null;
      toStatus: string;
      photographerId: string;
    };

    /** Sessão teve campos atualizados via `workflow.updateFields`. */
    "workflow.card_updated": {
      sessionId: string;
      changedKeys: string[];
      photographerId: string;
    };

    /** Sessão foi excluída/arquivada via `workflow.deleteSession`. */
    "workflow.card_deleted": {
      sessionId: string;
      action: "preserve" | "refund" | "remove";
      photographerId: string;
      estornosCriados: number;
    };

    /** Pagamento manual registrado via `workflow.addPayment`. */
    "workflow.payment_added": {
      sessionId: string;
      transactionId: string;
      valor: number;
      formaPagamento: string;
      photographerId: string;
    };
  }
}

export {};
