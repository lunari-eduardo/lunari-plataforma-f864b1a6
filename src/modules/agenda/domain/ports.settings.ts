/**
 * Port: repositório de configurações da agenda.
 */
import type { AgendaSettings } from "@/types/agenda-supabase";

export interface SettingsRepository {
  load(): Promise<AgendaSettings>;
  save(settings: AgendaSettings): Promise<void>;
}
