/**
 * Unified types for pricing system - prepared for Supabase migration
 */

// ============= BASE TYPES =============

export interface FaixaPreco {
  min: number;
  max: number | null; // null means "or more"
  valor: number;
}

export interface TabelaPrecos {
  id: string;
  user_id?: string; // For Supabase multi-user compatibility
  nome: string;
  faixas: FaixaPreco[];
  usar_valor_fixo_pacote?: boolean; // 🆕 Se true, ignora tabela progressiva e usa valor do pacote
  created_at?: string;
  updated_at?: string;
}

export interface ConfiguracaoPrecificacao {
  id?: string;
  user_id?: string; // For Supabase multi-user compatibility
  modelo: 'fixo' | 'global' | 'categoria';
  created_at?: string;
  updated_at?: string;
}

// ============= PRICING CALCULATION TYPES =============

export interface PricingCalculationInput {
  quantidade: number;
  pacoteInfo?: {
    valorFotoExtra?: number;
    categoria?: string;
    categoriaId?: string;
  };
}

export interface PricingCalculationResult {
  valorTotal: number;
  valorUnitario: number;
  modelo: 'fixo' | 'global' | 'categoria';
  breakdown?: {
    faixaUsada?: FaixaPreco;
    tabelaUsada?: string;
  };
}

// ============= FROZEN RULES SYSTEM =============

export interface RegrasPrecoFotoExtraCongeladas {
  modelo: 'fixo' | 'global' | 'categoria';
  valorFixo?: number;
  tabelaGlobal?: TabelaPrecos;
  tabelaCategoria?: TabelaPrecos;
  categoriaId?: string;
  timestampCongelamento?: string;
  // Flags para sessões históricas manuais
  isManualHistorical?: boolean;
  source?: 'manual_historical' | 'appointment' | 'budget';
  pacote?: {
    nome: string | null;
    valorBase: number;
    valorFotoExtra: number;
  };
  createdAt?: string;
}

// ============= VALIDATION TYPES =============

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface TabelaPrecosValidation extends ValidationResult {
  tabela?: TabelaPrecos;
}

// ============= CONFIGURATION PERSISTENCE TYPES =============

export interface PricingStorageAdapter {
  loadConfiguration(): ConfiguracaoPrecificacao;
  saveConfiguration(config: ConfiguracaoPrecificacao): Promise<void>;
  loadGlobalTable(): TabelaPrecos | null;
  saveGlobalTable(table: TabelaPrecos): Promise<void>;
  loadCategoryTable(categoryId: string): TabelaPrecos | null;
  saveCategoryTable(categoryId: string, table: TabelaPrecos): Promise<void>;
}

// ============= MIGRATION TYPES =============

export interface PricingMigrationData {
  version: string;
  configuracao: ConfiguracaoPrecificacao;
  tabelaGlobal?: TabelaPrecos;
  tabelasCategorias: Record<string, TabelaPrecos>;
  migratedAt: string;
}

// ============= SUPABASE TYPES =============

export interface SupabasePricingConfiguration {
  id: string;
  user_id: string;
  modelo: 'fixo' | 'global' | 'categoria';
  created_at: string;
  updated_at: string;
}

export interface SupabaseTabelaPrecos {
  id: string;
  user_id: string;
  nome: string;
  faixas: FaixaPreco[];
  tipo: 'global' | 'categoria';
  categoria_id?: string;
  usar_valor_fixo_pacote?: boolean; // 🆕 Nova flag
  created_at: string;
  updated_at: string;
}

// ============= STORAGE KEYS =============

export const PRICING_STORAGE_KEYS = {
  CONFIGURACAO: 'precificacao_configuracao',
  TABELA_GLOBAL: 'precificacao_tabela_global',
  CATEGORIAS_PREFIX: 'configuracoes_categorias'
} as const;