/**
 * Queries `workflow.produto.*` — leitura de produtos e prazos.
 * Sem aprovação humana; segue RLS por `user_id`.
 */

import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { isOk, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";
import {
  resolveWorkflowUserId,
  loadSessionForProductWrite,
  findProdutoIndex,
  shapeProdutoOut,
} from "../_shared/produtoIO";
import {
  bucketProductsByDeadline,
  type DeadlineBucket,
} from "@/features/workflow/domain/productDeadlines";
import { etapaAtualIndex } from "@/features/workflow/domain/productFlow";

// -------- listBySession --------
export const produtoListBySession = defineQuery({
  id: "workflow.produto.listBySession",
  title: "Listar produtos da sessão",
  description: "Retorna produtos da sessão com etapa atual e status de entrega.",
  input: z.object({ sessionId: z.string().uuid() }),
  output: z.object({
    sessionId: z.string(),
    produtos: z.array(z.any()),
  }),
  permissions: ["workflow:read"],
  sideEffects: [],
  async handler({ sessionId }, ctx) {
    const auth = await resolveWorkflowUserId(ctx);
    if (!isOk(auth)) return auth;
    const loaded = await loadSessionForProductWrite(auth.value, sessionId);
    if (!isOk(loaded)) return loaded;
    return ok({
      sessionId,
      produtos: loaded.value.produtos.map(shapeProdutoOut),
    });
  },
});

// -------- getFlowTemplate --------
export const produtoGetFlowTemplate = defineQuery({
  id: "workflow.produto.getFlowTemplate",
  title: "Obter template de etapas do produto",
  description: "Retorna as etapas atuais do produto (nome, done, atual).",
  input: z.object({
    sessionId: z.string().uuid(),
    produtoId: z.string().min(1),
  }),
  output: z.object({
    fluxo: z.enum(["padrao", "custom"]),
    etapas: z.array(
      z.object({
        id: z.string(),
        nome: z.string(),
        done: z.boolean(),
        atual: z.boolean(),
      }),
    ),
  }),
  permissions: ["workflow:read"],
  sideEffects: [],
  async handler({ sessionId, produtoId }, ctx) {
    const auth = await resolveWorkflowUserId(ctx);
    if (!isOk(auth)) return auth;
    const loaded = await loadSessionForProductWrite(auth.value, sessionId);
    if (!isOk(loaded)) return loaded;
    const { produtos } = loaded.value;
    const idx = findProdutoIndex(produtos, sessionId, produtoId);
    if (idx === -1) {
      return { ok: false, error: { code: "NOT_FOUND", message: "Produto não encontrado." } } as any;
    }
    const p = produtos[idx];
    const etapas = p.etapas ?? [];
    const atualIdx = etapaAtualIndex(etapas);
    return ok({
      fluxo: (p.fluxo ?? "padrao") as "padrao" | "custom",
      etapas: etapas.map((e, i) => ({
        id: e.id, nome: e.nome, done: e.done, atual: i === atualIdx,
      })),
    });
  },
});

// -------- listPending --------
const BucketSchema = z.enum(["atrasado", "hoje", "amanha", "semana", "futuro"]);

export const produtoListPending = defineQuery({
  id: "workflow.produto.listPending",
  title: "Listar produtos com prazo pendente",
  description:
    "Agrupa produtos por prazo (atrasado/hoje/amanhã/semana/futuro). Aceita filtro opcional de janela e bucket.",
  input: z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    bucket: BucketSchema.optional(),
  }),
  output: z.object({
    items: z.array(
      z.object({
        sessionId: z.string(),
        sessionDate: z.string().nullable(),
        cliente: z.string(),
        produtoId: z.string(),
        produtoNome: z.string(),
        quantidade: z.number(),
        etapaAtualNome: z.string().nullable(),
        prazoEntrega: z.string(),
        bucket: BucketSchema,
        diasParaVencer: z.number(),
      }),
    ),
    counts: z.object({
      atrasado: z.number(), hoje: z.number(), amanha: z.number(),
      semana: z.number(), futuro: z.number(),
    }),
  }),
  permissions: ["workflow:read"],
  sideEffects: [],
  async handler({ from, to, bucket }, ctx) {
    const auth = await resolveWorkflowUserId(ctx);
    if (!isOk(auth)) return auth;
    const userId = auth.value;

    // Janela default: [hoje-30d, hoje+180d] para evitar scan da tabela inteira.
    const todayISO = new Date().toISOString().slice(0, 10);
    const defaultFrom = new Date(); defaultFrom.setDate(defaultFrom.getDate() - 30);
    const defaultTo = new Date(); defaultTo.setDate(defaultTo.getDate() + 180);
    const fromISO = from ?? defaultFrom.toISOString().slice(0, 10);
    const toISO = to ?? defaultTo.toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("clientes_sessoes")
      .select("id, data_sessao, produtos_incluidos, clientes(nome)")
      .eq("user_id", userId)
      .not("produtos_incluidos", "is", null)
      .gte("data_sessao", fromISO)
      .lte("data_sessao", toISO)
      .order("data_sessao", { ascending: true });
    if (error) {
      ctx.log.error("listPending: erro Supabase", { error });
      return ok({ items: [], counts: { atrasado: 0, hoje: 0, amanha: 0, semana: 0, futuro: 0 } });
    }

    const all = bucketProductsByDeadline(
      (data ?? []) as unknown as any[],
      todayISO,
    );
    const filtered = bucket ? all.filter((i) => i.bucket === bucket) : all;
    const counts = { atrasado: 0, hoje: 0, amanha: 0, semana: 0, futuro: 0 } as Record<DeadlineBucket, number>;
    for (const i of all) counts[i.bucket] += 1;
    return ok({ items: filtered, counts });
  },
});
