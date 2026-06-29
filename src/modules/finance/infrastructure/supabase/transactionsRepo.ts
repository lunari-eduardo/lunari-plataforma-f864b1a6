/**
 * Supabase impl do `TransactionsRepo`.
 * Delega ao adapter legado para preservar lógicas testadas (parcelado/recorrente/cartão).
 */

import { supabase } from "@/integrations/supabase/client";
import { SupabaseFinancialTransactionsAdapter } from "@/adapters/SupabaseFinancialTransactionsAdapter";
import type {
  TransactionsRepo,
  CreateTransactionInput,
  CreateParceladoInput,
  CreateRecorrenteInput,
  CreateCartaoInput,
  UpdateTransactionInput,
} from "../../ports/transactionsRepo";
import type { Transacao } from "../../domain/types";
import { rowToTransacao } from "./mappers";

function mapCreatePayload(input: CreateTransactionInput) {
  return {
    item_id: input.itemId,
    valor: input.valor,
    data_vencimento: input.dataVencimento,
    data_competencia: input.dataCompetencia,
    observacoes: input.observacoes ?? undefined,
    parcela_atual: input.parcelaAtual ?? undefined,
    parcela_total: input.parcelaTotal ?? undefined,
    credit_card_id: input.cartaoId ?? undefined,
    data_compra: input.dataCompra ?? undefined,
    parent_id: input.parentId ?? undefined,
    status: "Agendado" as const,
  };
}

export const supabaseTransactionsRepo: TransactionsRepo = {
  async listAll() {
    const rows = await SupabaseFinancialTransactionsAdapter.getAllTransactions();
    return rows.map(rowToTransacao);
  },

  async listByYear(year) {
    const rows = await SupabaseFinancialTransactionsAdapter.getTransactionsByYear(year);
    return rows.map(rowToTransacao);
  },

  async listByRange(start, end) {
    const rows = await SupabaseFinancialTransactionsAdapter.getTransactionsByDateRange(start, end);
    return rows.map(rowToTransacao);
  },

  async getById(id) {
    const { data, error } = await supabase
      .from("fin_transactions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToTransacao(data) : null;
  },

  async createSingle(input) {
    const row = await SupabaseFinancialTransactionsAdapter.createTransaction(
      mapCreatePayload(input) as any,
    );
    return rowToTransacao(row);
  },

  async createParcelado(input) {
    const rows = await SupabaseFinancialTransactionsAdapter.createParceledTransactions({
      itemId: input.itemId,
      valorTotal: input.valorTotal,
      dataPrimeiraOcorrencia: input.dataPrimeiraOcorrencia,
      numeroDeParcelas: input.numeroDeParcelas,
      observacoes: input.observacoes,
    });
    return rows.map(rowToTransacao);
  },

  async createRecorrente(input) {
    const rows = await SupabaseFinancialTransactionsAdapter.createRecurringYearlyTransactions({
      itemId: input.itemId,
      valor: input.valor,
      diaVencimento: input.diaVencimento,
      dataInicio: input.dataInicio,
      isValorFixo: input.isValorFixo,
      observacoes: input.observacoes,
    });
    return rows.map(rowToTransacao);
  },

  async createCartao(input) {
    const rows = await SupabaseFinancialTransactionsAdapter.createCreditCardTransactions({
      itemId: input.itemId,
      valorTotal: input.valorTotal,
      dataCompra: input.dataCompra,
      cartaoCreditoId: input.cartaoId,
      numeroDeParcelas: input.numeroDeParcelas,
      observacoes: input.observacoes,
    });
    return rows.map(rowToTransacao);
  },

  async update(id, patch: UpdateTransactionInput) {
    const dbPatch: Record<string, unknown> = {};
    if (patch.valor !== undefined) dbPatch.valor = patch.valor;
    if (patch.dataVencimento !== undefined) dbPatch.data_vencimento = patch.dataVencimento;
    if (patch.dataCompetencia !== undefined) dbPatch.data_competencia = patch.dataCompetencia;
    if (patch.observacoes !== undefined) dbPatch.observacoes = patch.observacoes;
    if (patch.formaPagamento !== undefined) dbPatch.forma_pagamento = patch.formaPagamento;
    const row = await SupabaseFinancialTransactionsAdapter.updateTransaction(id, dbPatch as any);
    return rowToTransacao(row);
  },

  async markPaid(id, dataPagamento) {
    const row = await SupabaseFinancialTransactionsAdapter.updateTransaction(id, {
      status: "Pago" as any,
      ...(dataPagamento ? { data_pagamento: dataPagamento } as any : {}),
    });
    return rowToTransacao(row);
  },

  async markPending(id) {
    const row = await SupabaseFinancialTransactionsAdapter.updateTransaction(id, {
      status: "Faturado" as any,
    } as any);
    return rowToTransacao(row);
  },

  async remove(id) {
    await SupabaseFinancialTransactionsAdapter.deleteTransaction(id);
  },
};
