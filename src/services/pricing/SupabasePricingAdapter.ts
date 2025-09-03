/**
 * Supabase Implementation for Pricing System (STUB)
 * To be implemented when Supabase integration is activated
 */

import type { PricingStorageAdapter, StorageConfig } from './PricingStorageAdapter';
import type {
  EstruturaCustosFixos,
  PadraoHoras,
  MetasPrecificacao,
  EstadoCalculadora,
  DadosValidacao
} from '@/types/precificacao';

export class SupabasePricingAdapter implements PricingStorageAdapter {
  private config: StorageConfig;

  constructor(config: StorageConfig = {}) {
    this.config = config;
    console.log('🔄 SupabasePricingAdapter initialized - requires Supabase integration');
  }

  // Estrutura de Custos
  async saveEstruturaCustos(dados: EstruturaCustosFixos): Promise<boolean> {
    throw new Error('Supabase integration not activated. Please connect to Supabase first.');
  }

  async loadEstruturaCustos(): Promise<EstruturaCustosFixos> {
    throw new Error('Supabase integration not activated. Please connect to Supabase first.');
  }

  // Padrão de Horas
  async savePadraoHoras(dados: PadraoHoras): Promise<boolean> {
    throw new Error('Supabase integration not activated. Please connect to Supabase first.');
  }

  async loadPadraoHoras(): Promise<PadraoHoras> {
    throw new Error('Supabase integration not activated. Please connect to Supabase first.');
  }

  // Metas
  async saveMetas(dados: MetasPrecificacao): Promise<boolean> {
    throw new Error('Supabase integration not activated. Please connect to Supabase first.');
  }

  async loadMetas(): Promise<MetasPrecificacao> {
    throw new Error('Supabase integration not activated. Please connect to Supabase first.');
  }

  // Calculadora
  async saveCalculadora(dados: EstadoCalculadora): Promise<boolean> {
    throw new Error('Supabase integration not activated. Please connect to Supabase first.');
  }

  async loadCalculadora(): Promise<EstadoCalculadora | null> {
    throw new Error('Supabase integration not activated. Please connect to Supabase first.');
  }

  async clearCalculadora(): Promise<boolean> {
    throw new Error('Supabase integration not activated. Please connect to Supabase first.');
  }

  // Validação
  async validateSystem(): Promise<DadosValidacao> {
    throw new Error('Supabase integration not activated. Please connect to Supabase first.');
  }

  // Backup
  async exportData(): Promise<string> {
    throw new Error('Supabase integration not activated. Please connect to Supabase first.');
  }

  async importData(data: string): Promise<boolean> {
    throw new Error('Supabase integration not activated. Please connect to Supabase first.');
  }
}

/**
 * Future implementation will include:
 * - Multi-user data isolation using RLS
 * - Real-time collaboration features
 * - Cloud backup and sync
 * - Advanced analytics and reporting
 * - Integration with other Supabase features
 */