/**
 * Port: TransactionsRepo
 * Onda 2 — contrato abstrato de persistência de transações financeiras.
 */

import type { Transacao, FormaPagamento } from "../domain/types";

export interface CreateTransactionInput {
  itemId: string;
  valor: number;
  dataVencimento: string;
  dataCompetencia?: string;
  observacoes?: string | null;
  parcelaAtual?: number | null;
  parcelaTotal?: number | null;
  formaPagamento?: FormaPagamento | null;
  cartaoId?: string | null;
  dataCompra?: string | null;
  parentId?: string | null;
}

export interface CreateParceladoInput {
  itemId: string;
  valorTotal: number;
  dataPrimeiraOcorrencia: string;
  numeroDeParcelas: number;
  formaPagamento?: FormaPagamento | null;
  observacoes?: string;
}

export interface CreateRecorrenteInput {
  itemId: string;
  valor: number;
  diaVencimento: number;
  dataInicio: string;
  isValorFixo: boolean;
  observacoes?: string;
}

export interface CreateCartaoInput {
  itemId: string;
  valorTotal: number;
  dataCompra: string;
  cartaoId: string;
  numeroDeParcelas?: number;
  observacoes?: string;
}

export interface UpdateTransactionInput {
  valor?: number;
  dataVencimento?: string;
  dataCompetencia?: string | null;
  observacoes?: string | null;
  formaPagamento?: FormaPagamento | null;
}

export interface TransactionsRepo {
  listAll(): Promise<Transacao[]>;
  listByYear(year: number): Promise<Transacao[]>;
  listByRange(start: string, end: string): Promise<Transacao[]>;
  getById(id: string): Promise<Transacao | null>;

  createSingle(input: CreateTransactionInput): Promise<Transacao>;
  createParcelado(input: CreateParceladoInput): Promise<Transacao[]>;
  createRecorrente(input: CreateRecorrenteInput): Promise<Transacao[]>;
  createCartao(input: CreateCartaoInput): Promise<Transacao[]>;

  update(id: string, patch: UpdateTransactionInput): Promise<Transacao>;
  markPaid(id: string, dataPagamento?: string): Promise<Transacao>;
  markPending(id: string): Promise<Transacao>;
  remove(id: string): Promise<void>;
}
