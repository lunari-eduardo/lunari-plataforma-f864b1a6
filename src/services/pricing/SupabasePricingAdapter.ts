/**
 * Supabase Implementation for Pricing System
 * Full Supabase integration with multi-user support
 */

import { supabase } from "@/integrations/supabase/client";
import type { PricingStorageAdapter, StorageConfig } from "./PricingStorageAdapter";
import type {
  EstruturaCustosFixos,
  PadraoHoras,
  MetasPrecificacao,
  EstadoCalculadora,
  DadosValidacao,
} from "@/types/precificacao";
import {
  saveEstruturaCustos,
  loadEstruturaCustos,
  createDefaultEstruturaCustos,
  validateEstruturaCustos,
} from "./supabase-adapter/costsStorage";
import {
  savePadraoHoras,
  loadPadraoHoras,
  createDefaultPadraoHoras,
  saveMetas,
  loadMetas,
  createDefaultMetas,
} from "./supabase-adapter/hoursGoalsStorage";
import {
  saveCalculadora,
  loadCalculadora,
  clearCalculadora,
} from "./supabase-adapter/calculatorStorage";
import {
  validateSystem,
  exportData,
  importData,
} from "./supabase-adapter/backupValidationStorage";

export class SupabasePricingAdapter implements PricingStorageAdapter {
  private config: StorageConfig;
  private userId: string | null = null;

  constructor(config: StorageConfig = {}) {
    this.config = {
      enableAutoSave: true,
      validationInterval: 30000,
      ...config,
    };
  }

  private async ensureUser(): Promise<string> {
    if (this.userId) return this.userId;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    this.userId = user.id;
    return user.id;
  }

  // ============= ESTRUTURA DE CUSTOS =============

  async saveEstruturaCustos(dados: EstruturaCustosFixos): Promise<boolean> {
    const userId = await this.ensureUser();
    return saveEstruturaCustos(userId, dados);
  }

  async loadEstruturaCustos(): Promise<EstruturaCustosFixos> {
    const userId = await this.ensureUser();
    return loadEstruturaCustos(userId);
  }

  // ============= PADRÃO DE HORAS =============

  async savePadraoHoras(dados: PadraoHoras): Promise<boolean> {
    const userId = await this.ensureUser();
    return savePadraoHoras(userId, dados);
  }

  async loadPadraoHoras(): Promise<PadraoHoras> {
    const userId = await this.ensureUser();
    return loadPadraoHoras(userId);
  }

  // ============= METAS =============

  async saveMetas(dados: MetasPrecificacao): Promise<boolean> {
    const userId = await this.ensureUser();
    return saveMetas(userId, dados);
  }

  async loadMetas(): Promise<MetasPrecificacao> {
    const userId = await this.ensureUser();
    return loadMetas(userId);
  }

  // ============= CALCULADORA =============

  async saveCalculadora(dados: EstadoCalculadora): Promise<boolean> {
    const userId = await this.ensureUser();
    return saveCalculadora(userId, dados);
  }

  async loadCalculadora(): Promise<EstadoCalculadora | null> {
    const userId = await this.ensureUser();
    return loadCalculadora(userId);
  }

  async clearCalculadora(): Promise<boolean> {
    const userId = await this.ensureUser();
    return clearCalculadora(userId);
  }

  // ============= VALIDAÇÃO =============

  async validateSystem(): Promise<DadosValidacao> {
    const userId = await this.ensureUser();
    return validateSystem(userId);
  }

  // ============= BACKUP =============

  async exportData(): Promise<string> {
    const userId = await this.ensureUser();
    return exportData(userId);
  }

  async importData(data: string): Promise<boolean> {
    const userId = await this.ensureUser();
    return importData(userId, data);
  }

  // ============= HELPERS =============

  private createDefaultEstruturaCustos(): EstruturaCustosFixos {
    return createDefaultEstruturaCustos(this.userId);
  }

  private createDefaultPadraoHoras(): PadraoHoras {
    return createDefaultPadraoHoras(this.userId);
  }

  private createDefaultMetas(): MetasPrecificacao {
    return createDefaultMetas(this.userId);
  }

  private validateEstruturaCustos(dados: EstruturaCustosFixos): string[] {
    return validateEstruturaCustos(dados);
  }
}
