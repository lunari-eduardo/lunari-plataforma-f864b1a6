import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { domainError, err, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";

/**
 * Capability `workflow.listSessionsByPaymentStatus`
 * Lista sessões filtradas por status de pagamento agregado, calculado a
 * partir de `valor_total` / `valor_pago` (mantidos por trigger).
 */
const Input = z
  .object({
    status: z.enum(["pendente", "parcialmente_pago", "pago", "todos"]).default("pendente"),
    limit: z.number().int().min(1).max(200).default(50),
  })
  .strict();

const Item = z.object({
  sessionId: z.string(),
  clienteId: z.string().nullable(),
  clienteNome: z.string().nullable(),
  dataSessao: z.string().nullable(),
  categoria: z.string().nullable(),
  status: z.string().nullable(),
  valorTotal: z.number(),
  valorPago: z.number(),
  valorPendente: z.number(),
  paymentStatus: z.enum(["pendente", "parcialmente_pago", "pago"]),
});

const Output = z.object({ total: z.number(), items: z.array(Item) });

export const listSessionsByPaymentStatus = defineQuery({
  id: "workflow.listSessionsByPaymentStatus",
  title: "Sessões por status de pagamento",
  description:
    "Lista sessões filtradas por status agregado (pendente, parcialmente_pago, pago).",
  input: Input,
  output: Output,
  permissions: ["workflow:read", "financeiro:read"],
  async handler({ status, limit }, ctx) {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? ctx.user?.id;
    if (!userId) return err(domainError("UNAUTHENTICATED", "Sessão expirada."));

    const { data, error } = await supabase
      .from("clientes_sessoes")
      .select(
        "id, cliente_id, data_sessao, categoria, status, valor_total, valor_pago, clientes(nome)",
      )
      .eq("user_id", userId)
      .or("status.is.null,status.not.in.(historico,stub)")
      .order("data_sessao", { ascending: false })
      .limit(limit * 3);

    if (error) {
      ctx.log.error("listSessionsByPaymentStatus falhou", { error });
      return err(
        domainError("EXTERNAL", "Não foi possível listar sessões.", {
          retriable: true,
          cause: error,
        }),
      );
    }

    const derived = (data ?? []).map((r: any) => {
      const total = Number(r.valor_total ?? 0);
      const pago = Number(r.valor_pago ?? 0);
      const pendente = Math.max(0, total - pago);
      let ps: "pendente" | "parcialmente_pago" | "pago";
      if (pendente <= 0.01 && total > 0) ps = "pago";
      else if (pago > 0.01) ps = "parcialmente_pago";
      else ps = "pendente";
      return {
        sessionId: r.id as string,
        clienteId: (r.cliente_id as string | null) ?? null,
        clienteNome: r.clientes?.nome ?? null,
        dataSessao: (r.data_sessao as string | null) ?? null,
        categoria: (r.categoria as string | null) ?? null,
        status: (r.status as string | null) ?? null,
        valorTotal: total,
        valorPago: pago,
        valorPendente: pendente,
        paymentStatus: ps,
      };
    });

    const items = (status === "todos" ? derived : derived.filter((i) => i.paymentStatus === status))
      .slice(0, limit);

    return ok({ total: items.length, items });
  },
});
