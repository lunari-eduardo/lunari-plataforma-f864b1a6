import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { domainError, err, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";
import { sessionsRepo } from "@/features/workflow/data";

/**
 * Capability `workflow.listMonth`
 *
 * Lista sessões (cards) de um mês para o usuário autenticado.
 * Mantém paridade com `Context.fetchAndCacheMonth` (filtro
 * `neq status 'historico'`, JOIN clientes, ordem por `data_sessao`).
 *
 * Retorna shape resumido pensado para IA — números (não strings de moeda).
 */

const Input = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
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
  year: z.number(),
  month: z.number(),
  sessions: z.array(SessionSummary),
});

export const listSessionsByMonth = defineQuery({
  id: "workflow.listMonth",
  title: "Listar sessões do mês",
  description:
    "Retorna as sessões do Workflow do mês solicitado (exclui histórico).",
  input: Input,
  output: Output,
  permissions: ["workflow:read"],
  async handler({ year, month }, ctx) {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? ctx.user?.id;
    if (!userId) {
      return err(domainError("UNAUTHENTICATED", "Sessão expirada."));
    }

    let rows;
    try {
      rows = await sessionsRepo.listByMonth(userId, year, month);
    } catch (cause) {
      ctx.log.error("falha ao listar sessões do mês", { cause });
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

    return ok({ year, month, sessions });
  },
});
