import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { domainError, err, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";

/**
 * Capability `workflow.createQuickSession`
 *
 * Cria uma sessão "rápida" diretamente em `clientes_sessoes` (tipo_registro
 * = 'workflow'). Substitui a inserção embutida em `QuickSessionAdd.tsx` para
 * que IA, mobile e automações possam criar sessões pelo mesmo contrato
 * auditável.
 *
 * Esta capability é deliberadamente mínima — não congela regras de pacote
 * nem manipula `regras_congeladas`. A UI rica continua usando o componente
 * legado quando o usuário escolhe um pacote com regras complexas. Para os
 * casos "rápidos" (cliente + data + hora + categoria + valor base), este é
 * o caminho oficial.
 *
 * Idempotência por (clienteId, dataSessao, horaSessao) durante 10min evita
 * dupla criação quando a IA repete o comando.
 */

const Input = z.object({
  clienteId: z.string().uuid(),
  dataSessao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  horaSessao: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM"),
  categoria: z.string().min(1).max(80),
  pacote: z.string().max(120).optional(),
  valorBase: z.number().nonnegative().optional(),
  descricao: z.string().max(500).optional(),
  status: z.string().min(1).max(60).default("agendado"),
});

const Output = z.object({
  sessionId: z.string(),
  sessionRowId: z.string(),
});

function makeSessionTextId(dataSessao: string, horaSessao: string): string {
  // Padrão histórico já utilizado pelo Workflow: AAAAMMDD-HHMM-rand4
  const compactDate = dataSessao.replace(/-/g, "");
  const compactTime = horaSessao.replace(":", "");
  const rand = Math.random().toString(36).slice(2, 6);
  return `${compactDate}-${compactTime}-${rand}`;
}

export const createQuickSession = defineCommand({
  id: "workflow.createQuickSession",
  title: "Criar sessão rápida",
  description:
    "Cria uma sessão simples no funil do Workflow (cliente + data/hora + categoria).",
  input: Input,
  output: Output,
  permissions: ["workflow:write"],
  sideEffects: ["db:clientes_sessoes", "event:workflow.card_updated"],
  audit: "always",
  idempotencyKey: (i) =>
    `workflow.createQuickSession:${i.clienteId}:${i.dataSessao}:${i.horaSessao}`,
  examples: [
    {
      nl: "Criar sessão para o cliente X amanhã às 10h, categoria Família",
      input: {
        clienteId: "00000000-0000-0000-0000-000000000000",
        dataSessao: "2026-06-27",
        horaSessao: "10:00",
        categoria: "Família",
      },
    },
  ],
  async handler(input, ctx) {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? ctx.user?.id;
    if (!userId) {
      return err(domainError("UNAUTHENTICATED", "Sessão expirada."));
    }

    // Garante que o cliente pertence ao fotógrafo (RLS faria também, mas
    // queremos NOT_FOUND/FORBIDDEN explícitos para a IA).
    const { data: cliente, error: cliErr } = await supabase
      .from("clientes")
      .select("id, user_id")
      .eq("id", input.clienteId)
      .maybeSingle();

    if (cliErr) {
      ctx.log.error("falha ao ler cliente", { cliErr });
      return err(
        domainError("EXTERNAL", "Não foi possível validar o cliente.", {
          retriable: true,
          cause: cliErr,
        }),
      );
    }
    if (!cliente) {
      return err(domainError("NOT_FOUND", "Cliente não encontrado."));
    }
    if (cliente.user_id !== userId) {
      return err(domainError("FORBIDDEN", "Sem acesso a este cliente."));
    }

    const sessionTextId = makeSessionTextId(input.dataSessao, input.horaSessao);
    const valorBase = input.valorBase ?? 0;

    const { data: inserted, error: insErr } = await supabase
      .from("clientes_sessoes")
      .insert({
        user_id: userId,
        cliente_id: input.clienteId,
        session_id: sessionTextId,
        data_sessao: input.dataSessao,
        hora_sessao: input.horaSessao,
        categoria: input.categoria,
        pacote: input.pacote ?? null,
        descricao: input.descricao ?? null,
        status: input.status,
        valor_base_pacote: valorBase,
        valor_total: valorBase,
        tipo_registro: "workflow",
        updated_by: userId,
      })
      .select("id, session_id")
      .single();

    if (insErr || !inserted) {
      ctx.log.error("falha ao inserir sessão rápida", { insErr });
      return err(
        domainError("EXTERNAL", "Não foi possível criar a sessão.", {
          retriable: true,
          cause: insErr,
        }),
      );
    }

    await ctx.emit("workflow.card_updated", {
      sessionId: inserted.id,
      changedKeys: ["__created__"],
      photographerId: userId,
    });

    return ok({
      sessionId: inserted.session_id,
      sessionRowId: inserted.id,
    });
  },
});
