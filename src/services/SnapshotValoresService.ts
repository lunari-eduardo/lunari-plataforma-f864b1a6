/**
 * SERVIÇO DE SNAPSHOT DE VALORES - SISTEMA ABSOLUTO
 * 
 * Este serviço implementa o sistema de fixação absoluta de valores para fotos extras,
 * garantindo que mudanças no modelo de precificação não afetem agendamentos existentes.
 */

import { calcularTotalFotosExtras, obterConfiguracaoPrecificacao } from '@/utils/precificacaoUtils';
import { toast } from '@/hooks/use-toast';

// Chave para controle de versão do sistema
const SNAPSHOT_VERSION_KEY = 'snapshot_valor_foto_version';
const CURRENT_SNAPSHOT_VERSION = '1.0.0';

// Interface para item com valor fixado
export interface ItemComValorFixado {
  id: string;
  valorFotoExtraFixo: number;
  isValorFixado: boolean;
  timestampFixacao: string;
  modeloOriginal: 'fixo' | 'global' | 'categoria';
  observacaoFixacao?: string;
}

/**
 * FUNÇÃO PRINCIPAL - Fazer snapshot de todos os valores atuais
 * 
 * Esta função é chamada quando o modelo de precificação muda,
 * fixando todos os valores calculados com as regras antigas.
 */
export function fazerSnapshotValores(): void {
  try {
    console.log('📸 [SNAPSHOT] Iniciando fixação de valores...');
    
    const config = obterConfiguracaoPrecificacao();
    const timestamp = new Date().toISOString();
    
    // Carregar itens do workflow
    const workflowItems = JSON.parse(localStorage.getItem('lunari_workflow_items') || '[]');
    let itensModificados = 0;
    
    const workflowItemsAtualizados = workflowItems.map((item: any) => {
      // Pular itens que já estão fixados
      if (item.isValorFixado) {
        return item;
      }
      
      // Calcular valor atual com as regras atuais
      const valorAtual = calcularValorFotoExtraAtual(item);
      
      // Fixar o valor
      const itemFixado = {
        ...item,
        valorFotoExtraFixo: valorAtual,
        isValorFixado: true,
        timestampFixacao: timestamp,
        modeloOriginal: config.modelo,
        observacaoFixacao: `Valor fixado automaticamente em ${new Date().toLocaleDateString()}`
      };
      
      itensModificados++;
      
      console.log('🔒 [FIXADO]', {
        id: item.id,
        nome: item.nome,
        qtdFotos: item.qtdFotoExtra,
        valorAnterior: item.valorTotalFotoExtra,
        valorFixado: valorAtual
      });
      
      return itemFixado;
    });
    
    // Salvar no localStorage
    localStorage.setItem('lunari_workflow_items', JSON.stringify(workflowItemsAtualizados));
    
    // Fazer a mesma coisa para workflow_sessions
    const workflowSessions = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
    let sessionsModificadas = 0;
    
    const workflowSessionsAtualizadas = workflowSessions.map((session: any) => {
      if (session.isValorFixado) {
        return session;
      }
      
      const valorAtual = calcularValorFotoExtraAtualSession(session);
      
      sessionsModificadas++;
      
      return {
        ...session,
        valorFotoExtraFixo: valorAtual,
        isValorFixado: true,
        timestampFixacao: timestamp,
        modeloOriginal: config.modelo,
        observacaoFixacao: `Valor fixado automaticamente em ${new Date().toLocaleDateString()}`
      };
    });
    
    localStorage.setItem('workflow_sessions', JSON.stringify(workflowSessionsAtualizadas));
    
    // Marcar versão atual
    localStorage.setItem(SNAPSHOT_VERSION_KEY, CURRENT_SNAPSHOT_VERSION);
    
    console.log('✅ [SNAPSHOT] Fixação concluída:', {
      workflowItems: itensModificados,
      workflowSessions: sessionsModificadas,
      total: itensModificados + sessionsModificadas
    });
    
    // Notificar usuário
    if (itensModificados + sessionsModificadas > 0) {
      toast({
        title: "✅ Valores Fixados",
        description: `${itensModificados + sessionsModificadas} agendamentos tiveram seus valores de fotos extras fixados para manter consistência.`,
      });
    }
    
  } catch (error) {
    console.error('❌ [SNAPSHOT] Erro na fixação:', error);
    toast({
      title: "❌ Erro na Fixação",
      description: "Erro ao fixar valores. Consulte o console para detalhes.",
      variant: "destructive",
    });
  }
}

/**
 * Calcular valor de foto extra atual para WorkflowItem
 */
function calcularValorFotoExtraAtual(item: any): number {
  if (!item.qtdFotoExtra || item.qtdFotoExtra <= 0) {
    return 0;
  }
  
  // Tentar usar regras congeladas se existirem
  if (item.regrasDePrecoFotoExtraCongeladas) {
    try {
      const { calcularComRegrasProprias } = require('@/utils/precificacaoUtils');
      return calcularComRegrasProprias(item.qtdFotoExtra, item.regrasDePrecoFotoExtraCongeladas);
    } catch (error) {
      console.warn('❌ Erro ao calcular com regras congeladas, usando fallback');
    }
  }
  
  // Fallback: usar sistema atual
  return calcularTotalFotosExtras(item.qtdFotoExtra, {
    valorFotoExtra: item.valorFotoExtra,
    categoriaId: item.categoriaId || item.categoria
  });
}

/**
 * Calcular valor de foto extra atual para WorkflowSession
 */
function calcularValorFotoExtraAtualSession(session: any): number {
  if (!session.qtdFotosExtra || session.qtdFotosExtra <= 0) {
    return 0;
  }
  
  // Converter valor formatado para número
  const parseMonetaryValue = (value: string | number): number => {
    if (typeof value === 'number') return value;
    if (!value || typeof value !== 'string') return 0;
    
    const cleanValue = value
      .replace(/R\$\s*/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .trim();
    
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? 0 : parsed;
  };
  
  const valorFotoExtra = parseMonetaryValue(session.valorFotoExtra);
  
  return calcularTotalFotosExtras(session.qtdFotosExtra, {
    valorFotoExtra: valorFotoExtra,
    categoriaId: session.categoriaId || session.categoria
  });
}

/**
 * FUNÇÃO DE CÁLCULO UNIFICADA - USA VALOR FIXO OU CALCULA DINAMICAMENTE
 * 
 * Esta é a função que TODOS os componentes devem usar para calcular
 * valor total de fotos extras de forma consistente.
 */
export function calcularValorFotoExtraUnificado(
  item: any,
  quantidade?: number
): number {
  const qtd = quantidade ?? item.qtdFotoExtra ?? item.qtdFotosExtra ?? 0;
  
  if (qtd <= 0) {
    return 0;
  }
  
  // Se o item tem valor fixado, usar sempre esse valor
  if (item.isValorFixado && typeof item.valorFotoExtraFixo === 'number') {
    const valorPorFoto = item.valorFotoExtraFixo / (item.qtdFotoExtraOriginal || item.qtdFotoExtra || item.qtdFotosExtra || 1);
    const resultado = valorPorFoto * qtd;
    
    console.log('🔒 [FIXO] Usando valor fixado:', {
      id: item.id,
      qtdOriginal: item.qtdFotoExtraOriginal || item.qtdFotoExtra || item.qtdFotosExtra,
      qtdAtual: qtd,
      valorFixoTotal: item.valorFotoExtraFixo,
      valorPorFoto: valorPorFoto,
      resultado: resultado
    });
    
    return resultado;
  }
  
  // Se não tem valor fixado, usar cálculo dinâmico
  console.log('🧮 [DINÂMICO] Calculando valor atual:', {
    id: item.id,
    quantidade: qtd
  });
  
  return calcularValorFotoExtraAtual(item);
}

/**
 * Verificar se precisa executar migração automática
 */
export function verificarNecessidadeMigracao(): boolean {
  const versaoAtual = localStorage.getItem(SNAPSHOT_VERSION_KEY);
  return versaoAtual !== CURRENT_SNAPSHOT_VERSION;
}

/**
 * Migrar itens existentes para o sistema de snapshot
 */
export function migrarParaSnapshotSistema(): void {
  if (!verificarNecessidadeMigracao()) {
    console.log('✅ [MIGRAÇÃO] Sistema já está atualizado');
    return;
  }
  
  console.log('🔄 [MIGRAÇÃO] Executando migração para sistema de snapshot...');
  
  try {
    // Migrar workflow items
    const workflowItems = JSON.parse(localStorage.getItem('lunari_workflow_items') || '[]');
    const workflowItemsMigrados = workflowItems.map((item: any) => {
      if (item.isValorFixado) {
        return item; // Já migrado
      }
      
      // Para itens antigos, preservar o valor que estava sendo usado
      const valorAtual = item.valorTotalFotoExtra || 0;
      const qtdFotos = item.qtdFotoExtra || 0;
      
      if (qtdFotos > 0 && valorAtual > 0) {
        return {
          ...item,
          valorFotoExtraFixo: valorAtual,
          isValorFixado: true,
          timestampFixacao: new Date().toISOString(),
          modeloOriginal: 'fixo',
          observacaoFixacao: 'Migração automática - valor preservado',
          qtdFotoExtraOriginal: qtdFotos
        };
      }
      
      return item;
    });
    
    localStorage.setItem('lunari_workflow_items', JSON.stringify(workflowItemsMigrados));
    
    // Migrar workflow sessions
    const workflowSessions = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
    const workflowSessionsMigradas = workflowSessions.map((session: any) => {
      if (session.isValorFixado) {
        return session;
      }
      
      const parseMonetaryValue = (value: string | number): number => {
        if (typeof value === 'number') return value;
        if (!value || typeof value !== 'string') return 0;
        
        const cleanValue = value
          .replace(/R\$\s*/g, '')
          .replace(/\./g, '')
          .replace(',', '.')
          .trim();
        
        const parsed = parseFloat(cleanValue);
        return isNaN(parsed) ? 0 : parsed;
      };
      
      const valorAtual = parseMonetaryValue(session.valorTotalFotoExtra || 0);
      const qtdFotos = session.qtdFotosExtra || 0;
      
      if (qtdFotos > 0 && valorAtual > 0) {
        return {
          ...session,
          valorFotoExtraFixo: valorAtual,
          isValorFixado: true,
          timestampFixacao: new Date().toISOString(),
          modeloOriginal: 'fixo',
          observacaoFixacao: 'Migração automática - valor preservado',
          qtdFotoExtraOriginal: qtdFotos
        };
      }
      
      return session;
    });
    
    localStorage.setItem('workflow_sessions', JSON.stringify(workflowSessionsMigradas));
    
    // Marcar como migrado
    localStorage.setItem(SNAPSHOT_VERSION_KEY, CURRENT_SNAPSHOT_VERSION);
    
    console.log('✅ [MIGRAÇÃO] Migração concluída com sucesso');
    
  } catch (error) {
    console.error('❌ [MIGRAÇÃO] Erro na migração:', error);
  }
}

/**
 * Função para "descongelar" um item específico (torná-lo dinâmico novamente)
 */
export function descongelarItem(itemId: string): void {
  try {
    // Atualizar workflow items
    const workflowItems = JSON.parse(localStorage.getItem('lunari_workflow_items') || '[]');
    const workflowItemsAtualizados = workflowItems.map((item: any) => {
      if (item.id === itemId) {
        const { isValorFixado, valorFotoExtraFixo, timestampFixacao, modeloOriginal, observacaoFixacao, qtdFotoExtraOriginal, ...itemLimpo } = item;
        return {
          ...itemLimpo,
          observacaoFixacao: `Descongelado em ${new Date().toLocaleDateString()}`
        };
      }
      return item;
    });
    
    localStorage.setItem('lunari_workflow_items', JSON.stringify(workflowItemsAtualizados));
    
    // Atualizar workflow sessions
    const workflowSessions = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
    const workflowSessionsAtualizadas = workflowSessions.map((session: any) => {
      if (session.id === itemId) {
        const { isValorFixado, valorFotoExtraFixo, timestampFixacao, modeloOriginal, observacaoFixacao, qtdFotoExtraOriginal, ...sessionLimpa } = session;
        return {
          ...sessionLimpa,
          observacaoFixacao: `Descongelado em ${new Date().toLocaleDateString()}`
        };
      }
      return session;
    });
    
    localStorage.setItem('workflow_sessions', JSON.stringify(workflowSessionsAtualizadas));
    
    console.log('🔓 [DESCONGELADO] Item liberado:', itemId);
    
    toast({
      title: "🔓 Valor Descongelado",
      description: "Este agendamento agora usará as regras de precificação atuais.",
    });
    
  } catch (error) {
    console.error('❌ [DESCONGELAR] Erro:', error);
  }
}

/**
 * Função para debug e inspeção
 */
export function debugSnapshotSistema(): void {
  console.log('🔍 [DEBUG] Estado do Sistema de Snapshot');
  
  const versao = localStorage.getItem(SNAPSHOT_VERSION_KEY);
  console.log('📋 Versão:', versao);
  
  const workflowItems = JSON.parse(localStorage.getItem('lunari_workflow_items') || '[]');
  const itensFixados = workflowItems.filter((item: any) => item.isValorFixado);
  
  console.log('📊 WorkflowItems:', {
    total: workflowItems.length,
    fixados: itensFixados.length,
    dinamicos: workflowItems.length - itensFixados.length
  });
  
  const workflowSessions = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
  const sessionsFixadas = workflowSessions.filter((session: any) => session.isValorFixado);
  
  console.log('📊 WorkflowSessions:', {
    total: workflowSessions.length,
    fixadas: sessionsFixadas.length,
    dinamicas: workflowSessions.length - sessionsFixadas.length
  });
  
  // Amostras
  console.log('🔬 Amostras fixadas:');
  itensFixados.slice(0, 3).forEach((item: any) => {
    console.log(`  - ${item.nome}: R$ ${item.valorFotoExtraFixo} (${item.modeloOriginal})`);
  });
}