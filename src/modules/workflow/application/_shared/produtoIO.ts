/**
 * Helpers compartilhados dos commands `workflow.produto.*`.
 *
 * - Autentica e resolve `userId` (fallback ctx.user).
 * - Carrega a sessão, hidrata `produtos_incluidos`.
 * - Localiza produto por `id`/`produtoId`/`deterministicProductId`.
 * - Persiste `produtos_incluidos` inteiro após `syncLegacyFlags`, recalculando
 *   `valor_total` quando aplicável (espelha trigger DB).
 * - Registra na `mirrorMemoStore` para evitar eco Produto→Tarefa.
 */

import { supabase } from "@/integrations/supabase/client";
import { sessionsRepo } from "@/features/workflow/data";
import { recalcSessionValorTotal } from "@/features/workflow/domain/pricing";
import { mirrorMemoStore } from "@/features/workflow/realtime/mirrorMemoStore";
import {
  hydrateProduto,
  syncLegacyFlags,
  etapasHash,
  deterministicProductId,
  type ProdutoWorkflowFlow,
} from "@/features/workflow/domain/productFlow";
import {
  buildTitle,
  isEntregue as _entregueDup, // eslint-disable-line @typescript-eslint/no-unused-vars
} from "@/features/workflow/domain/productTaskMirror";
import { isEntregue, etapaAtualIndex } from "@/features/workflow/domain/productFlow";
import { domainError, err, ok, type DomainError, type Result } from "@/shared/result";
import type { CapabilityContext } from "@/shared/capability";

export async function resolveWorkflowUserId(
  ctx: CapabilityContext,
): Promise<Result<string, DomainError>> {
  const ctxId = ctx.user?.id;
  if (ctxId) return ok(ctxId);
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) return err(domainError("UNAUTHENTICATED", "Sessão expirada."));
  return ok(id);
}

export interface LoadedForWrite {
  session: any;
  produtos: ProdutoWorkflowFlow[];
}

export async function loadSessionForProductWrite(
  userId: string,
  sessionId: string,
): Promise<Result<LoadedForWrite, DomainError>> {
  const session = await sessionsRepo.getById(userId, sessionId);
  if (!session) {
    return err(
      domainError("NOT_FOUND", "Sessão não encontrada.", { details: { sessionId } }),
    );
  }
  const raw = ((session as any).produtos_incluidos as any[]) || [];
  const produtos = raw.map((p) => hydrateProduto(p as ProdutoWorkflowFlow));
  return ok({ session, produtos });
}

/**
 * Localiza o índice de um produto no array. Tenta:
 *   1. `id` explícito
 *   2. `produtoId`
 *   3. `deterministicProductId(sessionId, nome, idx)` — fallback para produtos legados
 */
export function findProdutoIndex(
  produtos: ProdutoWorkflowFlow[],
  sessionId: string,
  produtoId: string,
): number {
  if (!produtoId) return -1;
  const byId = produtos.findIndex((p) => p?.id === produtoId);
  if (byId !== -1) return byId;
  const byProdutoId = produtos.findIndex((p) => p?.produtoId === produtoId);
  if (byProdutoId !== -1) return byProdutoId;
  return produtos.findIndex(
    (p, idx) => deterministicProductId(sessionId, p?.nome || "produto", idx) === produtoId,
  );
}

/** Garante um id estável no produto (usa deterministic quando ausente). */
export function ensureProdutoId(
  p: ProdutoWorkflowFlow,
  sessionId: string,
  idx: number,
): ProdutoWorkflowFlow {
  if (p.id) return p;
  return { ...p, id: deterministicProductId(sessionId, p.nome || "produto", idx) };
}

/**
 * Persiste o array completo de produtos na sessão.
 * Espelha o trigger DB: recalcula `valor_total` quando os produtos afetam total.
 * Marca `mirrorMemoStore` para cada produto tocado (evita eco Produto→Tarefa).
 */
export async function persistProdutos(params: {
  userId: string;
  sessionId: string;
  session: any;
  produtos: ProdutoWorkflowFlow[];
  touched: Array<{ produtoId: string; clienteNome: string }>;
  ctx: CapabilityContext;
}): Promise<Result<{ valorTotal: number }, DomainError>> {
  const { userId, sessionId, session, produtos, touched, ctx } = params;

  const normalized = produtos.map((p, idx) => syncLegacyFlags(ensureProdutoId(p, sessionId, idx)));

  // Recalcula valor_total espelhando `recalc_session_valor_total` (soma manuais).
  const valorTotal = recalcSessionValorTotal({
    valorBasePacote: Number(session.valor_base_pacote) || 0,
    valorTotalFotoExtra: Number(session.valor_total_foto_extra) || 0,
    produtosIncluidos: normalized as any,
    valorAdicional: Number(session.valor_adicional) || 0,
    desconto: Number(session.desconto) || 0,
  });

  // Anti-eco Produto → Tarefa: registra hash antes do persist para o
  // reconciliador do dock não sobrescrever a intenção durante a janela.
  for (const t of touched) {
    const idx = normalized.findIndex((p) => p.id === t.produtoId);
    if (idx === -1) continue;
    const p = normalized[idx];
    const etapas = p.etapas ?? [];
    const entregue = isEntregue(etapas);
    const atual = etapas[etapaAtualIndex(etapas)]?.nome ?? null;
    const expectedTitle = buildTitle({
      produtoNome: p.nome,
      quantidade: Number(p.quantidade) || 1,
      clienteNome: t.clienteNome,
      etapaAtualNome: atual,
      isEntregue: entregue,
    });
    mirrorMemoStore.memorize(sessionId, t.produtoId, etapasHash(etapas), expectedTitle);
  }

  try {
    await sessionsRepo.update(userId, sessionId, {
      produtos_incluidos: normalized as any,
      valor_total: valorTotal,
    } as any);
  } catch (cause) {
    ctx.log.error("persistProdutos: falha ao atualizar sessão", { cause });
    return err(
      domainError("EXTERNAL", "Não foi possível atualizar os produtos.", {
        retriable: true,
        cause,
      }),
    );
  }

  return ok({ valorTotal });
}

/** Enriquecimento comum devolvido nos outputs. */
export function shapeProdutoOut(p: ProdutoWorkflowFlow) {
  const etapas = p.etapas ?? [];
  const idx = etapaAtualIndex(etapas);
  return {
    ...p,
    etapaAtualIndex: idx,
    etapaAtualNome: etapas[idx]?.nome ?? null,
    entregue: isEntregue(etapas),
  };
}
