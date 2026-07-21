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
      toStatus: string | null;
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

    /** Pagamento manual estornado via `workflow.refundPayment`. */
    "workflow.payment_refunded": {
      transactionId: string;
      estornoId: string;
      sessionId: string | null;
      valorEstornado: number;
      photographerId: string;
    };

    // ── Produtos (fluxo de produção) ────────────────────────────────────
    "workflow.produto_stage_changed": {
      sessionId: string;
      produtoId: string;
      direction: "advance" | "retreat" | "set";
      etapaAtual: string | null;
      photographerId: string;
    };
    "workflow.produto_flow_changed": {
      sessionId: string;
      produtoId: string;
      fluxo: "padrao" | "custom";
      photographerId: string;
    };
    "workflow.produto_deadline_changed": {
      sessionId: string;
      produtoId: string;
      prazoEntrega: string | null;
      photographerId: string;
    };
    "workflow.produto_price_changed": {
      sessionId: string;
      produtoId: string;
      anterior: number;
      novo: number;
      photographerId: string;
    };
    "workflow.produto_qty_changed": {
      sessionId: string;
      produtoId: string;
      anterior: number;
      novo: number;
      photographerId: string;
    };
    "workflow.produto_added": {
      sessionId: string;
      produtoId: string;
      nome: string;
      photographerId: string;
    };
    "workflow.produto_removed": {
      sessionId: string;
      produtoId: string;
      nome: string;
      photographerId: string;
    };
  }
}

export {};
