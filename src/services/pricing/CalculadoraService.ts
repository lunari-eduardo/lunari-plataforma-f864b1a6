/**
 * Calculadora Service
 * Specialized service for pricing calculator logic
 */

import type { PricingStorageAdapter } from './PricingStorageAdapter';
import type { EstadoCalculadora, ProdutoAdicional, CustoExtra } from '@/types/precificacao';

export class CalculadoraService {
  private adapter: PricingStorageAdapter;

  constructor(adapter: PricingStorageAdapter) {
    this.adapter = adapter;
  }

  async salvar(dados: EstadoCalculadora, autoSave = true): Promise<boolean> {
    try {
      const dadosComMetadata = {
        ...dados,
        salvo_automaticamente: autoSave,
        updated_at: new Date().toISOString()
      };
      
      const success = await this.adapter.saveCalculadora(dadosComMetadata);
      
      if (success) {
        if (autoSave) {
          console.log('✅ Estado da calculadora salvo automaticamente');
        } else {
          console.log('✅ Estado da calculadora salvo manualmente');
        }
      }
      return success;
    } catch (error) {
      console.error('❌ Erro ao salvar estado da calculadora:', error);
      return false;
    }
  }

  async carregar(): Promise<EstadoCalculadora | null> {
    try {
      const dados = await this.adapter.loadCalculadora();
      
      if (dados) {
        console.log('✅ Estado da calculadora carregado');
        return dados;
      } else {
        console.log('ℹ️ Nenhum estado da calculadora encontrado');
        return null;
      }
    } catch (error) {
      console.error('❌ Erro ao carregar estado da calculadora:', error);
      return null;
    }
  }

  async limpar(): Promise<boolean> {
    try {
      const success = await this.adapter.clearCalculadora();
      if (success) {
        console.log('✅ Estado da calculadora limpo');
      }
      return success;
    } catch (error) {
      console.error('❌ Erro ao limpar estado da calculadora:', error);
      return false;
    }
  }

  criarPadrao(): EstadoCalculadora {
    return {
      horasEstimadas: 0,
      markup: 2,
      produtos: [],
      custosExtras: [],
      custoTotalCalculado: 0,
      precoFinalCalculado: 0,
      lucratividade: 0,
      salvo_automaticamente: false,
      created_at: new Date().toISOString()
    };
  }

  calcularPrecoFinal(
    horasEstimadas: number,
    custosFixosHora: number,
    markup: number,
    produtos: ProdutoAdicional[] = [],
    custosExtras: CustoExtra[] = []
  ): {
    custoTotalCalculado: number;
    precoFinalCalculado: number;
    lucratividade: number;
  } {
    // Custo base das horas
    const custoHoras = horasEstimadas * custosFixosHora;
    
    // Custo dos produtos adicionais
    const custoProdutos = produtos.reduce((total, produto) => {
      return total + (produto.custo * produto.quantidade);
    }, 0);
    
    // Custos extras
    const custosAdicionais = custosExtras.reduce((total, custo) => {
      return total + (custo.valorUnitario * custo.quantidade);
    }, 0);
    
    // Custo total
    const custoTotalCalculado = custoHoras + custoProdutos + custosAdicionais;
    
    // Preço final com markup
    const precoFinalCalculado = custoTotalCalculado * markup;
    
    // Lucratividade
    const lucro = precoFinalCalculado - custoTotalCalculado;
    const lucratividade = precoFinalCalculado > 0 ? (lucro / precoFinalCalculado) * 100 : 0;
    
    return {
      custoTotalCalculado,
      precoFinalCalculado,
      lucratividade
    };
  }

  async adicionarProduto(produto: Omit<ProdutoAdicional, 'id'>): Promise<boolean> {
    try {
      const estadoAtual = await this.carregar();
      if (!estadoAtual) return false;
      
      const novoProduto: ProdutoAdicional = {
        ...produto,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
      };
      
      const produtosAtualizados = [...estadoAtual.produtos, novoProduto];
      
      // Recalcular preços
      const calculos = this.calcularPrecoFinal(
        estadoAtual.horasEstimadas,
        0, // Será calculado pelo componente
        estadoAtual.markup,
        produtosAtualizados,
        estadoAtual.custosExtras
      );
      
      const estadoAtualizado: EstadoCalculadora = {
        ...estadoAtual,
        produtos: produtosAtualizados,
        ...calculos
      };
      
      return await this.salvar(estadoAtualizado, true);
    } catch (error) {
      console.error('❌ Erro ao adicionar produto:', error);
      return false;
    }
  }

  async removerProduto(produtoId: string): Promise<boolean> {
    try {
      const estadoAtual = await this.carregar();
      if (!estadoAtual) return false;
      
      const produtosAtualizados = estadoAtual.produtos.filter(p => p.id !== produtoId);
      
      const estadoAtualizado: EstadoCalculadora = {
        ...estadoAtual,
        produtos: produtosAtualizados
      };
      
      return await this.salvar(estadoAtualizado, true);
    } catch (error) {
      console.error('❌ Erro ao remover produto:', error);
      return false;
    }
  }

  async adicionarCustoExtra(custo: Omit<CustoExtra, 'id'>): Promise<boolean> {
    try {
      const estadoAtual = await this.carregar();
      if (!estadoAtual) return false;
      
      const novoCusto: CustoExtra = {
        ...custo,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
      };
      
      const custosAtualizados = [...estadoAtual.custosExtras, novoCusto];
      
      const estadoAtualizado: EstadoCalculadora = {
        ...estadoAtual,
        custosExtras: custosAtualizados
      };
      
      return await this.salvar(estadoAtualizado, true);
    } catch (error) {
      console.error('❌ Erro ao adicionar custo extra:', error);
      return false;
    }
  }

  async removerCustoExtra(custoId: string): Promise<boolean> {
    try {
      const estadoAtual = await this.carregar();
      if (!estadoAtual) return false;
      
      const custosAtualizados = estadoAtual.custosExtras.filter(c => c.id !== custoId);
      
      const estadoAtualizado: EstadoCalculadora = {
        ...estadoAtual,
        custosExtras: custosAtualizados
      };
      
      return await this.salvar(estadoAtualizado, true);
    } catch (error) {
      console.error('❌ Erro ao remover custo extra:', error);
      return false;
    }
  }

  async atualizarHoras(horas: number): Promise<boolean> {
    try {
      const estadoAtual = await this.carregar();
      if (!estadoAtual) return false;
      
      const estadoAtualizado: EstadoCalculadora = {
        ...estadoAtual,
        horasEstimadas: horas
      };
      
      return await this.salvar(estadoAtualizado, true);
    } catch (error) {
      console.error('❌ Erro ao atualizar horas:', error);
      return false;
    }
  }

  async atualizarMarkup(markup: number): Promise<boolean> {
    try {
      const estadoAtual = await this.carregar();
      if (!estadoAtual) return false;
      
      const estadoAtualizado: EstadoCalculadora = {
        ...estadoAtual,
        markup: markup
      };
      
      return await this.salvar(estadoAtualizado, true);
    } catch (error) {
      console.error('❌ Erro ao atualizar markup:', error);
      return false;
    }
  }
}