/**
 * Superfície de IA da Agenda — política declarativa.
 *
 * Regra (Constituição Lunari v1.0 + ASSISTANT_GUIDE):
 *  - A Lu só executa capabilities que o usuário já poderia executar manualmente.
 *  - Ações destrutivas exigem aprovação humana explícita.
 *  - Cancelamentos com estorno e limpeza de disponibilidade ficam fora do
 *    allowed set inicial; só entram via fluxo de aprovação da Lu.
 */

import type { AuthUser } from "@/shared/ports";
import { getCapability, listCapabilities } from "@/shared/capability";

export const AGENDA_PERMISSIONS = ["agenda:read", "agenda:write"] as const;
export type AgendaPermission = (typeof AGENDA_PERMISSIONS)[number];

/**
 * Capabilities de Agenda expostas à IA v1.
 * Escopo: leitura completa + criação/confirmação/reagendamento/update.
 * Fora: cancelamentos (dispara estorno via trigger) e destruição de slots.
 */
export const AI_AGENDA_ALLOWED: ReadonlySet<string> = new Set([
  // Queries
  "agenda.appointments.list",
  "agenda.appointments.get",
  "agenda.availability.list",
  "agenda.availability.findNext",
  "agenda.slot.check",
  // Commands (não-destrutivos)
  "agenda.appointments.create",
  "agenda.appointments.confirm",
  "agenda.appointments.reschedule",
  "agenda.appointments.update",
  "agenda.availability.add",
]);

/**
 * Capabilities que exigem aprovação humana quando invocadas pela IA.
 * Motivo: efeito colateral irreversível (estorno financeiro, remoção de slots).
 */
export const REQUIRES_APPROVAL: ReadonlySet<string> = new Set([
  "agenda.appointments.cancel",
  "agenda.appointments.reschedule",
  "agenda.availability.clearDate",
  "agenda.availability.deleteSlot",
]);

export function listAgendaAICapabilityIds(): string[] {
  return listCapabilities({ module: "agenda" })
    .map((c) => c.id)
    .filter((id) => AI_AGENDA_ALLOWED.has(id));
}

export function canUserRun(user: AuthUser | null, capabilityId: string): boolean {
  if (!user) return false;
  if (!AI_AGENDA_ALLOWED.has(capabilityId)) return false;
  return !!getCapability(capabilityId);
}

export function needsHumanApproval(capabilityId: string): boolean {
  return REQUIRES_APPROVAL.has(capabilityId);
}
