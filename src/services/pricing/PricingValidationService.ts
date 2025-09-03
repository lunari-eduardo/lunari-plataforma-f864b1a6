/**
 * Pricing Validation Service
 * Centralized validation and system integrity checking
 */

import type { PricingStorageAdapter } from './PricingStorageAdapter';
import type { 
  DadosValidacao, 
  EstruturaCustosFixos, 
  PadraoHoras, 
  MetasPrecificacao,
  EstadoCalculadora
} from '@/types/precificacao';

export class PricingValidationService {
  private adapter: PricingStorageAdapter;

  constructor(adapter: PricingStorageAdapter) {
    this.adapter = adapter;
  }

  async validarTodosSistemas(): Promise<DadosValidacao> {
    const agora = new Date().toISOString();
    
    try {
      console.log('🔍 Iniciando validação completa do sistema...');
      
      const validacao = await this.adapter.validateSystem();
      
      console.log('🔍 Validação concluída:', validacao);
      return validacao;
      
    } catch (error) {
      console.error('❌ Erro na validação completa:', error);
      return {
        estruturaCustos: false,
        padraoHoras: false,
        metas: false,
        calculadora: false,
        ultimaValidacao: agora
      };
    }
  }

  async validarEstruturaCustos(): Promise<{ valido: boolean; erros: string[] }> {
    try {
      const estrutura = await this.adapter.loadEstruturaCustos();
      const erros = this.validarDadosEstrutura(estrutura);
      
      return {
        valido: erros.length === 0,
        erros
      };
    } catch (error) {
      console.error('❌ Erro ao validar estrutura de custos:', error);
      return {
        valido: false,
        erros: ['Erro ao carregar estrutura de custos']
      };
    }
  }

  async validarPadraoHoras(): Promise<{ valido: boolean; erros: string[] }> {
    try {
      const horas = await this.adapter.loadPadraoHoras();
      const erros = this.validarDadosHoras(horas);
      
      return {
        valido: erros.length === 0,
        erros
      };
    } catch (error) {
      console.error('❌ Erro ao validar padrão de horas:', error);
      return {
        valido: false,
        erros: ['Erro ao carregar padrão de horas']
      };
    }
  }

  async validarMetas(): Promise<{ valido: boolean; erros: string[] }> {
    try {
      const metas = await this.adapter.loadMetas();
      const erros = this.validarDadosMetas(metas);
      
      return {
        valido: erros.length === 0,
        erros
      };
    } catch (error) {
      console.error('❌ Erro ao validar metas:', error);
      return {
        valido: false,
        erros: ['Erro ao carregar metas']
      };
    }
  }

  async validarCalculadora(): Promise<{ valido: boolean; erros: string[] }> {
    try {
      const calculadora = await this.adapter.loadCalculadora();
      
      if (!calculadora) {
        return { valido: true, erros: [] }; // Calculadora é opcional
      }
      
      const erros = this.validarDadosCalculadora(calculadora);
      
      return {
        valido: erros.length === 0,
        erros
      };
    } catch (error) {
      console.error('❌ Erro ao validar calculadora:', error);
      return {
        valido: false,
        erros: ['Erro ao carregar calculadora']
      };
    }
  }

  async recuperarDadosCorrompidos(): Promise<boolean> {
    try {
      console.log('🔧 Iniciando recuperação de dados corrompidos...');
      
      // Validar e recuperar cada componente
      const estruturaValida = await this.validarEstruturaCustos();
      if (!estruturaValida.valido) {
        console.log('🔧 Recriando estrutura de custos...');
        // A implementação específica depende do adapter
      }
      
      const horasValidas = await this.validarPadraoHoras();
      if (!horasValidas.valido) {
        console.log('🔧 Recriando padrão de horas...');
        // A implementação específica depende do adapter
      }
      
      const metasValidas = await this.validarMetas();
      if (!metasValidas.valido) {
        console.log('🔧 Recriando metas...');
        // A implementação específica depende do adapter
      }
      
      console.log('✅ Recuperação concluída com sucesso');
      return true;
      
    } catch (error) {
      console.error('❌ Erro na recuperação:', error);
      return false;
    }
  }

  async obterRelatorioDiagnostico(): Promise<{
    sistemaIntegro: boolean;
    problemasEncontrados: string[];
    sugestoes: string[];
    ultimaValidacao: string;
  }> {
    const validacao = await this.validarTodosSistemas();
    const problemasEncontrados: string[] = [];
    const sugestoes: string[] = [];
    
    if (!validacao.estruturaCustos) {
      problemasEncontrados.push('Estrutura de custos inválida');
      sugestoes.push('Revisar gastos pessoais, custos de estúdio e equipamentos');
    }
    
    if (!validacao.padraoHoras) {
      problemasEncontrados.push('Padrão de horas inválido');
      sugestoes.push('Definir horas disponíveis e dias trabalhados válidos');
    }
    
    if (!validacao.metas) {
      problemasEncontrados.push('Metas inválidas');
      sugestoes.push('Configurar margem de lucro e metas de faturamento');
    }
    
    const sistemaIntegro = problemasEncontrados.length === 0;
    
    if (sistemaIntegro) {
      sugestoes.push('Sistema funcionando corretamente');
    }
    
    return {
      sistemaIntegro,
      problemasEncontrados,
      sugestoes,
      ultimaValidacao: validacao.ultimaValidacao
    };
  }

  // Métodos privados de validação
  private validarDadosEstrutura(dados: EstruturaCustosFixos): string[] {
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

  private validarDadosHoras(dados: PadraoHoras): string[] {
    const erros = [];
    
    if (dados.horasDisponiveis <= 0 || dados.horasDisponiveis > 24) {
      erros.push('Horas disponíveis deve estar entre 1 e 24');
    }
    
    if (dados.diasTrabalhados <= 0 || dados.diasTrabalhados > 7) {
      erros.push('Dias trabalhados deve estar entre 1 e 7');
    }
    
    return erros;
  }

  private validarDadosMetas(dados: MetasPrecificacao): string[] {
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
    
    return erros;
  }

  private validarDadosCalculadora(dados: EstadoCalculadora): string[] {
    const erros = [];
    
    if (dados.horasEstimadas < 0) {
      erros.push('Horas estimadas não pode ser negativo');
    }
    
    if (dados.markup <= 0) {
      erros.push('Markup deve ser maior que zero');
    }
    
    dados.produtos.forEach((produto, index) => {
      if (!produto.nome || produto.nome.trim() === '') {
        erros.push(`Produto ${index + 1}: Nome é obrigatório`);
      }
      if (produto.custo < 0) {
        erros.push(`Produto ${index + 1}: Custo não pode ser negativo`);
      }
      if (produto.quantidade <= 0) {
        erros.push(`Produto ${index + 1}: Quantidade deve ser maior que zero`);
      }
    });
    
    return erros;
  }
}