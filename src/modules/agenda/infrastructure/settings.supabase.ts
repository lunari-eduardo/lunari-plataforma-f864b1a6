/**
 * Implementação de SettingsRepository.
 *
 * NOTA: legado armazena settings da agenda em `localStorage`
 * (chave `agenda_settings`) — não há tabela Supabase para isso ainda.
 * Mantemos a mesma semântica para preservar dados já salvos pelo usuário.
 */
import type { AgendaSettings } from "@/types/agenda-supabase";
import type { SettingsRepository } from "../domain/ports.settings";

const STORAGE_KEY = "agenda_settings";

const DEFAULTS: AgendaSettings = {
  defaultView: "weekly",
  workingHours: { start: "08:00", end: "18:00" },
  autoConfirmAppointments: false,
};

export class SupabaseSettingsRepository implements SettingsRepository {
  async load(): Promise<AgendaSettings> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as AgendaSettings) : DEFAULTS;
    } catch (error) {
      console.error("Error loading agenda settings:", error);
      return DEFAULTS;
    }
  }

  async save(settings: AgendaSettings): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error("Error saving agenda settings:", error);
      throw error;
    }
  }
}
