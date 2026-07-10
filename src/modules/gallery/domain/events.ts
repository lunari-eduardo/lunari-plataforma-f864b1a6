/**
 * Eventos do módulo Gallery. Declaration merging em LunariEvents.
 */
import "@/shared/event-bus";

declare module "@/shared/event-bus" {
  interface LunariEvents {
    "gallery.reopened": {
      galeriaId: string;
      dias: number;
      motivo: string | null;
      photographerId: string;
      newExpiresAt: string | null;
    };
  }
}

export {};
