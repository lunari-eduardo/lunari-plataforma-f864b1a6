import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { domainError, err, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";
import { sessionsRepo } from "@/features/workflow/data";

/**
 * Capability `workflow.listRange`
 *
 * Lista sessões em um intervalo arbitrário de datas (até 400 dias),
 * com paginação keyset. Pensada para análises multi-mês pelo assistente.
 */

const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "esperado YYYY-MM-DD");

const Input = z.object({
  startDate: DateStr,
  endDate: DateStr,
  includeHistorico: z.boolean().optional().default(false),
  categoria: z.string().optional(),
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional().default(500),
  cursor: z
    .object({ data_sessao: DateStr, id: z.string() })
    .nullable()
    .optional(),
});

const SessionSummary = z.object({
  id: z.string(),
  sessionId: z.string().nullable(),
  clienteId: z.string().nullable(),
  clienteNome: z.string().nullable(),
  dataSessao: z.string(),
  horaSessao: z.string().nullable(),
  status: z.string().nullable(),
  pacote: z.string().nullable(),
  categoria: z.string().nullable(),
  valorTotal: z.number(),
  valorPago: z.number(),
  statusFinanceiro: z.string().nullable(),
});

const Output = z.object({
  range: z.object({ start: z.string(), end: z.string() }),
  sessions: z.array(SessionSummary),
  nextCursor: z
    .object({ data_sessao: z.string(), id: z.string() })
    .nullable(),
});

export const listSessionsByRange = defineQuery({
  id: "workflow.listRange",
  title: "Listar sessões (intervalo)",
  description:
    "Lista sessões do Workflow num intervalo arbitrário de datas (máx 400 dias). Paginado via cursor keyset.",
  input: Input,
  output: Output,
  permissions: ["workflow:read"],
  async handler(input, ctx) {
    const { startDate, endDate, includeHistorico, categoria, status, limit, cursor } = input;
    const days = Math.round(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000,
    );
    if (days < 0) return err(domainError("VALIDATION", "endDate anterior a startDate."));
    if (days > 400) return err(domainError("VALIDATION", "Intervalo máximo: 400 dias."));

    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? ctx.user?.id;
    if (!userId) return err(domainError("UNAUTHENTICATED", "Sessão expirada."));

    let rows;
    try {
      rows = await sessionsRepo.listByRange(userId, startDate, endDate, {
        includeHistorico,
        categoria,
        status,
        limit,
        cursor: (cursor ?? null) as any,
      });
    } catch (cause) {
      ctx.log.error("falha ao listar sessões do intervalo", { cause });
      return err(
        domainError("EXTERNAL", "Não foi possível listar as sessões.", {
          retriable: true,
          cause,
        }),
      );
    }

    const sessions = rows.map((s: any) => ({
      id: s.id,
      sessionId: s.session_id ?? null,
      clienteId: s.cliente_id ?? null,
      clienteNome: s.clientes?.nome ?? null,
      dataSessao: s.data_sessao,
      horaSessao: s.hora_sessao ?? null,
      status: s.status ?? null,
      pacote: s.pacote ?? null,
      categoria: s.categoria ?? null,
      valorTotal: Number(s.valor_total ?? 0),
      valorPago: Number(s.valor_pago ?? 0),
      statusFinanceiro: s.status_financeiro ?? null,
    }));

    const last = rows.length === limit ? rows[rows.length - 1] : null;
    const nextCursor = last
      ? { data_sessao: (last as any).data_sessao, id: (last as any).id }
      : null;

    return ok({ range: { start: startDate, end: endDate }, sessions, nextCursor });
  },
});
