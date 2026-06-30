/**
 * Mappers DB ↔ Domain para o módulo Finance.
 */

import type { Transacao, ItemFinanceiro, MetaPersonalizada, Grupo, StatusTransacao, FormaPagamento } from "../../domain/types";

// ===== Transacao =====

export interface FinTransactionRow {
  id: string;
  user_id: string;
  item_id: string;
  valor: number;
  valor_pago?: number | null;
  valor_total?: number | null;
  status: string;
  data_vencimento: string;
  data_competencia?: string | null;
  data_pagamento?: string | null;
  observacoes?: string | null;
  parcela_atual?: number | null;
  parcela_total?: number | null;
  forma_pagamento?: string | null;
  credit_card_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export function rowToTransacao(r: any): Transacao {
  return {
    id: r.id,
    itemId: r.item_id,
    valor: Number(r.valor) || 0,
    valorPago: r.valor_pago != null ? Number(r.valor_pago) : undefined,
    valorTotal: r.valor_total != null ? Number(r.valor_total) : undefined,
    status: (r.status as StatusTransacao) || "Agendado",
    dataVencimento: r.data_vencimento,
    dataCompetencia: r.data_competencia ?? undefined,
    dataPagamento: r.data_pagamento ?? undefined,
    observacoes: r.observacoes ?? null,
    parcelaAtual: r.parcela_atual ?? null,
    parcelaTotal: r.parcela_total ?? null,
    formaPagamento: (r.forma_pagamento as FormaPagamento) ?? null,
    cartaoId: r.credit_card_id ?? null,
    userId: r.user_id,
    criadoEm: r.created_at ?? new Date().toISOString(),
    atualizadoEm: r.updated_at ?? undefined,
  };
}

// ===== ItemFinanceiro (tabela fin_items_master, coluna grupo_principal) =====

export function rowToItem(r: any): ItemFinanceiro {
  return {
    id: r.id,
    nome: r.nome,
    grupo: r.grupo_principal as Grupo,
    userId: r.user_id,
    ativo: !!r.ativo,
    criadoEm: r.created_at ?? new Date().toISOString(),
    groupCode: r.group_code ?? null,
    isSystem: !!r.is_system,
    archivedAt: r.archived_at ?? null,
  };
}

// ===== MetaPersonalizada =====

export function rowToMeta(r: any): MetaPersonalizada {
  return {
    id: r.id,
    userId: r.user_id,
    ano: r.ano,
    mes: r.mes,
    categoria: r.categoria,
    metaFaturamento: Number(r.meta_faturamento ?? r.faturamento ?? 0),
    metaLucro: Number(r.meta_lucro ?? r.lucro ?? 0),
    criadoEm: r.created_at ?? new Date().toISOString(),
    atualizadoEm: r.updated_at ?? undefined,
  };
}
