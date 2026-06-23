import { z } from "zod";

/**
 * Tipos compartilhados do domínio Workflow.
 *
 * Status é livre (string) porque cada fotógrafo personaliza suas etapas
 * em `etapas_trabalho`; capabilities/IA devem listar dinamicamente as
 * etapas disponíveis via query antes de avançar um card.
 */

export const WorkflowSessionStatusSchema = z.string().min(1).max(80);

export const WorkflowCardSchema = z.object({
  id: z.string().min(1),
  clienteId: z.string().min(1).nullable(),
  status: WorkflowSessionStatusSchema.nullable(),
  pacote: z.string().nullable(),
  categoria: z.string().nullable(),
  valorTotal: z.number().nullable(),
  valorPago: z.number().nullable(),
  appointmentId: z.string().nullable(),
  galeriaId: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export type WorkflowCard = z.infer<typeof WorkflowCardSchema>;
