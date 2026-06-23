/**
 * Domain — espelho das triggers de banco:
 *   recalc_fotos_extras + recalculate_session_valor_total
 *
 * A implementação canônica vive em `src/utils/fotosExtrasCalculator`; esta
 * camada apenas re-exporta para que o `domain/` seja o único caminho usado
 * por `actions/` e `store/`. Quando a Onda 5 quebrar o utils antigo,
 * movemos a lógica para cá.
 */

export { recalcFotosExtras, recalcSessionValorTotal } from "@/utils/fotosExtrasCalculator";

import { toReais } from "./money";
import type { WorkflowSession } from "./session";

/** Soma derivada que a UI usa hoje (valor_total já vem do trigger; este é fallback). */
export function deriveValorTotal(session: Partial<WorkflowSession>): number {
  const base = toReais(session.valor_base_pacote);
  const fotos = toReais(session.valor_total_foto_extra);
  const adicional = toReais(session.valor_adicional);
  const desconto = toReais(session.desconto);
  const produtos = Array.isArray(session.produtos_incluidos)
    ? (session.produtos_incluidos as Array<{ tipo?: string; quantidade?: number; valorUnitario?: number }>)
        .filter((p) => p?.tipo === "manual")
        .reduce((acc, p) => acc + (Number(p.quantidade) || 0) * (Number(p.valorUnitario) || 0), 0)
    : 0;
  return base + fotos + produtos + adicional - desconto;
}

export function deriveRestante(session: Pick<WorkflowSession, "valor_total" | "valor_pago">): number {
  return toReais(session.valor_total) - toReais(session.valor_pago);
}
