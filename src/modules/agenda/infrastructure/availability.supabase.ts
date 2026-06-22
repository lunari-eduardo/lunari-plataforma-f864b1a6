/**
 * Adapter: implementa AvailabilityRepository delegando para o legado.
 */
import { SupabaseAgendaAdapter } from "@/adapters/SupabaseAgendaAdapter";
import type { AvailabilitySlot, NewAvailabilitySlot } from "../domain/types";
import type { AvailabilityRepository } from "../domain/ports.availability";

export class SupabaseAvailabilityRepository implements AvailabilityRepository {
  constructor(private readonly adapter = new SupabaseAgendaAdapter()) {}

  list(): Promise<AvailabilitySlot[]> {
    return this.adapter.loadAvailabilitySlots() as Promise<AvailabilitySlot[]>;
  }

  addMany(slots: NewAvailabilitySlot[]): Promise<void> {
    return this.adapter.addAvailabilitySlots(slots);
  }

  clearForDate(date: string): Promise<void> {
    return this.adapter.clearAvailabilityForDate(date);
  }

  delete(id: string): Promise<void> {
    return this.adapter.deleteAvailabilitySlot(id);
  }
}
