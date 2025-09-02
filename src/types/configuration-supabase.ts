/**
 * Tipos específicos para Supabase Database Tables
 * Preparação para migração futura
 */

// ============= SUPABASE ROW TYPES =============

export interface SupabaseCategoriaRow {
  id: string;
  user_id: string;
  nome: string;
  cor: string;
  created_at: string;
  updated_at: string;
}

export interface SupabaseProdutoRow {
  id: string;
  user_id: string;
  nome: string;
  preco_custo: number;
  preco_venda: number;
  created_at: string;
  updated_at: string;
}

export interface SupabasePacoteRow {
  id: string;
  user_id: string;
  nome: string;
  categoria_id: string;
  valor_base: number;
  valor_foto_extra: number;
  produtos_incluidos: Array<{
    produtoId: string;
    quantidade: number;
  }>;
  created_at: string;
  updated_at: string;
}

export interface SupabaseEtapaTrabalhoRow {
  id: string;
  user_id: string;
  nome: string;
  cor: string;
  ordem: number;
  created_at: string;
  updated_at: string;
}

// ============= INSERT TYPES =============

export type SupabaseCategoriaInsert = Omit<SupabaseCategoriaRow, 'created_at' | 'updated_at'>;
export type SupabaseProdutoInsert = Omit<SupabaseProdutoRow, 'created_at' | 'updated_at'>;
export type SupabasePacoteInsert = Omit<SupabasePacoteRow, 'created_at' | 'updated_at'>;
export type SupabaseEtapaTrabalhoInsert = Omit<SupabaseEtapaTrabalhoRow, 'created_at' | 'updated_at'>;

// ============= UPDATE TYPES =============

export type SupabaseCategoriaUpdate = Partial<Omit<SupabaseCategoriaRow, 'id' | 'user_id' | 'created_at'>>;
export type SupabaseProdutoUpdate = Partial<Omit<SupabaseProdutoRow, 'id' | 'user_id' | 'created_at'>>;
export type SupabasePacoteUpdate = Partial<Omit<SupabasePacoteRow, 'id' | 'user_id' | 'created_at'>>;
export type SupabaseEtapaTrabalhoUpdate = Partial<Omit<SupabaseEtapaTrabalhoRow, 'id' | 'user_id' | 'created_at'>>;

// ============= MIGRATION HELPERS =============

export interface MigrationResult {
  success: boolean;
  migratedCount: number;
  errors?: string[];
}

export interface ConfigurationMigrationStatus {
  categorias: MigrationResult;
  pacotes: MigrationResult;
  produtos: MigrationResult;
  etapas: MigrationResult;
}