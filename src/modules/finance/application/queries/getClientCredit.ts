import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { domainError, err, isOk, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";
import { resolveUserId } from "../_auth";

/**
 * Query `finance.credit.get` — retorna saldo + histórico do cliente.
 */
const Input = z
  .object({
    clienteId: z.string().uuid(),
    incluirHistorico: z.boolean().default(true),
    historicoLimit: z.number().int().min(1).max(200).default(50),
  })
  .strict();

const LedgerRow = z.object({
  id: z.string(),
  data: z.string(),
  valor: z.number(),
  origem: z.string(),
  session_id_origem: z.string().nullable(),
  session_id_consumo: z.string().nullable(),
  descricao: z.string().nullable(),
  expira_em: z.string().nullable(),
  created_at: z.string(),
});

const Output = z.object({
  saldo: z.number(),
  proximaExpiracao: z.string().nullable(),
  historico: z.array(LedgerRow),
});

export const getClientCredit = defineQuery({
  id: "finance.credit.get",
  title: "Consultar crédito do cliente",
  description: "Saldo atual e histórico do ledger de crédito.",
  input: Input,
  output: Output,
  permissions: ["finance:read"],
  sideEffects: [],
  async handler({ clienteId, incluirHistorico, historicoLimit }, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;

    const { data: saldoRow, error: saldoErr } = await supabase
      .from("v_cliente_saldo" as never)
      .select("saldo, proxima_expiracao")
      .eq("cliente_id", clienteId)
      .maybeSingle();

    if (saldoErr) {
      ctx.log.error("falha ao ler saldo", { saldoErr });
      return err(
        domainError("EXTERNAL", "Erro ao consultar saldo.", {
          retriable: true,
          cause: saldoErr,
        }),
      );
    }

    const saldo = Number((saldoRow as { saldo?: number } | null)?.saldo ?? 0);
    const proximaExpiracao =
      (saldoRow as { proxima_expiracao?: string | null } | null)?.proxima_expiracao ?? null;

    let historico: z.infer<typeof LedgerRow>[] = [];
    if (incluirHistorico) {
      const { data: rows, error: histErr } = await supabase
        .from("cliente_creditos_ledger")
        .select(
          "id, data, valor, origem, session_id_origem, session_id_consumo, descricao, expira_em, created_at",
        )
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false })
        .limit(historicoLimit);

      if (histErr) {
        ctx.log.error("falha ao ler histórico", { histErr });
      } else {
        historico = (rows ?? []).map((r) => ({
          id: r.id,
          data: r.data,
          valor: Number(r.valor),
          origem: r.origem,
          session_id_origem: r.session_id_origem,
          session_id_consumo: r.session_id_consumo,
          descricao: r.descricao,
          expira_em: r.expira_em,
          created_at: r.created_at,
        }));
      }
    }

    return ok({ saldo, proximaExpiracao, historico });
  },
});
