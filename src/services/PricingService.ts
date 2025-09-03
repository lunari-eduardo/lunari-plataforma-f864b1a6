/**
 * Serviço de Precificação - Camada de Abstração para Dados
 * Preparado para migração Supabase multi-usuário
 */

import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import type {
  EstruturaCustosFixos,
  PadraoHoras,
  MetasPrecificacao,
  EstadoCalculadora,
  DadosValidacao,
  BackupPrecificacao,
  StatusSalvamento,
  IndicadorSalvamento
} from '@/types/precificacao';

// ============= CONFIGURAÇÃO =============

const VERSAO_ATUAL = '1.0.0';
const USUARIO_LOCAL = 'local_user'; // Para modo local

// ============= ESTRUTURA DE CUSTOS FIXOS =============

export class EstruturaCustosService {
  static salvar(dados: EstruturaCustosFixos): boolean {
    try {
      const dadosComMetadata = {
        ...dados,
        user_id: USUARIO_LOCAL,
        updated_at: new Date().toISOString()
      };
      
      storage.save(STORAGE_KEYS.PRICING_FIXED_COSTS, dadosComMetadata);
      console.log('✅ Estrutura de custos salva com sucesso');
      return true;
    } catch (error) {
      console.error('❌ Erro ao salvar estrutura de custos:', error);
      return false;
    }
  }

  static carregar(): EstruturaCustosFixos {
    try {
      const defaults = {
        gastosPessoais: [],
        percentualProLabore: 30,
        custosEstudio: [],
        equipamentos: [],
        totalCalculado: 0,
        user_id: USUARIO_LOCAL,
        created_at: new Date().toISOString()
      };
      const dadosBrutos = storage.load(STORAGE_KEYS.PRICING_FIXED_COSTS, defaults);
      const dados = {
        ...defaults,
        ...dadosBrutos,
        gastosPessoais: Array.isArray(dadosBrutos?.gastosPessoais) ? dadosBrutos.gastosPessoais : [],
        custosEstudio: Array.isArray(dadosBrutos?.custosEstudio) ? dadosBrutos.custosEstudio : [],
        equipamentos: Array.isArray(dadosBrutos?.equipamentos) ? dadosBrutos.equipamentos : []
      } as EstruturaCustosFixos;
      
      console.log('✅ Estrutura de custos carregada');
      return dados;
    } catch (error) {
      console.error('❌ Erro ao carregar estrutura de custos:', error);
      return this.criarPadrao();
    }
  }

  static criarPadrao(): EstruturaCustosFixos {
    return {
      gastosPessoais: [],
      percentualProLabore: 30,
      custosEstudio: [],
      equipamentos: [],
      totalCalculado: 0,
      user_id: USUARIO_LOCAL,
      created_at: new Date().toISOString()
    };
  }

  static validar(dados: EstruturaCustosFixos): string[] {
    const erros = [];
    
    if (dados.percentualProLabore < 0 || dados.percentualProLabore > 200) {
      erros.push('Percentual de pró-labore deve estar entre 0% e 200%');
    }
    
    // Validar gastos pessoais
    dados.gastosPessoais.forEach((gasto, index) => {
      if (!gasto.descricao || gasto.descricao.trim() === '') {
        erros.push(`Gasto pessoal ${index + 1}: Descrição é obrigatória`);
      }
      if (gasto.valor < 0) {
        erros.push(`Gasto pessoal ${index + 1}: Valor não pode ser negativo`);
      }
    });
    
    // Validar equipamentos
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

  /**
   * NOVA FUNÇÃO: Adiciona um equipamento diretamente à estrutura existente
   */
  static adicionarEquipamento(equipamento: {
    nome: string;
    valorPago: number;
    dataCompra: string;
    vidaUtil: number;
  }): boolean {
    try {
      console.log('🔧 [EstruturaCustos] Adicionando equipamento:', equipamento);
      
      // Carregar dados atuais
      const dadosAtuais = this.carregar();
      
      // Criar novo equipamento
      const novoEquipamento = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        nome: equipamento.nome,
        valorPago: equipamento.valorPago,
        dataCompra: equipamento.dataCompra || new Date().toISOString().split('T')[0],
        vidaUtil: equipamento.vidaUtil || 5
      };
      
      // Adicionar à lista
      const equipamentosAtualizados = [...dadosAtuais.equipamentos, novoEquipamento];
      
      // Recalcular total
      const totalDepreciacaoMensal = equipamentosAtualizados.reduce((total, eq) => {
        return total + (eq.valorPago / (eq.vidaUtil * 12));
      }, 0);
      
      const totalGastosPessoais = dadosAtuais.gastosPessoais.reduce((total, item) => total + item.valor, 0);
      const proLaboreCalculado = totalGastosPessoais * (1 + dadosAtuais.percentualProLabore / 100);
      const totalCustosEstudio = dadosAtuais.custosEstudio.reduce((total, item) => total + item.valor, 0);
      const novoTotal = proLaboreCalculado + totalCustosEstudio + totalDepreciacaoMensal;
      
      // Salvar dados atualizados
      const dadosAtualizados = {
        ...dadosAtuais,
        equipamentos: equipamentosAtualizados,
        totalCalculado: novoTotal
      };
      
      const sucesso = this.salvar(dadosAtualizados);
      
      if (sucesso) {
        console.log('✅ [EstruturaCustos] Equipamento adicionado com sucesso');
        return true;
      } else {
        console.error('❌ [EstruturaCustos] Falha ao salvar equipamento');
        return false;
      }
      
    } catch (error) {
      console.error('❌ [EstruturaCustos] Erro ao adicionar equipamento:', error);
      return false;
    }
  }
}

// ============= PADRÃO DE HORAS =============

export class PadraoHorasService {
  static salvar(dados: PadraoHoras): boolean {
    try {
      const dadosComMetadata = {
        ...dados,
        user_id: USUARIO_LOCAL,
        updated_at: new Date().toISOString()
      };
      
      storage.save(STORAGE_KEYS.PRICING_HOUR_DEFAULTS, dadosComMetadata);
      console.log('✅ Padrão de horas salvo com sucesso');
      return true;
    } catch (error) {
      console.error('❌ Erro ao salvar padrão de horas:', error);
      return false;
    }
  }

  static carregar(): PadraoHoras {
    try {
      const dados = storage.load(STORAGE_KEYS.PRICING_HOUR_DEFAULTS, {
        horasDisponiveis: 8,
        diasTrabalhados: 5,
        user_id: USUARIO_LOCAL,
        created_at: new Date().toISOString()
      });
      
      console.log('✅ Padrão de horas carregado');
      return dados;
    } catch (error) {
      console.error('❌ Erro ao carregar padrão de horas:', error);
      return this.criarPadrao();
    }
  }

  static criarPadrao(): PadraoHoras {
    return {
      horasDisponiveis: 8,
      diasTrabalhados: 5,
      user_id: USUARIO_LOCAL,
      created_at: new Date().toISOString()
    };
  }
}

// ============= METAS DE PRECIFICAÇÃO =============

export class MetasService {
  static salvar(dados: MetasPrecificacao): boolean {
    try {
      const dadosComMetadata = {
        ...dados,
        user_id: USUARIO_LOCAL,
        updated_at: new Date().toISOString()
      };
      
      storage.save(STORAGE_KEYS.PRICING_GOALS, dadosComMetadata);
      console.log('✅ Metas salvas com sucesso');
      return true;
    } catch (error) {
      console.error('❌ Erro ao salvar metas:', error);
      return false;
    }
  }

  static carregar(): MetasPrecificacao {
    try {
      const currentYear = new Date().getFullYear();
      const dados = storage.load(STORAGE_KEYS.PRICING_GOALS, {
        margemLucroDesejada: 30,
        ano: currentYear,
        metaFaturamentoAnual: 0,
        metaLucroAnual: 0,
        user_id: USUARIO_LOCAL,
        created_at: new Date().toISOString()
      });
      
      console.log('✅ Metas carregadas');
      return dados;
    } catch (error) {
      console.error('❌ Erro ao carregar metas:', error);
      return this.criarPadrao();
    }
  }

  static criarPadrao(): MetasPrecificacao {
    const currentYear = new Date().getFullYear();
    return {
      margemLucroDesejada: 30,
      ano: currentYear,
      metaFaturamentoAnual: 0,
      metaLucroAnual: 0,
      user_id: USUARIO_LOCAL,
      created_at: new Date().toISOString()
    };
  }
}

// ============= ESTADO DA CALCULADORA =============

export class CalculadoraService {
  static salvar(dados: EstadoCalculadora, autoSave = true): boolean {
    try {
      const dadosComMetadata = {
        ...dados,
        user_id: USUARIO_LOCAL,
        salvo_automaticamente: autoSave,
        updated_at: new Date().toISOString()
      };
      
      storage.save(STORAGE_KEYS.PRICING_CALCULATOR_STATE, dadosComMetadata);
      if (autoSave) {
        console.log('✅ Estado da calculadora salvo automaticamente');
      } else {
        console.log('✅ Estado da calculadora salvo manualmente');
      }
      return true;
    } catch (error) {
      console.error('❌ Erro ao salvar estado da calculadora:', error);
      return false;
    }
  }

  static carregar(): EstadoCalculadora | null {
    try {
      const dados = storage.load(STORAGE_KEYS.PRICING_CALCULATOR_STATE, null);
      
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

  static limpar(): boolean {
    try {
      storage.remove(STORAGE_KEYS.PRICING_CALCULATOR_STATE);
      console.log('✅ Estado da calculadora limpo');
      return true;
    } catch (error) {
      console.error('❌ Erro ao limpar estado da calculadora:', error);
      return false;
    }
  }

  static criarPadrao(): EstadoCalculadora {
    return {
      horasEstimadas: 0,
      markup: 2,
      produtos: [],
      custosExtras: [],
      custoTotalCalculado: 0,
      precoFinalCalculado: 0,
      lucratividade: 0,
      salvo_automaticamente: false,
      user_id: USUARIO_LOCAL,
      created_at: new Date().toISOString()
    };
  }
}

// ============= VALIDAÇÃO E INTEGRIDADE =============

export class ValidacaoService {
  static validarTodosSistemas(): DadosValidacao {
    const agora = new Date().toISOString();
    
    try {
      // Validar estrutura de custos
      const estrutura = EstruturaCustosService.carregar();
      const errosEstrutura = EstruturaCustosService.validar(estrutura);
      
      // Validar padrão de horas  
      const horas = PadraoHorasService.carregar();
      const horasValido = horas.horasDisponiveis > 0 && horas.diasTrabalhados > 0;
      
      // Validar metas
      const metas = MetasService.carregar();
      const metasValido = metas.margemLucroDesejada >= 0;
      
      // Validar calculadora (pode não existir)
      const calculadora = CalculadoraService.carregar();
      const calculadoraValido = true; // Opcional
      
      const validacao: DadosValidacao = {
        estruturaCustos: errosEstrutura.length === 0,
        padraoHoras: horasValido,
        metas: metasValido,
        calculadora: calculadoraValido,
        ultimaValidacao: agora
      };
      
      console.log('🔍 Validação concluída:', validacao);
      return validacao;
      
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

  static recuperarDadosCorrompidos(): boolean {
    try {
      console.log('🔧 Iniciando recuperação de dados corrompidos...');
      
      // Verificar e recrear estrutura de custos se necessário
      try {
        EstruturaCustosService.carregar();
      } catch {
        console.log('🔧 Recriando estrutura de custos...');
        EstruturaCustosService.salvar(EstruturaCustosService.criarPadrao());
      }
      
      // Verificar e recrear padrão de horas se necessário
      try {
        PadraoHorasService.carregar();
      } catch {
        console.log('🔧 Recriando padrão de horas...');
        PadraoHorasService.salvar(PadraoHorasService.criarPadrao());
      }
      
      // Verificar e recrear metas se necessário
      try {
        MetasService.carregar();
      } catch {
        console.log('🔧 Recriando metas...');
        MetasService.salvar(MetasService.criarPadrao());
      }
      
      console.log('✅ Recuperação concluída com sucesso');
      return true;
      
    } catch (error) {
      console.error('❌ Erro na recuperação:', error);
      return false;
    }
  }
}

// ============= BACKUP E EXPORT =============

export class BackupService {
  static criarBackup(): BackupPrecificacao {
    const agora = new Date().toISOString();
    
    return {
      versao: VERSAO_ATUAL,
      dataExport: agora,
      user_id: USUARIO_LOCAL,
      estruturaCustos: EstruturaCustosService.carregar(),
      padraoHoras: PadraoHorasService.carregar(),
      metas: MetasService.carregar(),
      estadosCalculadora: CalculadoraService.carregar() ? [CalculadoraService.carregar()!] : [],
      configuracaoSistema: {
        versaoApp: VERSAO_ATUAL,
        chavesStorage: Object.values(STORAGE_KEYS).filter(key => 
          key.includes('pricing') || key.includes('PRICING')
        )
      }
    };
  }

  static exportarJSON(): string {
    const backup = this.criarBackup();
    return JSON.stringify(backup, null, 2);
  }

  static downloadBackup(): void {
    const backupData = this.exportarJSON();
    const blob = new Blob([backupData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup-precificacao-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    console.log('📥 Backup baixado com sucesso');
  }
}

// ============= INDICADORES DE SALVAMENTO =============

export class IndicadoresService {
  private static indicadores: Map<string, IndicadorSalvamento> = new Map();

  static atualizarIndicador(componente: string, status: StatusSalvamento, mensagem?: string): void {
    const agora = new Date().toISOString();
    
    this.indicadores.set(componente, {
      status,
      ultimoSalvamento: status === 'salvo' ? agora : this.indicadores.get(componente)?.ultimoSalvamento,
      mensagem
    });
  }

  static obterIndicador(componente: string): IndicadorSalvamento {
    return this.indicadores.get(componente) || {
      status: 'nao_salvo',
      mensagem: 'Dados não salvos'
    };
  }

  static obterTodosIndicadores(): Record<string, IndicadorSalvamento> {
    const resultado: Record<string, IndicadorSalvamento> = {};
    for (const [componente, indicador] of this.indicadores) {
      resultado[componente] = indicador;
    }
    return resultado;
  }
}

// ============= MIGRAÇÃO DE DADOS ANTIGOS =============

export class MigracaoService {
  static migrarDadosAntigos(): boolean {
    try {
      console.log('🔄 Iniciando migração de dados antigos...');
      
      // Migrar estrutura de custos fixos
      const custosAntigos = storage.load('precificacao_custos_fixos', null);
      if (custosAntigos) {
        console.log('🔄 Migrando estrutura de custos...');
        EstruturaCustosService.salvar({
          ...custosAntigos,
          totalCalculado: 0, // Será recalculado
          user_id: USUARIO_LOCAL,
          created_at: new Date().toISOString()
        });
        storage.remove('precificacao_custos_fixos');
      }
      
      // Migrar padrão de horas
      const horasAntigas = storage.load('precificacao_padrao_horas', null);
      if (horasAntigas) {
        console.log('🔄 Migrando padrão de horas...');
        PadraoHorasService.salvar({
          ...horasAntigas,
          user_id: USUARIO_LOCAL,
          created_at: new Date().toISOString()
        });
        storage.remove('precificacao_padrao_horas');
      }
      
      // Migrar metas
      const metasAntigas = storage.load('precificacao_metas', null);
      if (metasAntigas) {
        console.log('🔄 Migrando metas...');
        const currentYear = new Date().getFullYear();
        MetasService.salvar({
          ...metasAntigas,
          ano: currentYear,
          metaFaturamentoAnual: 0, // Será recalculado
          metaLucroAnual: 0, // Será recalculado
          user_id: USUARIO_LOCAL,
          created_at: new Date().toISOString()
        });
        storage.remove('precificacao_metas');
      }
      
      console.log('✅ Migração concluída com sucesso');
      return true;
      
    } catch (error) {
      console.error('❌ Erro na migração:', error);
      return false;
    }
  }
}