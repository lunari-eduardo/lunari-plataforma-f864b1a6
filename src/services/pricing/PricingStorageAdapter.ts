/**
 * Storage Adapter Interface for Pricing System
 * Abstraction layer for different storage implementations
 */

import type {
  EstruturaCustosFixos,
  PadraoHoras,
  MetasPrecificacao,
  EstadoCalculadora,
  DadosValidacao
} from '@/types/precificacao';

export interface PricingStorageAdapter {
  // Estrutura de Custos
  saveEstruturaCustos(dados: EstruturaCustosFixos): Promise<boolean>;
  loadEstruturaCustos(): Promise<EstruturaCustosFixos>;
  
  // Padrão de Horas
  savePadraoHoras(dados: PadraoHoras): Promise<boolean>;
  loadPadraoHoras(): Promise<PadraoHoras>;
  
  // Metas
  saveMetas(dados: MetasPrecificacao): Promise<boolean>;
  loadMetas(): Promise<MetasPrecificacao>;
  
  // Calculadora
  saveCalculadora(dados: EstadoCalculadora): Promise<boolean>;
  loadCalculadora(): Promise<EstadoCalculadora | null>;
  clearCalculadora(): Promise<boolean>;
  
  // Validação
  validateSystem(): Promise<DadosValidacao>;
  
  // Backup
  exportData(): Promise<string>;
  importData(data: string): Promise<boolean>;
}

export interface StorageConfig {
  userId?: string;
  enableAutoSave?: boolean;
  validationInterval?: number;
}