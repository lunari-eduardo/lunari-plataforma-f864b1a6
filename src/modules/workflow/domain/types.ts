import { z } from "zod";

/**
 * Tipos compartilhados do domínio Workflow.
 *
 * Status é livre (string) porque cada fotógrafo personaliza suas etapas
 * em `etapas_trabalho`; capabilities/IA devem listar dinamicamente as
 * etapas disponíveis via query antes de avançar um card.
 */

export const WorkflowSessionStatusSchema = z.string().min(1).max(80);

/**
 * Schema de entrada para mutações que aceitam "limpar" o status.
 * Coage strings vazias / "__CLEAR__" para `null` antes da validação.
 */
export const WorkflowSessionStatusInputSchema = z
  .union([z.string(), z.null()])
  .transform((v) => {
    if (v === null) return null;
    const trimmed = v.trim();
    if (trimmed === "" || trimmed === "__CLEAR__") return null;
    return trimmed;
  })
  .pipe(z.union([WorkflowSessionStatusSchema, z.null()]));

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
