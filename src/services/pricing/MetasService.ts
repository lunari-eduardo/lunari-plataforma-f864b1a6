/**
 * Metas Service
 * Specialized service for goals and targets management
 */

import type { PricingStorageAdapter } from './PricingStorageAdapter';
import type { MetasPrecificacao } from '@/types/precificacao';

export class MetasService {
  private adapter: PricingStorageAdapter;

  constructor(adapter: PricingStorageAdapter) {
    this.adapter = adapter;
  }

  async salvar(dados: MetasPrecificacao): Promise<boolean> {
    try {
      const success = await this.adapter.saveMetas(dados);
      if (success) {
        console.log('✅ Metas salvas com sucesso');
      }
      return success;
    } catch (error) {
      console.error('❌ Erro ao salvar metas:', error);
      return false;
    }
  }

  async carregar(): Promise<MetasPrecificacao> {
    try {
      const dados = await this.adapter.loadMetas();
      console.log('✅ Metas carregadas');
      return dados;
    } catch (error) {
      console.error('❌ Erro ao carregar metas:', error);
      throw error;
    }
  }

  async atualizarMargemLucro(margem: number): Promise<boolean> {
    try {
      const dadosAtuais = await this.carregar();
      
      const dadosAtualizados: MetasPrecificacao = {
        ...dadosAtuais,
        margemLucroDesejada: margem,
        updated_at: new Date().toISOString()
      };
      
      return await this.salvar(dadosAtualizados);
    } catch (error) {
      console.error('❌ Erro ao atualizar margem de lucro:', error);
      return false;
    }
  }

  async calcularMetasAnuais(
    custosFixosMensais: number,
    margemLucroDesejada?: number
  ): Promise<{
    faturamentoMinimoAnual: number;
    metaFaturamentoAnual: number;
    metaFaturamentoMensal: number;
    metaLucroAnual: number;
  }> {
    try {
      const metas = await this.carregar();
      const margemAtual = margemLucroDesejada ?? metas.margemLucroDesejada;
      
      const faturamentoMinimoAnual = custosFixosMensais * 12;
      const metaFaturamentoAnual = faturamentoMinimoAnual / (1 - margemAtual / 100);
      const metaFaturamentoMensal = metaFaturamentoAnual / 12;
      const metaLucroAnual = metaFaturamentoAnual - faturamentoMinimoAnual;
      
      // Atualizar metas calculadas
      await this.salvar({
        ...metas,
        margemLucroDesejada: margemAtual,
        metaFaturamentoAnual,
        metaLucroAnual
      });
      
      return {
        faturamentoMinimoAnual,
        metaFaturamentoAnual,
        metaFaturamentoMensal,
        metaLucroAnual
      };
    } catch (error) {
      console.error('❌ Erro ao calcular metas anuais:', error);
      throw error;
    }
  }

  validar(dados: MetasPrecificacao): string[] {
    const erros = [];
    
    if (dados.margemLucroDesejada < 0) {
      erros.push('Margem de lucro não pode ser negativa');
    }
    
    if (dados.margemLucroDesejada > 100) {
      erros.push('Margem de lucro não pode ser superior a 100%');
    }
    
    if (dados.metaFaturamentoAnual < 0) {
      erros.push('Meta de faturamento anual não pode ser negativa');
    }
    
    if (dados.metaLucroAnual < 0) {
      erros.push('Meta de lucro anual não pode ser negativa');
    }
    
    const anoAtual = new Date().getFullYear();
    if (dados.ano < anoAtual - 5 || dados.ano > anoAtual + 10) {
      erros.push('Ano deve estar entre ' + (anoAtual - 5) + ' e ' + (anoAtual + 10));
    }
    
    return erros;
  }

  async obterHistoricoMetas(): Promise<MetasPrecificacao[]> {
    // Esta funcionalidade pode ser expandida no futuro
    // Por agora, retorna apenas as metas atuais
    try {
      const metasAtuais = await this.carregar();
      return [metasAtuais];
    } catch (error) {
      console.error('❌ Erro ao obter histórico de metas:', error);
      return [];
    }
  }
}