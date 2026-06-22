/**
 * Port: repositório de tipos de disponibilidade (cores/labels).
 */
import type { AvailabilityType } from "@/types/availability";

export interface AvailabilityTypesRepository {
  list(): Promise<AvailabilityType[]>;
  add(data: Omit<AvailabilityType, "id">): Promise<AvailabilityType>;
  update(id: string, updates: Partial<AvailabilityType>): Promise<void>;
  delete(id: string): Promise<void>;
}
