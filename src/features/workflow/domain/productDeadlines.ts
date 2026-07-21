/**
 * Domínio puro: agrupamento de produtos por prazo de entrega.
 *
 * Extraído de `useProductDeadlineNotifications` para ser compartilhado entre:
 *  - hook de notificações (mesma saída, só remapeia para `AppNotification`)
 *  - capability `workflow.produto.listPending` (superfície de IA)
 *
 * Zero React, zero Supabase — só datas e arrays.
 */

import type { WorkflowSession } from "./session";
import {
  hydrateProduto,
  isEntregue,
  etapaAtualIndex,
  deterministicProductId,
} from "./productFlow";

export type DeadlineBucket = "atrasado" | "hoje" | "amanha" | "semana" | "futuro";

export interface DeadlineItem {
  sessionId: string;
  sessionDate: string | null;
  cliente: string;
  produtoId: string;
  produtoNome: string;
  quantidade: number;
  etapaAtualNome: string | null;
  prazoEntrega: string; // YYYY-MM-DD
  bucket: DeadlineBucket;
  diasParaVencer: number; // negativo = atrasado
}

const startOfLocalDay = (d: Date) => {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
};

export function parseISODateLocal(iso: string): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function classifyDeadline(diasParaVencer: number): DeadlineBucket | null {
  if (diasParaVencer < 0) return "atrasado";
  if (diasParaVencer === 0) return "hoje";
  if (diasParaVencer === 1) return "amanha";
  if (diasParaVencer <= 7) return "semana";
  if (diasParaVencer <= 180) return "futuro";
  return null;
}

/**
 * Agrupa produtos com `prazoEntrega` por bucket temporal em relação a `todayISO`.
 * Produtos já entregues ou sem prazo são ignorados.
 */
export function bucketProductsByDeadline(
  sessions: Array<Partial<WorkflowSession>>,
  todayISO?: string,
): DeadlineItem[] {
  const todayBase = todayISO ? parseISODateLocal(todayISO) ?? new Date() : new Date();
  const today = startOfLocalDay(todayBase);
  const out: DeadlineItem[] = [];

  for (const session of sessions) {
    const produtos = ((session as any).produtos_incluidos as any[]) || [];
    if (produtos.length === 0) continue;
    const clienteNome = (session as any).clientes?.nome || "Cliente";
    const sessionId = String((session as any).id ?? "");
    const sessionDate =
      typeof (session as any).data_sessao === "string" ? (session as any).data_sessao : null;

    produtos.forEach((raw, idx) => {
      const p = hydrateProduto(raw);
      if (!p.prazoEntrega) return;
      if (isEntregue(p.etapas)) return;

      const prazoDate = parseISODateLocal(p.prazoEntrega);
      if (!prazoDate) return;

      const diffMs = startOfLocalDay(prazoDate).getTime() - today.getTime();
      const diasParaVencer = Math.round(diffMs / 86400000);
      const bucket = classifyDeadline(diasParaVencer);
      if (!bucket) return;

      const produtoKey =
        (p.id && String(p.id)) ||
        (p.produtoId && String(p.produtoId)) ||
        deterministicProductId(sessionId, p.nome || "produto", idx);

      const etapas = p.etapas ?? [];
      const atualIdx = etapaAtualIndex(etapas);
      const etapaAtualNome = etapas[atualIdx]?.nome ?? null;

      out.push({
        sessionId,
        sessionDate,
        cliente: clienteNome,
        produtoId: produtoKey,
        produtoNome: p.nome || "Produto",
        quantidade: Number(p.quantidade) || 1,
        etapaAtualNome,
        prazoEntrega: p.prazoEntrega,
        bucket,
        diasParaVencer,
      });
    });
  }

  return out.sort((a, b) => a.diasParaVencer - b.diasParaVencer);
}
