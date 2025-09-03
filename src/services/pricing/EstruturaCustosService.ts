/**
 * Estrutura de Custos Service
 * Specialized service for fixed costs management
 */

import type { PricingStorageAdapter } from './PricingStorageAdapter';
import type { EstruturaCustomerFixos, Equipamento, GastoItem } from '@/types/precificacao';

export class EstruturaCustosService {
  private adapter: PricingStorageAdapter;

  constructor(adapter: PricingStorageAdapter) {
    this.adapter = adapter;
  }

  async salvar(dados: EstruturaCustomerFixos): Promise<boolean> {
    try {
      const success = await this.adapter.saveEstruturaCustos(dados);
      if (success) {
        console.log('✅ Estrutura de custos salva com sucesso');
      }
      return success;
    } catch (error) {
      console.error('❌ Erro ao salvar estrutura de custos:', error);
      return false;
    }
  }

  async carregar(): Promise<EstruturaCustomerFixos> {
    try {
      const dados = await this.adapter.loadEstruturaCustos();
      console.log('✅ Estrutura de custos carregada');
      return dados;
    } catch (error) {
      console.error('❌ Erro ao carregar estrutura de custos:', error);
      throw error;
    }
  }

  async adicionarEquipamento(equipamento: {
    nome: string;
    valorPago: number;
    dataCompra: string;
    vidaUtil: number;
  }): Promise<boolean> {
    try {
      console.log('🔧 Adicionando equipamento:', equipamento);
      
      const dadosAtuais = await this.carregar();
      
      const novoEquipamento: Equipamento = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        nome: equipamento.nome,
        valorPago: equipamento.valorPago,
        dataCompra: equipamento.dataCompra || new Date().toISOString().split('T')[0],
        vidaUtil: equipamento.vidaUtil || 5
      };
      
      const equipamentosAtualizados = [...dadosAtuais.equipamentos, novoEquipamento];
      const novoTotal = this.calcularTotal({
        ...dadosAtuais,
        equipamentos: equipamentosAtualizados
      });
      
      const dadosAtualizados: EstruturaCustomerFixos = {
        ...dadosAtuais,
        equipamentos: equipamentosAtualizados,
        totalCalculado: novoTotal
      };
      
      const sucesso = await this.salvar(dadosAtualizados);
      
      if (sucesso) {
        console.log('✅ Equipamento adicionado com sucesso');
      }
      return sucesso;
      
    } catch (error) {
      console.error('❌ Erro ao adicionar equipamento:', error);
      return false;
    }
  }

  async adicionarGastoPessoal(gasto: Omit<GastoItem, 'id'>): Promise<boolean> {
    try {
      const dadosAtuais = await this.carregar();
      
      const novoGasto: GastoItem = {
        ...gasto,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
      };
      
      const gastosAtualizados = [...dadosAtuais.gastosPessoais, novoGasto];
      const novoTotal = this.calcularTotal({
        ...dadosAtuais,
        gastosPessoais: gastosAtualizados
      });
      
      const dadosAtualizados: EstruturaCustomerFixos = {
        ...dadosAtuais,
        gastosPessoais: gastosAtualizados,
        totalCalculado: novoTotal
      };
      
      return await this.salvar(dadosAtualizados);
    } catch (error) {
      console.error('❌ Erro ao adicionar gasto pessoal:', error);
      return false;
    }
  }

  async adicionarCustoEstudio(custo: Omit<GastoItem, 'id'>): Promise<boolean> {
    try {
      const dadosAtuais = await this.carregar();
      
      const novoCusto: GastoItem = {
        ...custo,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
      };
      
      const custosAtualizados = [...dadosAtuais.custosEstudio, novoCusto];
      const novoTotal = this.calcularTotal({
        ...dadosAtuais,
        custosEstudio: custosAtualizados
      });
      
      const dadosAtualizados: EstruturaCustomerFixos = {
        ...dadosAtuais,
        custosEstudio: custosAtualizados,
        totalCalculado: novoTotal
      };
      
      return await this.salvar(dadosAtualizados);
    } catch (error) {
      console.error('❌ Erro ao adicionar custo de estúdio:', error);
      return false;
    }
  }

  async removerItem(tipo: 'gastosPessoais' | 'custosEstudio' | 'equipamentos', itemId: string): Promise<boolean> {
    try {
      const dadosAtuais = await this.carregar();
      
      const dadosAtualizados = {
        ...dadosAtuais,
        [tipo]: dadosAtuais[tipo].filter(item => item.id !== itemId)
      };
      
      dadosAtualizados.totalCalculado = this.calcularTotal(dadosAtualizados);
      
      return await this.salvar(dadosAtualizados);
    } catch (error) {
      console.error(`❌ Erro ao remover item de ${tipo}:`, error);
      return false;
    }
  }

  async atualizarPercentualProLabore(percentual: number): Promise<boolean> {
    try {
      const dadosAtuais = await this.carregar();
      
      const dadosAtualizados: EstruturaCustomerFixos = {
        ...dadosAtuais,
        percentualProLabore: percentual,
        totalCalculado: this.calcularTotal({
          ...dadosAtuais,
          percentualProLabore: percentual
        })
      };
      
      return await this.salvar(dadosAtualizados);
    } catch (error) {
      console.error('❌ Erro ao atualizar percentual pró-labore:', error);
      return false;
    }
  }

  calcularTotal(dados: EstruturaCustomerFixos): number {
    // Gastos pessoais + pró-labore
    const totalGastosPessoais = dados.gastosPessoais.reduce((total, item) => total + item.valor, 0);
    const proLaboreCalculado = totalGastosPessoais * (1 + dados.percentualProLabore / 100);
    
    // Custos do estúdio
    const totalCustosEstudio = dados.custosEstudio.reduce((total, item) => total + item.valor, 0);
    
    // Depreciação mensal dos equipamentos
    const totalDepreciacaoMensal = dados.equipamentos.reduce((total, eq) => {
      return total + (eq.valorPago / (eq.vidaUtil * 12));
    }, 0);
    
    return proLaboreCalculado + totalCustosEstudio + totalDepreciacaoMensal;
  }

  validar(dados: EstruturaCustomerFixos): string[] {
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