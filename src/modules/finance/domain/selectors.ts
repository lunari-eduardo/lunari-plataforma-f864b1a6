/**
 * Selectors puros de Finance.
 */

import type { Transacao, ItemFinanceiro, Grupo, ResumoFinanceiro } from "./types";
import { isDespesa, isReceita } from "./rules";

export function groupTransacoesByGrupo(
  transacoes: Transacao[],
  itensById: Map<string, ItemFinanceiro>,
): Record<Grupo, Transacao[]> {
  const out: Record<Grupo, Transacao[]> = {
    "Despesa Fixa": [],
    "Despesa Variável": [],
    "Investimento": [],
    "Receita Operacional": [],
    "Receita Não Operacional": [],
  };
  for (const t of transacoes) {
    const item = itensById.get(t.itemId);
    if (!item) continue;
    out[item.grupo].push(t);
  }
  return out;
}

export function computeResumo(
  transacoes: Transacao[],
  itensById: Map<string, ItemFinanceiro>,
): ResumoFinanceiro {
  let receitaOperacional = 0;
  let totalReceitasExtras = 0;
  let totalDespesas = 0;
  let custoPrevisto = 0;
  let custoTotal = 0;

  for (const t of transacoes) {
    const item = itensById.get(t.itemId);
    if (!item) continue;
    const valor = t.valorTotal ?? t.valor;
    const pago = t.valorPago ?? (t.status === "Pago" ? valor : 0);

    if (item.grupo === "Receita Operacional") receitaOperacional += pago;
    else if (isReceita(item.grupo)) totalReceitasExtras += valor;
    else if (isDespesa(item.grupo)) {
      totalDespesas += valor;
      custoPrevisto += valor;
      custoTotal += pago;
    }
  }

  const lucroLiquido = receitaOperacional + totalReceitasExtras - custoTotal;
  const resultadoMensal = lucroLiquido;

  return {
    receitaOperacional,
    totalReceitasExtras,
    totalDespesas,
    lucroLiquido,
    custoPrevisto,
    custoTotal,
    resultadoMensal,
  };
}

export function itensByGrupo(itens: ItemFinanceiro[]): Map<Grupo, ItemFinanceiro[]> {
  const out = new Map<Grupo, ItemFinanceiro[]>();
  for (const item of itens) {
    if (!item.ativo) continue;
    const arr = out.get(item.grupo) ?? [];
    arr.push(item);
    out.set(item.grupo, arr);
  }
  return out;
}
