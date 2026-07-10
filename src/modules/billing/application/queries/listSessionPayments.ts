import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { domainError, err, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";

/**
 * Capability `billing.listSessionPayments`
 * Lista cobranças e transações vinculadas a uma sessão.
 * Passo obrigatório antes de estorno — Lu apresenta ao usuário para
 * escolher qual pagamento estornar.
 */
const Input = z.object({ sessionId: z.string().uuid() }).strict();

const Payment = z.object({
  kind: z.enum(["cobranca", "transacao"]),
  id: z.string(),
  data: z.string().nullable(),
  valor: z.number(),
  status: z.string().nullable(),
  provedor: z.string().nullable(),
  finalidade: z.string().nullable(),
  descricao: z.string().nullable(),
});

const Output = z.object({
  sessionId: z.string(),
  totalPago: z.number(),
  items: z.array(Payment),
});

export const listSessionPayments = defineQuery({
  id: "billing.listSessionPayments",
  title: "Listar pagamentos da sessão",
  description:
    "Cobranças (gateway) e transações (manuais/estornos) vinculadas à sessão. Use antes de propor estorno.",
  input: Input,
  output: Output,
  permissions: ["financeiro:read"],
  async handler({ sessionId }, ctx) {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? ctx.user?.id;
    if (!userId) return err(domainError("UNAUTHENTICATED", "Sessão expirada."));

    const { data: sess, error: sErr } = await supabase
      .from("clientes_sessoes")
      .select("id, session_id, user_id")
      .eq("id", sessionId)
      .maybeSingle();
    if (sErr || !sess) return err(domainError("NOT_FOUND", "Sessão não encontrada."));
    if (sess.user_id !== userId) return err(domainError("FORBIDDEN", "Sem acesso."));

    const slug = sess.session_id ?? "";

    const [cobsRes, txsRes] = await Promise.all([
      supabase
        .from("cobrancas")
        .select("id, valor, status, provedor, finalidade, descricao, created_at, data_pagamento")
        .eq("session_id", slug)
        .order("created_at", { ascending: false }),
      supabase
        .from("clientes_transacoes")
        .select("id, valor, tipo, descricao, data_transacao")
        .eq("session_id", slug)
        .in("tipo", ["pagamento", "estorno", "ajuste"])
        .order("data_transacao", { ascending: false }),
    ]);

    if (cobsRes.error || txsRes.error) {
      ctx.log.error("listSessionPayments falhou", {
        cErr: cobsRes.error,
        tErr: txsRes.error,
      });
      return err(
        domainError("EXTERNAL", "Não foi possível listar pagamentos.", { retriable: true }),
      );
    }

    const items: z.infer<typeof Payment>[] = [];
    let totalPago = 0;

    for (const c of cobsRes.data ?? []) {
      items.push({
        kind: "cobranca",
        id: c.id,
        data: c.data_pagamento ?? c.created_at ?? null,
        valor: Number(c.valor ?? 0),
        status: c.status,
        provedor: c.provedor,
        finalidade: c.finalidade,
        descricao: c.descricao,
      });
    }
    for (const t of txsRes.data ?? []) {
      const v = Number(t.valor ?? 0);
      items.push({
        kind: "transacao",
        id: t.id,
        data: t.data_transacao,
        valor: v,
        status: t.tipo,
        provedor: null,
        finalidade: null,
        descricao: t.descricao,
      });
      if (t.tipo === "pagamento") totalPago += v;
      if (t.tipo === "estorno") totalPago += v; // já negativo
    }

    return ok({ sessionId, totalPago: Number(totalPago.toFixed(2)), items });
  },
});
