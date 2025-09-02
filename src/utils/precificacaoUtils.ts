/**
 * LEGACY COMPATIBILITY LAYER
 * This file now acts as an adapter to the new pricing services
 * Maintains backward compatibility while the system migrates
 */

// Re-export types for backward compatibility
export type {
  FaixaPreco,
  TabelaPrecos,
  ConfiguracaoPrecificacao,
  RegrasPrecoFotoExtraCongeladas
} from '@/types/pricing';

// Re-export main calculation functions
import { PricingCalculationService } from '@/services/PricingCalculationService';
import { PricingConfigurationService } from '@/services/PricingConfigurationService';
import { PricingValidationService } from '@/services/PricingValidationService';
import { PricingMigrationService } from '@/services/PricingMigrationService';
import { formatarMoeda } from '@/utils/currencyUtils';

// Legacy function mappings
export const obterConfiguracaoPrecificacao = () => PricingConfigurationService.loadConfiguration();
export const salvarConfiguracaoPrecificacao = (config: any) => PricingConfigurationService.saveConfiguration(config);
export const obterTabelaGlobal = () => PricingConfigurationService.loadGlobalTable();
export const salvarTabelaGlobal = (table: any) => PricingConfigurationService.saveGlobalTable(table);
export const obterTabelaCategoria = (id: string) => PricingConfigurationService.loadCategoryTable(id);
export const salvarTabelaCategoria = (id: string, table: any) => PricingConfigurationService.saveCategoryTable(id, table);
export const calcularValorPorFoto = (quantidade: number, tabela: any) => PricingCalculationService.calcularValorPorFoto(quantidade, tabela);
export const validarTabelaPrecos = (tabela: any) => PricingValidationService.validarTabelaPrecos(tabela);
export const criarTabelaExemplo = () => PricingCalculationService.criarTabelaExemplo();
export const congelarRegrasPrecoFotoExtra = (info?: any) => PricingMigrationService.congelarRegrasPrecoFotoExtra(info);
export const calcularComRegrasProprias = (qtd: number, regras: any) => PricingCalculationService.calcularComRegrasProprias(qtd, regras);
export const migrarRegrasParaItemAntigo = (valor?: number, catId?: string) => PricingMigrationService.migrarRegrasParaItemAntigo(valor, catId);
export const debugWorkflowItems = () => PricingMigrationService.debugWorkflowItems();
export const validarRegrasCongeladas = (regras: any) => PricingMigrationService.validarRegrasCongeladas(regras);

// Main calculation function with backward compatibility
export function calcularTotalFotosExtras(
  quantidade: number,
  pacoteInfo?: {
    valorFotoExtra?: number;
    categoria?: string;
    categoriaId?: string;
  }
): number {
  if (quantidade <= 0) return 0;

  const config = PricingConfigurationService.loadConfiguration();

  switch (config.modelo) {
    case 'fixo':
      return quantidade * (pacoteInfo?.valorFotoExtra || 0);
    case 'global':
      const tabelaGlobal = PricingConfigurationService.loadGlobalTable();
      if (!tabelaGlobal) return 0;
      const valorGlobal = PricingCalculationService.calcularValorPorFoto(quantidade, tabelaGlobal);
      return quantidade * valorGlobal;
    case 'categoria':
      if (!pacoteInfo?.categoriaId) return 0;
      const tabelaCategoria = PricingConfigurationService.loadCategoryTable(pacoteInfo.categoriaId);
      if (!tabelaCategoria) return 0;
      const valorCategoria = PricingCalculationService.calcularValorPorFoto(quantidade, tabelaCategoria);
      return quantidade * valorCategoria;
    default:
      return 0;
  }
}

// Re-export currency formatter
export { formatarMoeda };

// Legacy storage keys (deprecated - use new constants)
export const STORAGE_KEYS = {
  PRECIFICACAO_CONFIG: 'precificacao_configuracao',
  PRECIFICACAO_TABELA_GLOBAL: 'precificacao_tabela_global'
};