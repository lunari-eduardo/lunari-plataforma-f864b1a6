import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { domainError, err, isOk, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";
import { resolveUserId } from "../_auth";

/**
 * Capability `finance.credit.listClientsWithCredit`
 * Lista clientes com saldo de crédito > 0, agregado do ledger.
 */
const Input = z
  .object({
    limit: z.number().int().min(1).max(200).default(50),
    incluirExpirados: z.boolean().default(false),
  })
  .strict();

const Item = z.object({
  clienteId: z.string(),
  clienteNome: z.string().nullable(),
  saldo: z.number(),
  proximaExpiracao: z.string().nullable(),
});

const Output = z.object({ total: z.number(), items: z.array(Item) });

export const listClientsWithCredit = defineQuery({
  id: "finance.credit.listClientsWithCredit",
  title: "Clientes com crédito disponível",
  description: "Lista clientes com saldo positivo no ledger de crédito.",
  input: Input,
  output: Output,
  permissions: ["finance:read"],
  async handler({ limit, incluirExpirados }, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;

    const hoje = new Date().toISOString().split("T")[0];
    const query = supabase
      .from("cliente_creditos_ledger")
      .select("cliente_id, valor, expira_em, clientes(nome)")
      .eq("user_id", auth.value);

    if (!incluirExpirados) query.or(`expira_em.is.null,expira_em.gte.${hoje}`);

    const { data, error } = await query.limit(5000);
    if (error) {
      ctx.log.error("listClientsWithCredit falhou", { error });
      return err(
        domainError("EXTERNAL", "Não foi possível listar créditos.", {
          retriable: true,
          cause: error,
        }),
      );
    }

    const map = new Map<
      string,
      { nome: string | null; saldo: number; proxExp: string | null }
    >();
    for (const r of (data ?? []) as any[]) {
      const cur = map.get(r.cliente_id) ?? {
        nome: r.clientes?.nome ?? null,
        saldo: 0,
        proxExp: null,
      };
      cur.saldo += Number(r.valor ?? 0);
      if (r.expira_em && (!cur.proxExp || r.expira_em < cur.proxExp)) cur.proxExp = r.expira_em;
      map.set(r.cliente_id, cur);
    }

    const items = Array.from(map.entries())
      .filter(([, v]) => v.saldo > 0.001)
      .sort((a, b) => b[1].saldo - a[1].saldo)
      .slice(0, limit)
      .map(([clienteId, v]) => ({
        clienteId,
        clienteNome: v.nome,
        saldo: Number(v.saldo.toFixed(2)),
        proximaExpiracao: v.proxExp,
      }));

    return ok({ total: items.length, items });
  },
});
