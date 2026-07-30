/**
 * Tipos de domínio — Módulo Precificação (Bloco B2).
 *
 * Cobre a configuração de preço do estúdio (modelo, tabelas progressivas,
 * estrutura de custos, metas) e as simulações derivadas. Nenhum tipo aqui
 * grava nada: escrita vive em `application/mutations.ts`.
 */

export type PricingModelo = "fixo" | "global" | "categoria";

export interface FaixaPreco {
  min: number;
  max: number | null;
  valor: number;
}

export interface TabelaPrecosResumo {
  id: string;
  nome: string;
  tipo: "global" | "categoria";
  categoriaId: string | null;
  usarValorFixoPacote: boolean;
  faixas: FaixaPreco[];
}

export interface EstruturaCustosResumo {
  totalGastosPessoais: number;
  percentualProLabore: number;
  proLaboreCalculado: number;
  totalCustosEstudio: number;
  totalDepreciacaoMensal: number;
  custoFixoMensal: number;
  horasDisponiveisDia: number;
  diasTrabalhadosSemana: number;
  horasMes: number;
  custoPorHora: number;
}

export interface SimulacaoBreakdown {
  custoHoras: number;
  custoProdutos: number;
  custosAdicionais: number;
  lucroEstimado: number;
}

export interface PrecificacaoSelection {
  categoriaId: string | null;
  pacoteId: string | null;
  cenarioId: string | null;
}

export type PrecificacaoTab =
  | "custos"
  | "horas"
  | "metas"
  | "calculadora"
  | "tabelas";
