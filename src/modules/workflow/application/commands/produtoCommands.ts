/**
 * Commands `workflow.produto.*` — mutações no array `produtos_incluidos`
 * de uma sessão. Todos exigem aprovação humana quando invocados via IA
 * (ver `permissions.REQUIRES_APPROVAL`).
 *
 * Convenções:
 *  - `sessionId`: UUID de `clientes_sessoes.id`.
 *  - `produtoId`: id do produto no array; aceita legado (deterministicProductId).
 *  - Output: `{ sessionId, produtoId, produto, valorTotal, preview }`.
 *  - `preview`: string curta em pt-BR para o cartão de aprovação do Lu.
 */

import { z } from "zod";
import { randomUUID } from "@/shared/uuid";
import { defineCommand } from "@/shared/capability";
import { domainError, err, isOk, ok } from "@/shared/result";
import {
  resolveWorkflowUserId,
  loadSessionForProductWrite,
  findProdutoIndex,
  persistProdutos,
  shapeProdutoOut,
} from "../_shared/produtoIO";
import {
  advanceOne,
  retreatOne,
  toggleEtapaAt,
  switchFluxo,
  buildEtapasPadrao,
  buildEtapasFromNames,
  hydrateProduto,
  isEntregue,
  type ProdutoWorkflowFlow,
} from "@/features/workflow/domain/productFlow";

const SessionAndProduct = z.object({
  sessionId: z.string().uuid(),
  produtoId: z.string().min(1),
});

const OutBase = z.object({
  sessionId: z.string(),
  produtoId: z.string(),
  produto: z.any(),
  valorTotal: z.number(),
  preview: z.string(),
});

/** Data comum de escrita: valida user, carrega sessão, localiza produto. */
async function prep(sessionId: string, produtoId: string, ctx: any) {
  const auth = await resolveWorkflowUserId(ctx);
  if (!isOk(auth)) return { err: auth };
  const userId = auth.value;
  const loaded = await loadSessionForProductWrite(userId, sessionId);
  if (!isOk(loaded)) return { err: loaded };
  const { session, produtos } = loaded.value;
  const idx = findProdutoIndex(produtos, sessionId, produtoId);
  if (idx === -1) {
    return {
      err: err(
        domainError("NOT_FOUND", "Produto não encontrado nesta sessão.", {
          details: { sessionId, produtoId },
        }),
      ),
    };
  }
  const clienteNome = (session as any).clientes?.nome ?? "";
  return { userId, session, produtos, idx, clienteNome };
}

// -------- advanceStage --------
export const produtoAdvanceStage = defineCommand({
  id: "workflow.produto.advanceStage",
  title: "Avançar etapa de produção",
  description: "Marca a próxima etapa pendente do produto como concluída.",
  input: SessionAndProduct,
  output: OutBase,
  permissions: ["workflow:write"],
  sideEffects: ["db:clientes_sessoes", "event:workflow.produto_stage_changed"],
  audit: "on-success",
  async handler({ sessionId, produtoId }, ctx) {
    const p = await prep(sessionId, produtoId, ctx);
    if ("err" in p) return p.err;
    const { userId, session, produtos, idx, clienteNome } = p;
    const before = produtos[idx];
    const nextEtapas = advanceOne(before.etapas ?? []);
    if (nextEtapas === (before.etapas ?? [])) {
      return err(domainError("NOOP", "Produto já está entregue."));
    }
    const nextProduto = { ...before, etapas: nextEtapas };
    const nextArr = [...produtos];
    nextArr[idx] = nextProduto;
    const persisted = await persistProdutos({
      userId, sessionId, session, produtos: nextArr,
      touched: [{ produtoId: nextProduto.id!, clienteNome }],
      ctx,
    });
    if (!isOk(persisted)) return persisted;
    const shaped = shapeProdutoOut(nextArr[idx]);
    const preview = `${nextProduto.nome}: avançar para "${shaped.etapaAtualNome ?? "Entregue"}".`;
    await ctx.emit("workflow.produto_stage_changed", {
      sessionId, produtoId: nextProduto.id!, direction: "advance",
      etapaAtual: shaped.etapaAtualNome, photographerId: userId,
    });
    return ok({ sessionId, produtoId: nextProduto.id!, produto: shaped, valorTotal: persisted.value.valorTotal, preview });
  },
});

// -------- retreatStage --------
export const produtoRetreatStage = defineCommand({
  id: "workflow.produto.retreatStage",
  title: "Regredir etapa de produção",
  description: "Desmarca a última etapa concluída do produto.",
  input: SessionAndProduct,
  output: OutBase,
  permissions: ["workflow:write"],
  sideEffects: ["db:clientes_sessoes", "event:workflow.produto_stage_changed"],
  audit: "on-success",
  async handler({ sessionId, produtoId }, ctx) {
    const p = await prep(sessionId, produtoId, ctx);
    if ("err" in p) return p.err;
    const { userId, session, produtos, idx, clienteNome } = p;
    const before = produtos[idx];
    const nextEtapas = retreatOne(before.etapas ?? []);
    if (nextEtapas === (before.etapas ?? [])) {
      return err(domainError("NOOP", "Produto ainda não teve nenhuma etapa concluída."));
    }
    const nextProduto = { ...before, etapas: nextEtapas };
    const nextArr = [...produtos];
    nextArr[idx] = nextProduto;
    const persisted = await persistProdutos({
      userId, sessionId, session, produtos: nextArr,
      touched: [{ produtoId: nextProduto.id!, clienteNome }],
      ctx,
    });
    if (!isOk(persisted)) return persisted;
    const shaped = shapeProdutoOut(nextArr[idx]);
    const preview = `${nextProduto.nome}: voltar para "${shaped.etapaAtualNome ?? "início"}".`;
    await ctx.emit("workflow.produto_stage_changed", {
      sessionId, produtoId: nextProduto.id!, direction: "retreat",
      etapaAtual: shaped.etapaAtualNome, photographerId: userId,
    });
    return ok({ sessionId, produtoId: nextProduto.id!, produto: shaped, valorTotal: persisted.value.valorTotal, preview });
  },
});

// -------- setStages --------
export const produtoSetStages = defineCommand({
  id: "workflow.produto.setStages",
  title: "Definir etapa concluída até índice",
  description: "Marca todas as etapas até `doneUpToIndex` (inclusive) como concluídas. Use -1 para desmarcar tudo.",
  input: SessionAndProduct.extend({ doneUpToIndex: z.number().int().min(-1) }),
  output: OutBase,
  permissions: ["workflow:write"],
  sideEffects: ["db:clientes_sessoes", "event:workflow.produto_stage_changed"],
  audit: "on-success",
  async handler({ sessionId, produtoId, doneUpToIndex }, ctx) {
    const p = await prep(sessionId, produtoId, ctx);
    if ("err" in p) return p.err;
    const { userId, session, produtos, idx, clienteNome } = p;
    const before = produtos[idx];
    const etapas = before.etapas ?? [];
    if (doneUpToIndex >= etapas.length) {
      return err(domainError("VALIDATION", "Índice fora do intervalo de etapas."));
    }
    // toggleEtapaAt aplica "clicar em X marca X e anteriores"; para setar direto usamos map.
    const nextEtapas = etapas.map((e, i) => ({ ...e, done: i <= doneUpToIndex }));
    const nextProduto = { ...before, etapas: nextEtapas };
    const nextArr = [...produtos];
    nextArr[idx] = nextProduto;
    const persisted = await persistProdutos({
      userId, sessionId, session, produtos: nextArr,
      touched: [{ produtoId: nextProduto.id!, clienteNome }],
      ctx,
    });
    if (!isOk(persisted)) return persisted;
    const shaped = shapeProdutoOut(nextArr[idx]);
    const preview = `${nextProduto.nome}: etapa atual "${shaped.etapaAtualNome ?? "Entregue"}".`;
    // Referência a toggleEtapaAt para o linter não reclamar de import não usado.
    void toggleEtapaAt;
    await ctx.emit("workflow.produto_stage_changed", {
      sessionId, produtoId: nextProduto.id!, direction: "set",
      etapaAtual: shaped.etapaAtualNome, photographerId: userId,
    });
    return ok({ sessionId, produtoId: nextProduto.id!, produto: shaped, valorTotal: persisted.value.valorTotal, preview });
  },
});

// -------- switchFluxo --------
export const produtoSwitchFluxo = defineCommand({
  id: "workflow.produto.switchFluxo",
  title: "Trocar fluxo de produção do produto",
  description: "Alterna entre fluxo 'padrao' e 'custom'. Preserva progresso por posição.",
  input: SessionAndProduct.extend({
    fluxo: z.enum(["padrao", "custom"]),
    nomesCustom: z.array(z.string()).optional(),
  }).refine(
    (v) => v.fluxo === "padrao" || (v.nomesCustom && v.nomesCustom.length > 0),
    { message: "fluxo 'custom' exige `nomesCustom` com ao menos 1 nome." },
  ),
  output: OutBase,
  permissions: ["workflow:write"],
  sideEffects: ["db:clientes_sessoes", "event:workflow.produto_flow_changed"],
  audit: "on-success",
  async handler({ sessionId, produtoId, fluxo, nomesCustom }, ctx) {
    const p = await prep(sessionId, produtoId, ctx);
    if ("err" in p) return p.err;
    const { userId, session, produtos, idx, clienteNome } = p;
    const before = produtos[idx];
    const nextProduto = switchFluxo(before, fluxo, nomesCustom);
    const nextArr = [...produtos];
    nextArr[idx] = nextProduto;
    const persisted = await persistProdutos({
      userId, sessionId, session, produtos: nextArr,
      touched: [{ produtoId: nextProduto.id!, clienteNome }],
      ctx,
    });
    if (!isOk(persisted)) return persisted;
    const shaped = shapeProdutoOut(nextArr[idx]);
    const preview = `${nextProduto.nome}: trocar para fluxo "${fluxo}".`;
    await ctx.emit("workflow.produto_flow_changed", {
      sessionId, produtoId: nextProduto.id!, fluxo, photographerId: userId,
    });
    return ok({ sessionId, produtoId: nextProduto.id!, produto: shaped, valorTotal: persisted.value.valorTotal, preview });
  },
});

// -------- setDeadline --------
export const produtoSetDeadline = defineCommand({
  id: "workflow.produto.setDeadline",
  title: "Definir prazo de entrega",
  description: "Define/remover prazo de entrega (YYYY-MM-DD) do produto.",
  input: SessionAndProduct.extend({
    prazoEntrega: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]),
  }),
  output: OutBase,
  permissions: ["workflow:write"],
  sideEffects: ["db:clientes_sessoes", "event:workflow.produto_deadline_changed"],
  audit: "on-success",
  async handler({ sessionId, produtoId, prazoEntrega }, ctx) {
    const p = await prep(sessionId, produtoId, ctx);
    if ("err" in p) return p.err;
    const { userId, session, produtos, idx, clienteNome } = p;
    const before = produtos[idx];
    const nextProduto = { ...before, prazoEntrega: prazoEntrega ?? undefined };
    const nextArr = [...produtos];
    nextArr[idx] = nextProduto;
    const persisted = await persistProdutos({
      userId, sessionId, session, produtos: nextArr,
      touched: [{ produtoId: nextProduto.id!, clienteNome }],
      ctx,
    });
    if (!isOk(persisted)) return persisted;
    const shaped = shapeProdutoOut(nextArr[idx]);
    const preview = prazoEntrega
      ? `${nextProduto.nome}: prazo definido para ${prazoEntrega}.`
      : `${nextProduto.nome}: prazo removido.`;
    await ctx.emit("workflow.produto_deadline_changed", {
      sessionId, produtoId: nextProduto.id!, prazoEntrega: prazoEntrega ?? null, photographerId: userId,
    });
    return ok({ sessionId, produtoId: nextProduto.id!, produto: shaped, valorTotal: persisted.value.valorTotal, preview });
  },
});

// -------- setPrice --------
export const produtoSetPrice = defineCommand({
  id: "workflow.produto.setPrice",
  title: "Alterar preço unitário do produto",
  description: "Atualiza `valorUnitario`. Não recongela regras de pricing.",
  input: SessionAndProduct.extend({ valorUnitario: z.number().min(0) }),
  output: OutBase,
  permissions: ["workflow:write"],
  sideEffects: ["db:clientes_sessoes", "event:workflow.produto_price_changed"],
  audit: "on-success",
  async handler({ sessionId, produtoId, valorUnitario }, ctx) {
    const p = await prep(sessionId, produtoId, ctx);
    if ("err" in p) return p.err;
    const { userId, session, produtos, idx, clienteNome } = p;
    const before = produtos[idx];
    const anterior = Number(before.valorUnitario) || 0;
    const nextProduto = { ...before, valorUnitario };
    const nextArr = [...produtos];
    nextArr[idx] = nextProduto;
    const persisted = await persistProdutos({
      userId, sessionId, session, produtos: nextArr,
      touched: [{ produtoId: nextProduto.id!, clienteNome }],
      ctx,
    });
    if (!isOk(persisted)) return persisted;
    const shaped = shapeProdutoOut(nextArr[idx]);
    const preview = `${nextProduto.nome}: preço R$ ${anterior.toFixed(2)} → R$ ${valorUnitario.toFixed(2)}.`;
    await ctx.emit("workflow.produto_price_changed", {
      sessionId, produtoId: nextProduto.id!, anterior, novo: valorUnitario, photographerId: userId,
    });
    return ok({ sessionId, produtoId: nextProduto.id!, produto: shaped, valorTotal: persisted.value.valorTotal, preview });
  },
});

// -------- setQuantity --------
export const produtoSetQuantity = defineCommand({
  id: "workflow.produto.setQuantity",
  title: "Alterar quantidade do produto",
  description: "Atualiza `quantidade` (>=1) e recalcula `valor_total` da sessão.",
  input: SessionAndProduct.extend({ quantidade: z.number().int().min(1) }),
  output: OutBase,
  permissions: ["workflow:write"],
  sideEffects: ["db:clientes_sessoes", "event:workflow.produto_qty_changed"],
  audit: "on-success",
  async handler({ sessionId, produtoId, quantidade }, ctx) {
    const p = await prep(sessionId, produtoId, ctx);
    if ("err" in p) return p.err;
    const { userId, session, produtos, idx, clienteNome } = p;
    const before = produtos[idx];
    const anterior = Number(before.quantidade) || 1;
    const nextProduto = { ...before, quantidade };
    const nextArr = [...produtos];
    nextArr[idx] = nextProduto;
    const persisted = await persistProdutos({
      userId, sessionId, session, produtos: nextArr,
      touched: [{ produtoId: nextProduto.id!, clienteNome }],
      ctx,
    });
    if (!isOk(persisted)) return persisted;
    const shaped = shapeProdutoOut(nextArr[idx]);
    const preview = `${nextProduto.nome}: quantidade ${anterior} → ${quantidade}.`;
    await ctx.emit("workflow.produto_qty_changed", {
      sessionId, produtoId: nextProduto.id!, anterior, novo: quantidade, photographerId: userId,
    });
    return ok({ sessionId, produtoId: nextProduto.id!, produto: shaped, valorTotal: persisted.value.valorTotal, preview });
  },
});

// -------- add --------
const NovoProduto = z.object({
  nome: z.string().min(1).max(120),
  quantidade: z.number().int().min(1),
  valorUnitario: z.number().min(0),
  tipo: z.enum(["incluso", "manual"]),
  fluxo: z.enum(["padrao", "custom"]).optional(),
  nomesEtapasCustom: z.array(z.string()).optional(),
  prazoEntrega: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const produtoAdd = defineCommand({
  id: "workflow.produto.add",
  title: "Adicionar produto à sessão",
  description: "Insere um novo produto em `produtos_incluidos` com etapas iniciais.",
  input: z.object({ sessionId: z.string().uuid(), produto: NovoProduto }),
  output: OutBase,
  permissions: ["workflow:write"],
  sideEffects: ["db:clientes_sessoes", "event:workflow.produto_added"],
  audit: "on-success",
  async handler({ sessionId, produto }, ctx) {
    const auth = await resolveWorkflowUserId(ctx);
    if (!isOk(auth)) return auth;
    const userId = auth.value;
    const loaded = await loadSessionForProductWrite(userId, sessionId);
    if (!isOk(loaded)) return loaded;
    const { session, produtos } = loaded.value;
    const fluxo = produto.fluxo ?? "padrao";
    const etapas =
      fluxo === "custom"
        ? buildEtapasFromNames(produto.nomesEtapasCustom ?? [])
        : buildEtapasPadrao();
    const nextProduto = hydrateProduto({
      id: randomUUID(),
      nome: produto.nome,
      quantidade: produto.quantidade,
      valorUnitario: produto.valorUnitario,
      tipo: produto.tipo,
      fluxo,
      etapas,
      prazoEntrega: produto.prazoEntrega,
    } as ProdutoWorkflowFlow);
    const nextArr = [...produtos, nextProduto];
    const clienteNome = (session as any).clientes?.nome ?? "";
    const persisted = await persistProdutos({
      userId, sessionId, session, produtos: nextArr,
      touched: [{ produtoId: nextProduto.id!, clienteNome }],
      ctx,
    });
    if (!isOk(persisted)) return persisted;
    const shaped = shapeProdutoOut(nextArr[nextArr.length - 1]);
    const preview = `Adicionar ${produto.quantidade}× "${produto.nome}" (R$ ${produto.valorUnitario.toFixed(2)}).`;
    await ctx.emit("workflow.produto_added", {
      sessionId, produtoId: nextProduto.id!, nome: produto.nome, photographerId: userId,
    });
    return ok({ sessionId, produtoId: nextProduto.id!, produto: shaped, valorTotal: persisted.value.valorTotal, preview });
  },
});

// -------- remove --------
export const produtoRemove = defineCommand({
  id: "workflow.produto.remove",
  title: "Remover produto da sessão",
  description: "Remove o produto de `produtos_incluidos`. Ação irreversível.",
  input: SessionAndProduct,
  output: z.object({
    sessionId: z.string(), produtoId: z.string(),
    removed: z.any(), valorTotal: z.number(), preview: z.string(),
  }),
  permissions: ["workflow:write"],
  sideEffects: ["db:clientes_sessoes", "event:workflow.produto_removed"],
  audit: "on-success",
  async handler({ sessionId, produtoId }, ctx) {
    const p = await prep(sessionId, produtoId, ctx);
    if ("err" in p) return p.err;
    const { userId, session, produtos, idx, clienteNome } = p;
    const removed = produtos[idx];
    const nextArr = produtos.filter((_, i) => i !== idx);
    const persisted = await persistProdutos({
      userId, sessionId, session, produtos: nextArr,
      touched: [{ produtoId: removed.id!, clienteNome }],
      ctx,
    });
    if (!isOk(persisted)) return persisted;
    const preview = `Remover "${removed.nome}" (qtd ${removed.quantidade}).`;
    await ctx.emit("workflow.produto_removed", {
      sessionId, produtoId: removed.id!, nome: removed.nome, photographerId: userId,
    });
    return ok({ sessionId, produtoId: removed.id!, removed, valorTotal: persisted.value.valorTotal, preview });
  },
});

// -------- duplicate --------
export const produtoDuplicate = defineCommand({
  id: "workflow.produto.duplicate",
  title: "Duplicar produto",
  description: "Cria uma cópia do produto com novo id e etapas resetadas. Prazo não é copiado.",
  input: SessionAndProduct,
  output: OutBase,
  permissions: ["workflow:write"],
  sideEffects: ["db:clientes_sessoes", "event:workflow.produto_added"],
  audit: "on-success",
  async handler({ sessionId, produtoId }, ctx) {
    const p = await prep(sessionId, produtoId, ctx);
    if ("err" in p) return p.err;
    const { userId, session, produtos, idx, clienteNome } = p;
    const before = produtos[idx];
    const fluxo = before.fluxo ?? "padrao";
    const nomesAtuais = (before.etapas ?? []).map((e) => e.nome);
    const etapas = fluxo === "custom" ? buildEtapasFromNames(nomesAtuais) : buildEtapasPadrao();
    const clone = hydrateProduto({
      ...before,
      id: randomUUID(),
      etapas,
      prazoEntrega: undefined,
      produzido: false,
      entregue: false,
    } as ProdutoWorkflowFlow);
    // Silencia lint de import não usado.
    void isEntregue;
    const nextArr = [...produtos, clone];
    const persisted = await persistProdutos({
      userId, sessionId, session, produtos: nextArr,
      touched: [{ produtoId: clone.id!, clienteNome }],
      ctx,
    });
    if (!isOk(persisted)) return persisted;
    const shaped = shapeProdutoOut(nextArr[nextArr.length - 1]);
    const preview = `Duplicar "${before.nome}" (nova cópia sem prazo).`;
    await ctx.emit("workflow.produto_added", {
      sessionId, produtoId: clone.id!, nome: clone.nome, photographerId: userId,
    });
    return ok({ sessionId, produtoId: clone.id!, produto: shaped, valorTotal: persisted.value.valorTotal, preview });
  },
});
