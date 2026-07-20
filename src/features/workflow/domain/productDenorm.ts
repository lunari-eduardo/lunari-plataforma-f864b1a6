/**
 * Derivação canônica dos campos denormalizados `produto` / `qtdProduto` /
 * `valorTotalProduto` a partir da lista `produtos_incluidos`.
 *
 * Existe para que o modal "Gerenciar Produtos" precise disparar UM ÚNICO
 * `onFieldUpdate("produtosList", ...)`. O reducer central em
 * `useWorkflowSessionActions.updateSession` calcula esses três campos a
 * partir daqui e grava tudo no mesmo tick — evitando as chamadas seriais que
 * revertiam o estado local por closure stale.
 */

import type { ProdutoWorkflowFlow } from "./productFlow";

export interface DenormalizedProdutoFields {
  produto: string;
  qtdProduto: number;
  valorTotalProduto: number;
}

export function deriveDenormalizedProdutos(
  produtos: ProdutoWorkflowFlow[] | undefined | null,
): DenormalizedProdutoFields {
  const list = Array.isArray(produtos) ? produtos : [];

  const manuais = list.filter((p) => p?.tipo === "manual");
  const inclusos = list.filter((p) => p?.tipo === "incluso");

  const valorTotalProduto = manuais.reduce(
    (total, p) => total + (Number(p.valorUnitario) || 0) * (Number(p.quantidade) || 0),
    0,
  );
  const qtdProduto = manuais.reduce(
    (total, p) => total + (Number(p.quantidade) || 0),
    0,
  );

  let produto = "";
  if (manuais.length > 0) {
    const nomesManuais = manuais.map((p) => p.nome).join(", ");
    produto =
      inclusos.length > 0
        ? `${nomesManuais} + ${inclusos.length} incluso(s)`
        : nomesManuais;
  } else if (inclusos.length > 0) {
    produto = `${inclusos.length} produto(s) incluso(s)`;
  }

  return { produto, qtdProduto, valorTotalProduto };
}
