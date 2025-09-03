/**
 * Local Storage Implementation for Pricing System
 */

import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import type { PricingStorageAdapter, StorageConfig } from './PricingStorageAdapter';
import type {
  EstruturaCustomerFixos,
  PadraoHoras,
  MetasPrecificacao,
  EstadoCalculadora,
  DadosValidacao,
  BackupPrecificacao
} from '@/types/precificacao';

const USUARIO_LOCAL = 'local_user';

export class LocalPricingAdapter implements PricingStorageAdapter {
  private config: StorageConfig;

  constructor(config: StorageConfig = {}) {
    this.config = {
      userId: USUARIO_LOCAL,
      enableAutoSave: true,
      validationInterval: 30000,
      ...config
    };
  }

  // Estrutura de Custos
  async saveEstruturaCustos(dados: EstruturaCustomerFixos): Promise<boolean> {
    try {
      const dadosComMetadata = {
        ...dados,
        user_id: this.config.userId,
        updated_at: new Date().toISOString()
      };
      
      storage.save(STORAGE_KEYS.PRICING_FIXED_COSTS, dadosComMetadata);
      return true;
    } catch (error) {
      console.error('❌ Erro ao salvar estrutura de custos:', error);
      return false;
    }
  }

  async loadEstruturaCustos(): Promise<EstruturaCustomerFixos> {
    try {
      const defaults: EstruturaCustomerFixos = {
        gastosPessoais: [],
        percentualProLabore: 30,
        custosEstudio: [],
        equipamentos: [],
        totalCalculado: 0,
        user_id: this.config.userId,
        created_at: new Date().toISOString()
      };

      const dadosBrutos = storage.load(STORAGE_KEYS.PRICING_FIXED_COSTS, defaults);
      
      return {
        ...defaults,
        ...dadosBrutos,
        gastosPessoais: Array.isArray(dadosBrutos?.gastosPessoais) ? dadosBrutos.gastosPessoais : [],
        custosEstudio: Array.isArray(dadosBrutos?.custosEstudio) ? dadosBrutos.custosEstudio : [],
        equipamentos: Array.isArray(dadosBrutos?.equipamentos) ? dadosBrutos.equipamentos : []
      };
    } catch (error) {
      console.error('❌ Erro ao carregar estrutura de custos:', error);
      return this.createDefaultEstruturaCustos();
    }
  }

  // Padrão de Horas
  async savePadraoHoras(dados: PadraoHoras): Promise<boolean> {
    try {
      const dadosComMetadata = {
        ...dados,
        user_id: this.config.userId,
        updated_at: new Date().toISOString()
      };
      
      storage.save(STORAGE_KEYS.PRICING_HOUR_DEFAULTS, dadosComMetadata);
      return true;
    } catch (error) {
      console.error('❌ Erro ao salvar padrão de horas:', error);
      return false;
    }
  }

  async loadPadraoHoras(): Promise<PadraoHoras> {
    try {
      const defaults: PadraoHoras = {
        horasDisponiveis: 8,
        diasTrabalhados: 5,
        user_id: this.config.userId,
        created_at: new Date().toISOString()
      };

      const dados = storage.load(STORAGE_KEYS.PRICING_HOUR_DEFAULTS, defaults);
      return { ...defaults, ...dados };
    } catch (error) {
      console.error('❌ Erro ao carregar padrão de horas:', error);
      return this.createDefaultPadraoHoras();
    }
  }

  // Metas
  async saveMetas(dados: MetasPrecificacao): Promise<boolean> {
    try {
      const dadosComMetadata = {
        ...dados,
        user_id: this.config.userId,
        updated_at: new Date().toISOString()
      };
      
      storage.save(STORAGE_KEYS.PRICING_GOALS, dadosComMetadata);
      return true;
    } catch (error) {
      console.error('❌ Erro ao salvar metas:', error);
      return false;
    }
  }

  async loadMetas(): Promise<MetasPrecificacao> {
    try {
      const currentYear = new Date().getFullYear();
      const defaults: MetasPrecificacao = {
        margemLucroDesejada: 30,
        ano: currentYear,
        metaFaturamentoAnual: 0,
        metaLucroAnual: 0,
        user_id: this.config.userId,
        created_at: new Date().toISOString()
      };

      const dados = storage.load(STORAGE_KEYS.PRICING_GOALS, defaults);
      return { ...defaults, ...dados };
    } catch (error) {
      console.error('❌ Erro ao carregar metas:', error);
      return this.createDefaultMetas();
    }
  }

  // Calculadora
  async saveCalculadora(dados: EstadoCalculadora): Promise<boolean> {
    try {
      const dadosComMetadata = {
        ...dados,
        user_id: this.config.userId,
        updated_at: new Date().toISOString()
      };
      
      storage.save(STORAGE_KEYS.PRICING_CALCULATOR_STATE, dadosComMetadata);
      return true;
    } catch (error) {
      console.error('❌ Erro ao salvar calculadora:', error);
      return false;
    }
  }

  async loadCalculadora(): Promise<EstadoCalculadora | null> {
    try {
      return storage.load(STORAGE_KEYS.PRICING_CALCULATOR_STATE, null);
    } catch (error) {
      console.error('❌ Erro ao carregar calculadora:', error);
      return null;
    }
  }

  async clearCalculadora(): Promise<boolean> {
    try {
      storage.remove(STORAGE_KEYS.PRICING_CALCULATOR_STATE);
      return true;
    } catch (error) {
      console.error('❌ Erro ao limpar calculadora:', error);
      return false;
    }
  }

  // Validação
  async validateSystem(): Promise<DadosValidacao> {
    const agora = new Date().toISOString();
    
    try {
      const estrutura = await this.loadEstruturaCustos();
      const horas = await this.loadPadraoHoras();
      const metas = await this.loadMetas();
      
      const errosEstrutura = this.validateEstruturaCustos(estrutura);
      const horasValido = horas.horasDisponiveis > 0 && horas.diasTrabalhados > 0;
      const metasValido = metas.margemLucroDesejada >= 0;
      
      return {
        estruturaCustos: errosEstrutura.length === 0,
        padraoHoras: horasValido,
        metas: metasValido,
        calculadora: true, // Optional
        ultimaValidacao: agora
      };
    } catch (error) {
      console.error('❌ Erro na validação:', error);
      return {
        estruturaCustos: false,
        padraoHoras: false,
        metas: false,
        calculadora: false,
        ultimaValidacao: agora
      };
    }
  }

  // Backup
  async exportData(): Promise<string> {
    const backup: BackupPrecificacao = {
      versao: '1.0.0',
      dataExport: new Date().toISOString(),
      user_id: this.config.userId,
      estruturaCustos: await this.loadEstruturaCustos(),
      padraoHoras: await this.loadPadraoHoras(),
      metas: await this.loadMetas(),
      estadosCalculadora: [],
      configuracaoSistema: {
        versaoApp: '1.0.0',
        chavesStorage: Object.values(STORAGE_KEYS).filter(key => 
          key.includes('pricing') || key.includes('PRICING')
        )
      }
    };

    const calculadora = await this.loadCalculadora();
    if (calculadora) {
      backup.estadosCalculadora = [calculadora];
    }

    return JSON.stringify(backup, null, 2);
  }

  async importData(data: string): Promise<boolean> {
    try {
      const backup: BackupPrecificacao = JSON.parse(data);
      
      await this.saveEstruturaCustos(backup.estruturaCustos);
      await this.savePadraoHoras(backup.padraoHoras);
      await this.saveMetas(backup.metas);
      
      if (backup.estadosCalculadora.length > 0) {
        await this.saveCalculadora(backup.estadosCalculadora[0]);
      }
      
      return true;
    } catch (error) {
      console.error('❌ Erro ao importar dados:', error);
      return false;
    }
  }

  // Métodos privados
  private createDefaultEstruturaCustos(): EstruturaCustomerFixos {
    return {
      gastosPessoais: [],
      percentualProLabore: 30,
      custosEstudio: [],
      equipamentos: [],
      totalCalculado: 0,
      user_id: this.config.userId,
      created_at: new Date().toISOString()
    };
  }

  private createDefaultPadraoHoras(): PadraoHoras {
    return {
      horasDisponiveis: 8,
      diasTrabalhados: 5,
      user_id: this.config.userId,
      created_at: new Date().toISOString()
    };
  }

  private createDefaultMetas(): MetasPrecificacao {
    const currentYear = new Date().getFullYear();
    return {
      margemLucroDesejada: 30,
      ano: currentYear,
      metaFaturamentoAnual: 0,
      metaLucroAnual: 0,
      user_id: this.config.userId,
      created_at: new Date().toISOString()
    };
  }

  private validateEstruturaCustos(dados: EstruturaCustomerFixos): string[] {
    const erros = [];
    
    if (dados.percentualProLabore < 0 || dados.percentualProLabore > 200) {
      erros.push('Percentual de pró-labore deve estar entre 0% e 200%');
    }
    
    dados.gastosPessoais.forEach((gasto, index) => {
      if (!gasto.descricao || gasto.descricao.trim() === '') {
        erros.push(`Gasto pessoal ${index + 1}: Descrição é obrigatória`);
      }
      if (gasto.valor < 0) {
        erros.push(`Gasto pessoal ${index + 1}: Valor não pode ser negativo`);
      }
    });
    
    dados.equipamentos.forEach((eq, index) => {
      if (!eq.nome || eq.nome.trim() === '') {
        erros.push(`Equipamento ${index + 1}: Nome é obrigatório`);
      }
      if (eq.valorPago < 0) {
        erros.push(`Equipamento ${index + 1}: Valor pago não pode ser negativo`);
      }
      if (eq.vidaUtil <= 0) {
        erros.push(`Equipamento ${index + 1}: Vida útil deve ser maior que zero`);
      }
    });
    
    return erros;
  }
}