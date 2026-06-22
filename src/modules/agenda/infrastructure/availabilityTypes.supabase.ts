/**
 * Implementação de AvailabilityTypesRepository.
 *
 * NOTA: legado armazena tipos de disponibilidade em `localStorage`
 * (chave `agenda_availability_types`) — não há tabela Supabase para
 * isso ainda. Mantemos a mesma semântica para preservar compatibilidade
 * com dados já salvos pelo usuário. Quando migrarmos para uma tabela
 * dedicada, basta trocar a implementação aqui sem mexer no consumidor.
 */
import type { AvailabilityType } from "@/types/availability";
import type { AvailabilityTypesRepository } from "../domain/ports.availabilityTypes";

const STORAGE_KEY = "agenda_availability_types";

const DEFAULTS: AvailabilityType[] = [
  { id: "1", name: "Disponível", color: "#10b981" },
  { id: "2", name: "Ocupado", color: "#ef4444" },
];

function readAll(): AvailabilityType[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as AvailabilityType[]) : [];
    return parsed.length > 0 ? parsed : DEFAULTS;
  } catch (error) {
    console.error("Error loading availability types:", error);
    return [];
  }
}

function writeAll(types: AvailabilityType[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(types));
}

export class SupabaseAvailabilityTypesRepository implements AvailabilityTypesRepository {
  async list(): Promise<AvailabilityType[]> {
    return readAll();
  }

  async add(data: Omit<AvailabilityType, "id">): Promise<AvailabilityType> {
    const newType: AvailabilityType = { id: crypto.randomUUID(), ...data };
    const current = readAll();
    writeAll([...current, newType]);
    return newType;
  }

  async update(id: string, updates: Partial<AvailabilityType>): Promise<void> {
    const current = readAll();
    writeAll(current.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  }

  async delete(id: string): Promise<void> {
    const current = readAll();
    writeAll(current.filter((t) => t.id !== id));
  }
}
