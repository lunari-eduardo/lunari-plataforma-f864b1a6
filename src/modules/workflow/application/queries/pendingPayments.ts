import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { domainError, err, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";

/**
 * Capability `workflow.pendingPayments`
 *
 * Lista sessões com saldo a receber dentro de uma janela (default 30 dias
 * a partir de hoje). Retorna valores em centavos para a IA ranquear/
 * priorizar follow-ups.
 */

const Input = z.object({
  rangeDays: z.number().int().min(1).max(365).default(30),
  limit: z.number().int().min(1).max(200).default(50),
});

const PendingHit = z.object({
  sessionId: z.string(),
  sessionIdText: z.string().nullable(),
  clienteId: z.string().nullable(),
  clienteNome: z.string().nullable(),
  dataSessao: z.string(),
  valorTotalCentavos: z.number(),
  valorPagoCentavos: z.number(),
  restanteCentavos: z.number(),
});

const Output = z.object({
  total: z.number(),
  restanteTotalCentavos: z.number(),
  items: z.array(PendingHit),
});

export const pendingPayments = defineQuery({
  id: "workflow.pendingPayments",
  title: "Pagamentos pendentes",
  description:
    "Sessões com saldo a receber dentro da janela (default 30 dias).",
  input: Input,
  output: Output,
  permissions: ["workflow:read", "financeiro:read"],
  async handler({ rangeDays, limit }, ctx) {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? ctx.user?.id;
    if (!userId) return err(domainError("UNAUTHENTICATED", "Sessão expirada."));

    const today = new Date();
    const past = new Date(today);
    past.setDate(past.getDate() - rangeDays);
    const future = new Date(today);
    future.setDate(future.getDate() + rangeDays);
    const start = past.toISOString().split("T")[0];
    const end = future.toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("clientes_sessoes")
      .select(
        "id, session_id, cliente_id, data_sessao, valor_total, valor_pago, clientes(nome)",
      )
      .eq("user_id", userId)
      .neq("status", "historico")
      .gte("data_sessao", start)
      .lte("data_sessao", end)
      .order("data_sessao", { ascending: true })
      .limit(limit);

    if (error) {
      ctx.log.error("falha em pendingPayments", { error });
      return err(
        domainError("EXTERNAL", "Não foi possível listar pendências.", {
          retriable: true,
          cause: error,
        }),
      );
    }

    const items = (data || [])
      .map((row: any) => {
        const totalC = Math.round(Number(row.valor_total ?? 0) * 100);
        const pagoC = Math.round(Number(row.valor_pago ?? 0) * 100);
        return {
          sessionId: row.id as string,
          sessionIdText: (row.session_id as string | null) ?? null,
          clienteId: (row.cliente_id as string | null) ?? null,
          clienteNome: row.clientes?.nome ?? null,
          dataSessao: row.data_sessao as string,
          valorTotalCentavos: totalC,
          valorPagoCentavos: pagoC,
          restanteCentavos: Math.max(0, totalC - pagoC),
        };
      })
      .filter((h) => h.restanteCentavos > 0);

    const restanteTotal = items.reduce((a, b) => a + b.restanteCentavos, 0);

    return ok({
      total: items.length,
      restanteTotalCentavos: restanteTotal,
      items,
    });
  },
});
