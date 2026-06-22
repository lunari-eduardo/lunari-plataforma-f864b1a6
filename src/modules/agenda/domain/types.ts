/**
 * Domain types — Agenda
 * Camada pura: sem React, sem Supabase, sem date-fns específicos de UI.
 * Datas são manipuladas como ISO `yyyy-MM-dd` (calendário) + `HH:mm` (hora local).
 */

import { z } from "zod";

export const AppointmentStatusSchema = z.enum(["confirmado", "a confirmar"]);
export type AppointmentStatus = z.infer<typeof AppointmentStatusSchema>;

export const AppointmentOriginSchema = z.enum(["agenda", "orcamento"]);
export type AppointmentOrigin = z.infer<typeof AppointmentOriginSchema>;

export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD");

export const TimeSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Hora deve estar no formato HH:MM");

export const ProdutoIncluidoSchema = z.object({
  id: z.string(),
  nome: z.string(),
  quantidade: z.number().int().nonnegative(),
  valorUnitario: z.number().nonnegative(),
  tipo: z.enum(["incluso", "manual"]),
});
export type ProdutoIncluido = z.infer<typeof ProdutoIncluidoSchema>;

export const AppointmentSchema = z.object({
  id: z.string(),
  sessionId: z.string().optional(),
  title: z.string().min(1),
  /** ISO yyyy-MM-dd na timezone local do usuário. */
  date: IsoDateSchema,
  time: TimeSchema,
  type: z.string(),
  client: z.string(),
  status: AppointmentStatusSchema,
  description: z.string().optional(),
  packageId: z.string().optional(),
  produtosIncluidos: z.array(ProdutoIncluidoSchema).optional(),
  paidAmount: z.number().nonnegative().optional(),
  email: z.string().optional(),
  whatsapp: z.string().optional(),
  orcamentoId: z.string().optional(),
  origem: AppointmentOriginSchema.optional(),
  clienteId: z.string().optional(),
});
export type Appointment = z.infer<typeof AppointmentSchema>;

export const NewAppointmentSchema = AppointmentSchema.omit({ id: true });
export type NewAppointment = z.infer<typeof NewAppointmentSchema>;

export const AvailabilitySlotSchema = z.object({
  id: z.string(),
  date: IsoDateSchema,
  time: TimeSchema,
  duration: z.number().int().positive(),
  typeId: z.string().optional(),
  label: z.string().optional(),
  color: z.string().optional(),
  isFullDay: z.boolean().optional(),
  fullDayDescription: z.string().optional(),
});
export type AvailabilitySlot = z.infer<typeof AvailabilitySlotSchema>;

export const NewAvailabilitySlotSchema = AvailabilitySlotSchema.omit({ id: true });
export type NewAvailabilitySlot = z.infer<typeof NewAvailabilitySlotSchema>;

export const DateRangeSchema = z
  .object({ start: IsoDateSchema, end: IsoDateSchema })
  .refine((v) => v.start <= v.end, { message: "start deve ser <= end" });
export type DateRange = z.infer<typeof DateRangeSchema>;

export const DeletionActionSchema = z.enum(["preserve", "refund", "remove"]);
export type DeletionAction = z.infer<typeof DeletionActionSchema>;
