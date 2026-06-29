/**
 * Declaration merging — registra eventos do módulo Finance em LunariEvents.
 */
import "@/shared/event-bus";

declare module "@/shared/event-bus" {
  interface LunariEvents {
    "finance.transaction.created": {
      id: string;
      itemId: string;
      valor: number;
      photographerId: string;
      actor: "user" | "automation" | "ai";
    };
    "finance.transaction.updated": {
      id: string;
      changedKeys: string[];
      photographerId: string;
      actor: "user" | "automation" | "ai";
    };
    "finance.transaction.deleted": {
      id: string;
      photographerId: string;
      actor: "user" | "automation" | "ai";
    };
    "finance.transaction.paid": {
      id: string;
      at: string;
      photographerId: string;
      actor: "user" | "automation" | "ai";
    };
    "finance.transaction.reopened": {
      id: string;
      photographerId: string;
      actor: "user" | "automation" | "ai";
    };
    "finance.item.created": {
      id: string;
      nome: string;
      grupo: string;
      photographerId: string;
      actor: "user" | "automation" | "ai";
    };
    "finance.goal.upserted": {
      id: string;
      ano: number;
      mes: number;
      categoria: string;
      photographerId: string;
      actor: "user" | "automation" | "ai";
    };
  }
}

export {};
