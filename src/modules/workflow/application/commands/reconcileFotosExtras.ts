import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { domainError, err, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";

/**
 * Capability `workflow.reconcileFotosExtras`
 *
 * Reconcilia o crédito de fotos extras de uma sessão com a auditoria da
 * galeria vinculada. Wrappa a RPC `reconcile_session_extras` (que faz toda
 * a lógica transacional no banco) e expõe a operação para a IA, mantendo
 * autorização, idempotência e auditoria padronizadas.
 *
 * Regras:
 *  - O dono autenticado precisa ser o `user_id` da sessão.
 *  - `destinoSobra` controla o que fazer com a diferença detectada:
 *      `adicional`         → vira valor adicional na sessão
 *      `desconto_negativo` → vira desconto (valor negativo)
 *      `manter_credito`    → não altera financeiro, apenas qtd
 *  - Idempotência por (sessionId, qtd, valor, destino) durante 5min.
 */

const DestinoSobra = z.enum(["adicional", "desconto_negativo", "manter_credito"]);

const Input = z.object({
  sessionId: z.string().uuid(),
  qtdExtras: z.number().int().min(0),
  valorUnitario: z.number().nonnegative(),
  destinoSobra: DestinoSobra,
  valorSobra: z.number(),
});

const Output = z.object({
  sessionId: z.string(),
  qtdExtras: z.number(),
  valorUnitario: z.number(),
  destinoSobra: DestinoSobra,
});

export const reconcileFotosExtras = defineCommand({
  id: "workflow.reconcileFotosExtras",
  title: "Reconciliar fotos extras",
  description:
    "Sincroniza qtd_fotos_extra/valor_foto_extra da sessão com a auditoria da galeria (via RPC reconcile_session_extras).",
  input: Input,
  output: Output,
  permissions: ["workflow:write", "financeiro:write"],
  sideEffects: [
    "db:clientes_sessoes(rpc)",
    "db:clientes_transacoes(trigger)",
    "event:workflow.card_updated",
  ],
  audit: "always",
  idempotencyKey: (i) =>
    `workflow.reconcileFotosExtras:${i.sessionId}:${i.qtdExtras}:${i.valorUnitario}:${i.destinoSobra}`,
  examples: [
    {
      nl: "Reconciliar a sessão com 3 extras a R$25 e jogar a sobra como desconto negativo",
      input: {
        sessionId: "00000000-0000-0000-0000-000000000000",
        qtdExtras: 3,
        valorUnitario: 25,
        destinoSobra: "desconto_negativo",
        valorSobra: 10,
      },
    },
  ],
  async handler(input, ctx) {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? ctx.user?.id;
    if (!userId) {
      return err(domainError("UNAUTHENTICATED", "Sessão expirada."));
    }

    const { data: sessionRow, error: readErr } = await supabase
      .from("clientes_sessoes")
      .select("id, user_id")
      .eq("id", input.sessionId)
      .maybeSingle();

    if (readErr) {
      ctx.log.error("falha ao ler sessão p/ reconcile", { readErr });
      return err(
        domainError("EXTERNAL", "Não foi possível ler a sessão.", {
          retriable: true,
          cause: readErr,
        }),
      );
    }
    if (!sessionRow) {
      return err(
        domainError("NOT_FOUND", "Sessão não encontrada.", {
          details: { sessionId: input.sessionId },
        }),
      );
    }
    if (sessionRow.user_id !== userId) {
      return err(domainError("FORBIDDEN", "Sem acesso a esta sessão."));
    }

    const { error: rpcErr } = await supabase.rpc("reconcile_session_extras", {
      p_session_id: input.sessionId,
      p_qtd_extras: input.qtdExtras,
      p_valor_unitario: input.valorUnitario,
      p_destino_sobra: input.destinoSobra,
      p_valor_sobra: input.valorSobra,
    });

    if (rpcErr) {
      ctx.log.error("RPC reconcile_session_extras falhou", { rpcErr });
      return err(
        domainError("EXTERNAL", rpcErr.message ?? "Falha ao reconciliar fotos extras.", {
          retriable: true,
          cause: rpcErr,
        }),
      );
    }

    await ctx.emit("workflow.card_updated", {
      sessionId: input.sessionId,
      changedKeys: [
        "qtd_fotos_extra",
        "valor_foto_extra",
        "valor_total_foto_extra",
        input.destinoSobra === "adicional" ? "valor_adicional" : "desconto",
      ],
      photographerId: userId,
    });

    return ok({
      sessionId: input.sessionId,
      qtdExtras: input.qtdExtras,
      valorUnitario: input.valorUnitario,
      destinoSobra: input.destinoSobra,
    });
  },
});
