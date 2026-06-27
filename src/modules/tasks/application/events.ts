/**
 * Declaration merging — registra eventos do módulo Tasks em LunariEvents.
 * Mantém o catálogo tipado (`TasksEvent` em domain/events.ts) e a superfície
 * runtime do eventBus alinhados.
 */
import "@/shared/event-bus";

declare module "@/shared/event-bus" {
  interface LunariEvents {
    "tasks.created": {
      id: string;
      title: string;
      status: string;
      photographerId: string;
      source: "user" | "automation" | "ai";
    };
    "tasks.updated": {
      id: string;
      changedKeys: string[];
      photographerId: string;
    };
    "tasks.moved": {
      id: string;
      from: string;
      to: string;
      photographerId: string;
    };
    "tasks.completed": {
      id: string;
      completedAt: string;
      photographerId: string;
    };
    "tasks.reopened": {
      id: string;
      photographerId: string;
    };
    "tasks.deleted": {
      id: string;
      photographerId: string;
    };
    "tasks.snoozed": {
      id: string;
      until: string;
      photographerId: string;
    };
    "tasks.assigned": {
      id: string;
      assigneeId: string | null;
      assigneeName: string | null;
      photographerId: string;
    };
  }
}

export {};
