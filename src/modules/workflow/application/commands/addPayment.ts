import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { domainError, err, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";

/**
 * Capability `workflow.addPayment`
 *
 * Registra pagamento manual de uma sessão em `clientes_transacoes`
 * (tipo='pagamento'). Hoje a página tem apenas `console.log` neste handler,
 * então esta capability é a primeira implementação real do fluxo.
 *
 * Idempotência por (sessionId, valor, data, formaPagamento) durante 10min
 * evita duplicidade quando a IA repete o comando.
 *
 * Trigger DB recalcula `valor_pago`/`status_financeiro` da sessão; o cliente
 * NÃO deve enviar esses campos (constraint de schema-constraints).
 */

const Input = z.object({
  sessionId: z.string().uuid(),
  valor: z.number().int().positive(), // centavos
  dataTransacao: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  formaPagamento: z.string().min(1).max(40),
  descricao: z.string().max(200).optional(),
});

const Output = z.object({
  transactionId: z.string(),
  sessionId: z.string(),
  valor: z.number(),
});

export const addPayment = defineCommand({
  id: "workflow.addPayment",
  title: "Registrar pagamento manual",
  description:
    "Cria transação manual de pagamento vinculada a uma sessão do Workflow.",
  input: Input,
  output: Output,
  permissions: ["workflow:write", "financeiro:write"],
  sideEffects: [
    "db:clientes_transacoes",
    "db:clientes_sessoes(trigger)",
    "event:workflow.payment_added",
  ],
  audit: "always",
  idempotencyKey: (i) =>
    `workflow.addPayment:${i.sessionId}:${i.valor}:${i.dataTransacao}:${i.formaPagamento}`,
  examples: [
    {
      nl: "Registrar pagamento de R$250,00 hoje no PIX para a sessão X",
      input: {
        sessionId: "00000000-0000-0000-0000-000000000000",
        valor: 25000,
        dataTransacao: "2026-06-24",
        formaPagamento: "PIX",
      },
    },
  ],
  async handler({ sessionId, valor, dataTransacao, formaPagamento, descricao }, ctx) {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? ctx.user?.id;
    if (!userId) {
      return err(domainError("UNAUTHENTICATED", "Sessão expirada."));
    }

    const { data: sessionRow, error: readErr } = await supabase
      .from("clientes_sessoes")
      .select("id, session_id, cliente_id, user_id")
      .eq("id", sessionId)
      .maybeSingle();

    if (readErr) {
      ctx.log.error("falha ao ler sessão p/ pagamento", { readErr });
      return err(
        domainError("EXTERNAL", "Não foi possível ler a sessão.", {
          retriable: true,
          cause: readErr,
        }),
      );
    }
    if (!sessionRow) {
      return err(domainError("NOT_FOUND", "Sessão não encontrada.", { details: { sessionId } }));
    }
    if (sessionRow.user_id !== userId) {
      return err(domainError("FORBIDDEN", "Sem acesso a esta sessão."));
    }
    if (!sessionRow.cliente_id) {
      return err(
        domainError("VALIDATION", "Sessão sem cliente vinculado — não é possível registrar pagamento."),
      );
    }

    const valorReais = valor / 100;

    const { data: inserted, error: insErr } = await supabase
      .from("clientes_transacoes")
      .insert({
        cliente_id: sessionRow.cliente_id,
        session_id: sessionRow.session_id ?? null,
        user_id: userId,
        valor: valorReais,
        data_transacao: dataTransacao,
        tipo: "pagamento",
        descricao: descricao ?? `Pagamento ${formaPagamento}`,
        updated_by: userId,
      })
      .select("id")
      .single();

    if (insErr || !inserted) {
      ctx.log.error("falha ao inserir pagamento", { insErr });
      return err(
        domainError("EXTERNAL", "Não foi possível registrar o pagamento.", {
          retriable: true,
          cause: insErr,
        }),
      );
    }

    await ctx.emit("workflow.payment_added", {
      sessionId,
      transactionId: inserted.id,
      valor: valorReais,
      formaPagamento,
      photographerId: userId,
    });

    return ok({ transactionId: inserted.id, sessionId, valor: valorReais });
  },
});
