/**
 * Tipos de domínio — Módulo Configurações.
 *
 * Reflete o catálogo operacional do estúdio (categorias, pacotes, produtos,
 * etapas, pricing, contratos). Mantido enxuto até que capabilities de escrita
 * sejam introduzidas em ondas posteriores.
 */

export type PricingModelo = "fixo" | "global" | "categoria";

export type ConfiguracoesTab =
  | "categorias"
  | "precificacao"
  | "pacotes"
  | "produtos"
  | "fluxo"
  | "formularios"
  | "contratos";

export interface CategoriaResumo {
  id: string;
  nome: string;
  cor?: string | null;
}

export interface PacoteResumo {
  id: string;
  nome: string;
  categoriaId?: string | null;
  valorBase?: number;
  valorFotoExtra?: number;
}

export interface ProdutoResumo {
  id: string;
  nome: string;
  ativo?: boolean;
  precoVenda?: number;
}

export interface EtapaResumo {
  id: string;
  nome: string;
  ordem: number;
  cor?: string | null;
}

export interface ContratoTemplateResumo {
  id: string;
  nome: string;
  atualizadoEm?: string | null;
}

export interface ConfiguracoesSelection {
  categoriaId: string | null;
  pacoteId: string | null;
  produtoId: string | null;
  etapaId: string | null;
  contratoTemplateId: string | null;
}
