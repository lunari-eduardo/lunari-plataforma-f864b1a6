/**
 * Pricing Backup Service
 * Specialized service for backup, export, and import operations
 */

import type { PricingStorageAdapter } from './PricingStorageAdapter';
import type { BackupPrecificacao } from '@/types/precificacao';

export class PricingBackupService {
  private adapter: PricingStorageAdapter;

  constructor(adapter: PricingStorageAdapter) {
    this.adapter = adapter;
  }

  async criarBackup(): Promise<BackupPrecificacao> {
    try {
      console.log('📦 Criando backup completo...');
      
      const estruturaCustos = await this.adapter.loadEstruturaCustos();
      const padraoHoras = await this.adapter.loadPadraoHoras();
      const metas = await this.adapter.loadMetas();
      const calculadora = await this.adapter.loadCalculadora();
      
      const backup: BackupPrecificacao = {
        versao: '1.0.0',
        dataExport: new Date().toISOString(),
        estruturaCustos,
        padraoHoras,
        metas,
        estadosCalculadora: calculadora ? [calculadora] : [],
        configuracaoSistema: {
          versaoApp: '1.0.0',
          chavesStorage: [
            'PRICING_FIXED_COSTS',
            'PRICING_HOUR_DEFAULTS', 
            'PRICING_GOALS',
            'PRICING_CALCULATOR_STATE'
          ]
        }
      };
      
      console.log('✅ Backup criado com sucesso');
      return backup;
      
    } catch (error) {
      console.error('❌ Erro ao criar backup:', error);
      throw error;
    }
  }

  async exportarJSON(): Promise<string> {
    try {
      const backup = await this.criarBackup();
      const jsonData = JSON.stringify(backup, null, 2);
      
      console.log('📤 Dados exportados em formato JSON');
      return jsonData;
      
    } catch (error) {
      console.error('❌ Erro ao exportar JSON:', error);
      throw error;
    }
  }

  async downloadBackup(): Promise<void> {
    try {
      console.log('📥 Iniciando download do backup...');
      
      const backupData = await this.exportarJSON();
      const blob = new Blob([backupData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup-precificacao-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      console.log('✅ Backup baixado com sucesso');
      
    } catch (error) {
      console.error('❌ Erro no download do backup:', error);
      throw error;
    }
  }

  async importarBackup(jsonData: string): Promise<boolean> {
    try {
      console.log('📤 Importando backup...');
      
      const backup: BackupPrecificacao = JSON.parse(jsonData);
      
      // Validar estrutura do backup
      if (!this.validarEstruturBackup(backup)) {
        throw new Error('Estrutura do backup inválida');
      }
      
      // Importar dados
      const success = await this.adapter.importData(jsonData);
      
      if (success) {
        console.log('✅ Backup importado com sucesso');
      } else {
        console.error('❌ Falha ao importar backup');
      }
      
      return success;
      
    } catch (error) {
      console.error('❌ Erro ao importar backup:', error);
      return false;
    }
  }

  async importarArquivo(file: File): Promise<boolean> {
    try {
      console.log('📄 Importando arquivo:', file.name);
      
      const text = await this.lerArquivo(file);
      return await this.importarBackup(text);
      
    } catch (error) {
      console.error('❌ Erro ao importar arquivo:', error);
      return false;
    }
  }

  async exportarRelatorio(): Promise<string> {
    try {
      const backup = await this.criarBackup();
      
      // Criar relatório resumido
      const relatorio = {
        dataExport: backup.dataExport,
        versao: backup.versao,
        resumo: {
          totalGastosPessoais: backup.estruturaCustos.gastosPessoais.length,
          totalCustosEstudio: backup.estruturaCustos.custosEstudio.length,
          totalEquipamentos: backup.estruturaCustos.equipamentos.length,
          custosFixosTotal: backup.estruturaCustos.totalCalculado,
          margemLucroDesejada: backup.metas.margemLucroDesejada,
          metaFaturamentoAnual: backup.metas.metaFaturamentoAnual,
          horasDisponiveis: backup.padraoHoras.horasDisponiveis,
          diasTrabalhados: backup.padraoHoras.diasTrabalhados,
          temCalculadoraSalva: backup.estadosCalculadora.length > 0
        }
      };
      
      return JSON.stringify(relatorio, null, 2);
      
    } catch (error) {
      console.error('❌ Erro ao exportar relatório:', error);
      throw error;
    }
  }

  async obterEstatisticasBackup(): Promise<{
    tamanhoEstimado: number;
    itensIncluidos: string[];
    ultimoBackup?: string;
  }> {
    try {
      const jsonData = await this.exportarJSON();
      const tamanhoEstimado = new Blob([jsonData]).size;
      
      const itensIncluidos = [
        'Estrutura de custos fixos',
        'Padrão de horas de trabalho', 
        'Metas e objetivos',
        'Estado da calculadora (se houver)'
      ];
      
      return {
        tamanhoEstimado,
        itensIncluidos,
        ultimoBackup: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Erro ao obter estatísticas:', error);
      return {
        tamanhoEstimado: 0,
        itensIncluidos: []
      };
    }
  }

  // Métodos privados
  private validarEstruturBackup(backup: BackupPrecificacao): boolean {
    try {
      return (
        backup.versao &&
        backup.dataExport &&
        backup.estruturaCustos &&
        backup.padraoHoras &&
        backup.metas &&
        Array.isArray(backup.estadosCalculadora)
      );
    } catch {
      return false;
    }
  }

  private lerArquivo(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const text = e.target?.result as string;
        resolve(text);
      };
      
      reader.onerror = () => {
        reject(new Error('Erro ao ler o arquivo'));
      };
      
      reader.readAsText(file);
    });
  }
}