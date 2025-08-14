/**
 * Utilitários de Migração para Sistema de Precificação
 * Gerencia a transição do sistema antigo para o novo
 */

import { storage } from '@/utils/localStorage';
import { 
  EstruturaCustosService, 
  PadraoHorasService, 
  MetasService,
  ValidacaoService,
  MigracaoService
} from '@/services/PricingService';

// ============= VERIFICAÇÃO DE MIGRAÇÃO =============

const VERSAO_MIGRACAO = '1.0.0';
const CHAVE_STATUS_MIGRACAO = 'pricing_migration_status';

interface StatusMigracao {
  versao: string;
  concluida: boolean;
  datamigracao: string;
  dadosEncontrados: {
    custosFixos: boolean;
    padraoHoras: boolean;
    metas: boolean;
  };
  erros: string[];
}

export function verificarStatusMigracao(): StatusMigracao {
  return storage.load(CHAVE_STATUS_MIGRACAO, {
    versao: '',
    concluida: false,
    datamigracao: '',
    dadosEncontrados: {
      custosFixos: false,
      padraoHoras: false,
      metas: false
    },
    erros: []
  });
}

export function marcarMigracaoConcluida(status: StatusMigracao): void {
  storage.save(CHAVE_STATUS_MIGRACAO, {
    ...status,
    versao: VERSAO_MIGRACAO,
    concluida: true,
    datamigracao: new Date().toISOString()
  });
}

// ============= DETECÇÃO DE DADOS ANTIGOS =============

export function detectarDadosAntigos(): {
  custosFixos: boolean;
  padraoHoras: boolean;
  metas: boolean;
  totalEncontrados: number;
} {
  const custosFixos = !!storage.load('precificacao_custos_fixos', null);
  const padraoHoras = !!storage.load('precificacao_padrao_horas', null);
  const metas = !!storage.load('precificacao_metas', null);
  
  const totalEncontrados = [custosFixos, padraoHoras, metas].filter(Boolean).length;
  
  return {
    custosFixos,
    padraoHoras,
    metas,
    totalEncontrados
  };
}

// ============= PROCESSO DE MIGRAÇÃO AUTOMÁTICA =============

export function executarMigracaoAutomatica(): {
  sucesso: boolean;
  erros: string[];
  dadosMigrados: number;
} {
  console.log('🚀 Iniciando migração automática do sistema de precificação...');
  
  const erros: string[] = [];
  let dadosMigrados = 0;
  
  try {
    // Verificar se já foi migrado
    const statusAtual = verificarStatusMigracao();
    if (statusAtual.concluida && statusAtual.versao === VERSAO_MIGRACAO) {
      console.log('✅ Migração já foi executada anteriormente');
      return { sucesso: true, erros: [], dadosMigrados: 0 };
    }
    
    // Detectar dados antigos
    const dadosAntigos = detectarDadosAntigos();
    console.log('🔍 Dados antigos detectados:', dadosAntigos);
    
    if (dadosAntigos.totalEncontrados === 0) {
      console.log('ℹ️ Nenhum dado antigo encontrado, inicializando sistema novo');
      
      // Inicializar sistema novo
      EstruturaCustosService.salvar(EstruturaCustosService.criarPadrao());
      PadraoHorasService.salvar(PadraoHorasService.criarPadrao());
      MetasService.salvar(MetasService.criarPadrao());
      
      marcarMigracaoConcluida({
        versao: VERSAO_MIGRACAO,
        concluida: true,
        datamigracao: new Date().toISOString(),
        dadosEncontrados: dadosAntigos,
        erros: []
      });
      
      return { sucesso: true, erros: [], dadosMigrados: 0 };
    }
    
    // Executar migração usando o serviço
    const migracaoSucesso = MigracaoService.migrarDadosAntigos();
    
    if (!migracaoSucesso) {
      erros.push('Falha na migração dos dados antigos');
    } else {
      dadosMigrados = dadosAntigos.totalEncontrados;
      console.log(`✅ ${dadosMigrados} conjuntos de dados migrados com sucesso`);
    }
    
    // Validar dados após migração
    const validacao = ValidacaoService.validarTodosSistemas();
    
    if (!validacao.estruturaCustos) {
      erros.push('Estrutura de custos inválida após migração');
    }
    if (!validacao.padraoHoras) {
      erros.push('Padrão de horas inválido após migração');
    }
    if (!validacao.metas) {
      erros.push('Metas inválidas após migração');
    }
    
    // Marcar como concluída se não houver erros críticos
    const sucesso = erros.length === 0;
    
    if (sucesso) {
      marcarMigracaoConcluida({
        versao: VERSAO_MIGRACAO,
        concluida: true,
        datamigracao: new Date().toISOString(),
        dadosEncontrados: dadosAntigos,
        erros: []
      });
      console.log('🎉 Migração concluída com sucesso!');
    } else {
      console.error('❌ Migração falhou:', erros);
    }
    
    return { sucesso, erros, dadosMigrados };
    
  } catch (error) {
    console.error('❌ Erro crítico na migração:', error);
    erros.push(`Erro crítico: ${error}`);
    return { sucesso: false, erros, dadosMigrados };
  }
}

// ============= ROLLBACK DE MIGRAÇÃO =============

export function executarRollback(): boolean {
  try {
    console.log('🔄 Executando rollback da migração...');
    
    // Remover dados novos
    storage.remove('lunari_pricing_fixed_costs');
    storage.remove('lunari_pricing_hour_defaults');
    storage.remove('lunari_pricing_goals');
    storage.remove('lunari_pricing_calculator_state');
    
    // Limpar status de migração
    storage.remove(CHAVE_STATUS_MIGRACAO);
    
    console.log('✅ Rollback executado com sucesso');
    return true;
    
  } catch (error) {
    console.error('❌ Erro no rollback:', error);
    return false;
  }
}

// ============= LIMPEZA PÓS-MIGRAÇÃO =============

export function limparDadosAntigos(): boolean {
  try {
    console.log('🧹 Limpando dados antigos pós-migração...');
    
    // Remover chaves antigas
    storage.remove('precificacao_custos_fixos');
    storage.remove('precificacao_padrao_horas');
    storage.remove('precificacao_metas');
    
    console.log('✅ Limpeza concluída');
    return true;
    
  } catch (error) {
    console.error('❌ Erro na limpeza:', error);
    return false;
  }
}

// ============= INICIALIZAÇÃO AUTOMÁTICA =============

export function inicializarSistemaPrecificacao(): void {
  console.log('🏁 Inicializando sistema de precificação...');
  
  // Executar migração automática
  const resultadoMigracao = executarMigracaoAutomatica();
  
  if (resultadoMigracao.sucesso) {
    console.log('✅ Sistema de precificação inicializado com sucesso');
    
    // Validar sistema após inicialização
    const validacao = ValidacaoService.validarTodosSistemas();
    console.log('🔍 Status de validação:', validacao);
    
    // Se houver problemas, tentar recuperação
    if (!validacao.estruturaCustos || !validacao.padraoHoras || !validacao.metas) {
      console.log('🔧 Problemas detectados, tentando recuperação...');
      ValidacaoService.recuperarDadosCorrompidos();
    }
  } else {
    console.error('❌ Falha na inicialização:', resultadoMigracao.erros);
  }
}