/**
 * Port: repositório de disponibilidade.
 */
import type { AvailabilitySlot, NewAvailabilitySlot } from "../domain/types";

export interface AvailabilityRepository {
  list(): Promise<AvailabilitySlot[]>;
  addMany(slots: NewAvailabilitySlot[]): Promise<void>;
  clearForDate(date: string): Promise<void>;
  delete(id: string): Promise<void>;
}
