/**
 * Migration and frozen rules service for pricing system
 * Handles rule freezing, legacy migrations and data preservation
 */

import type { 
  RegrasPrecoFotoExtraCongeladas,
  ConfiguracaoPrecificacao,
  TabelaPrecos,
  PricingMigrationData 
} from '@/types/pricing';
import { PricingConfigurationService } from './PricingConfigurationService';

export class PricingMigrationService {
  /**
   * Freeze current pricing rules for a new item
   * Captures a snapshot of active pricing rules for future use
   */
  static congelarRegrasPrecoFotoExtra(
    pacoteInfo?: {
      valorFotoExtra?: number;
      categoria?: string;
      categoriaId?: string;
    }
  ): RegrasPrecoFotoExtraCongeladas {
    const config = PricingConfigurationService.loadConfiguration();
    const timestamp = new Date().toISOString();

    console.log('🧊 Freezing pricing rules:', { config, pacoteInfo });

    switch (config.modelo) {
      case 'fixo':
        return {
          modelo: 'fixo',
          valorFixo: pacoteInfo?.valorFotoExtra || 35, // Default value
          timestampCongelamento: timestamp
        };

      case 'global':
        const tabelaGlobal = PricingConfigurationService.loadGlobalTable();
        if (!tabelaGlobal) {
          console.warn('⚠️ Global table not configured, using fixed model as fallback');
          return {
            modelo: 'fixo',
            valorFixo: 35,
            timestampCongelamento: timestamp
          };
        }
        return {
          modelo: 'global',
          tabelaGlobal: JSON.parse(JSON.stringify(tabelaGlobal)), // Deep copy
          timestampCongelamento: timestamp,
        };

      case 'categoria':
        const categoriaId = pacoteInfo?.categoriaId;
        if (!categoriaId) {
          console.warn('⚠️ Category ID not provided, using fixed model as fallback');
          return {
            modelo: 'fixo',
            valorFixo: pacoteInfo?.valorFotoExtra || 35,
            timestampCongelamento: timestamp
          };
        }

        const tabelaCategoria = PricingConfigurationService.loadCategoryTable(categoriaId);
        if (!tabelaCategoria) {
          console.warn(`⚠️ Table not configured for category ${categoriaId}, using fixed model as fallback`);
          return {
            modelo: 'fixo',
            valorFixo: pacoteInfo?.valorFotoExtra || 35,
            timestampCongelamento: timestamp
          };
        }

        return {
          modelo: 'categoria',
          tabelaCategoria: JSON.parse(JSON.stringify(tabelaCategoria)), // Deep copy
          categoriaId,
          timestampCongelamento: timestamp
        };

      default:
        console.error('❌ Unknown pricing model:', config.modelo);
        return {
          modelo: 'fixo',
          valorFixo: 35,
          timestampCongelamento: timestamp
        };
    }
  }

  /**
   * Migrate legacy items without frozen rules
   * Preserves original values from when item was created
   */
  static migrarRegrasParaItemAntigo(
    valorFotoExtraOriginal?: number,
    categoriaId?: string
  ): RegrasPrecoFotoExtraCongeladas {
    console.log('🔄 [MIGRATION] Starting migration for legacy item:', {
      valorOriginal: valorFotoExtraOriginal,
      categoriaId
    });
    
    // Use the value that was in the item when it was created
    // If no value, use historical default (35)
    const valorFixoPreservado = valorFotoExtraOriginal && valorFotoExtraOriginal > 0 
      ? valorFotoExtraOriginal 
      : 35;

    const regrasCongeladas = {
      modelo: 'fixo' as const,
      valorFixo: valorFixoPreservado,
      timestampCongelamento: new Date().toISOString()
    };

    console.log('✅ [MIGRATION] Rules created:', regrasCongeladas);
    
    return regrasCongeladas;
  }

  /**
   * Validate frozen rules integrity
   */
  static validarRegrasCongeladas(regras: RegrasPrecoFotoExtraCongeladas): boolean {
    if (!regras || !regras.modelo) {
      return false;
    }

    switch (regras.modelo) {
      case 'fixo':
        return typeof regras.valorFixo === 'number' && regras.valorFixo >= 0;
        
      case 'global':
        return !!(regras.tabelaGlobal && regras.tabelaGlobal.faixas && regras.tabelaGlobal.faixas.length > 0);
        
      case 'categoria':
        return !!(
          regras.tabelaCategoria && 
          regras.tabelaCategoria.faixas && 
          regras.tabelaCategoria.faixas.length > 0 &&
          regras.categoriaId
        );
        
      default:
        return false;
    }
  }

  /**
   * Create migration snapshot for backup/export
   */
  static criarSnapshotMigracao(): PricingMigrationData {
    const configuracao = PricingConfigurationService.loadConfiguration();
    const tabelaGlobal = PricingConfigurationService.loadGlobalTable();
    
    // Get all categories with their pricing tables
    const tabelasCategorias: Record<string, TabelaPrecos> = {};
    const categoriesWithPricing = PricingConfigurationService.getCategoriesWithPricing();
    
    categoriesWithPricing.forEach(cat => {
      if (cat.hasPricing) {
        const tabela = PricingConfigurationService.loadCategoryTable(cat.id);
        if (tabela) {
          tabelasCategorias[cat.id] = tabela;
        }
      }
    });

    return {
      version: '1.0.0',
      configuracao,
      tabelaGlobal: tabelaGlobal || undefined,
      tabelasCategorias,
      migratedAt: new Date().toISOString()
    };
  }

  /**
   * Debug workflow items (for diagnostics)
   */
  static debugWorkflowItems(): void {
    try {
      const items = localStorage.getItem('workflow_sessions');
      if (items) {
        const parsedItems = JSON.parse(items);
        console.log('🔍 [DEBUG] Workflow Items:', parsedItems);
        
        parsedItems.forEach((item: any, index: number) => {
          console.log(`📋 [DEBUG] Item ${index + 1}:`, {
            id: item.id,
            pacote: item.pacote,
            valorFotoExtra: item.valorFotoExtra,
            qtdFotosExtra: item.qtdFotosExtra,
            valorTotalFotoExtra: item.valorTotalFotoExtra,
            temRegrasCongeladas: !!item.regrasDePrecoFotoExtraCongeladas,
          });
        });
      }
    } catch (error) {
      console.error('❌ [DEBUG] Error reading workflow items:', error);
    }
  }

  /**
   * Check if system needs migration
   */
  static verificarNecessidadeMigracao(): {
    precisaMigrar: boolean;
    motivos: string[];
    itensAfetados: number;
  } {
    const motivos: string[] = [];
    let itensAfetados = 0;

    try {
      // Check workflow items for legacy data
      const items = localStorage.getItem('workflow_sessions');
      if (items) {
        const parsedItems = JSON.parse(items);
        itensAfetados = parsedItems.filter((item: any) => !item.regrasDePrecoFotoExtraCongeladas).length;
        
        if (itensAfetados > 0) {
          motivos.push(`${itensAfetados} itens sem regras congeladas`);
        }
      }

      // Check for configuration inconsistencies
      const config = PricingConfigurationService.loadConfiguration();
      if (config.modelo === 'global') {
        const tabelaGlobal = PricingConfigurationService.loadGlobalTable();
        if (!tabelaGlobal) {
          motivos.push('Modelo global configurado mas tabela não encontrada');
        }
      }

    } catch (error) {
      console.error('Error checking migration needs:', error);
      motivos.push('Erro ao verificar necessidade de migração');
    }

    return {
      precisaMigrar: motivos.length > 0,
      motivos,
      itensAfetados
    };
  }
}