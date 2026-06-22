/**
 * Adapter: implementa AppointmentsRepository delegando para o legado
 * SupabaseAgendaAdapter. Mapeia `Date` ↔ ISO `yyyy-MM-dd` na fronteira.
 *
 * Isto preserva 100% do comportamento atual (triggers, gallery sync,
 * workflow creation no INSERT) e permite migração incremental.
 */
import { SupabaseAgendaAdapter } from "@/adapters/SupabaseAgendaAdapter";
import type {
  Appointment as DomainAppointment,
  DateRange,
  DeletionAction,
  NewAppointment,
} from "../domain/types";
import type { AppointmentsRepository } from "../domain/ports";
import { formatDateForStorage, safeParseInputDate } from "@/utils/dateUtils";

const toIsoDate = (d: Date | string): string => {
  if (typeof d === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    const parsed = safeParseInputDate(d);
    return formatDateForStorage(parsed ?? new Date(d));
  }
  return formatDateForStorage(d);
};

const fromLegacy = (a: any): DomainAppointment => ({
  id: a.id,
  sessionId: a.sessionId,
  title: a.title,
  date: toIsoDate(a.date),
  time: a.time,
  type: a.type,
  client: a.client,
  status: a.status,
  description: a.description ?? undefined,
  packageId: a.packageId ?? undefined,
  produtosIncluidos: a.produtosIncluidos ?? undefined,
  paidAmount: a.paidAmount ?? undefined,
  email: a.email ?? undefined,
  whatsapp: a.whatsapp ?? undefined,
  orcamentoId: a.orcamentoId ?? undefined,
  origem: a.origem ?? undefined,
  clienteId: a.clienteId ?? undefined,
});

const toLegacy = (a: NewAppointment) => ({
  ...a,
  // legado espera Date — usamos parser timezone-safe
  date: safeParseInputDate(a.date) ?? new Date(`${a.date}T00:00:00`),
});

export class SupabaseAppointmentsRepository implements AppointmentsRepository {
  constructor(private readonly adapter = new SupabaseAgendaAdapter()) {}

  async listByRange(range: DateRange): Promise<DomainAppointment[]> {
    const rows = await this.adapter.loadAppointmentsByRange(range.start, range.end);
    return rows.map(fromLegacy);
  }

  async getById(id: string): Promise<DomainAppointment | null> {
    const all = await this.adapter.loadAppointments();
    const row = all.find((a) => a.id === id);
    return row ? fromLegacy(row) : null;
  }

  async create(input: NewAppointment): Promise<DomainAppointment> {
    // legado gera o ID dentro do AgendaService; aqui usamos saveAppointment direto
    const stamped = {
      ...toLegacy(input),
      id: `${Date.now()}${Math.random().toString(36).slice(2, 11)}`,
    } as any;
    const saved = await this.adapter.saveAppointment(stamped);
    return fromLegacy(saved);
  }

  async update(id: string, patch: Partial<NewAppointment>): Promise<void> {
    const legacyPatch: any = { ...patch };
    if (typeof patch.date === "string") {
      legacyPatch.date = safeParseInputDate(patch.date) ?? new Date(`${patch.date}T00:00:00`);
    }
    await this.adapter.updateAppointment(id, legacyPatch);
  }

  async delete(id: string, action?: DeletionAction): Promise<void> {
    await this.adapter.deleteAppointment(id, action);
  }
}
