/**
 * Consolidated Pricing Types
 * All pricing-related TypeScript definitions in one place
 */

// Re-export existing types from precificacao.ts for backwards compatibility
export type {
  GastoItem,
  Equipamento,
  ProdutoAdicional,
  CustoExtra,
  EstruturaCustomerFixos,
  PadraoHoras,
  MetasPrecificacao,
  EstadoCalculadora,
  DadosValidacao,
  BackupPrecificacao,
  MigracaoStatus,
  StatusSalvamento,
  IndicadorSalvamento
} from '@/types/precificacao';

// New types specific to the refactored architecture
export interface PricingSystemStatus {
  initialized: boolean;
  validationPassed: boolean;
  lastCheck: string;
  errors: string[];
}

export interface PricingCalculationParams {
  horasEstimadas: number;
  custosFixosHora: number;
  markup: number;
  produtos: ProdutoAdicional[];
  custosExtras: CustoExtra[];
}

export interface PricingCalculationResult {
  custoTotalCalculado: number;
  precoFinalCalculado: number;
  lucratividade: number;
  breakdown: {
    custoHoras: number;
    custoProdutos: number;
    custosAdicionais: number;
    lucroEstimado: number;
  };
}