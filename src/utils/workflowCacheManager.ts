/**
 * Utilitário para gerenciar e corrigir cache de métricas do workflow
 */

import { parseDateFromStorage } from '@/utils/dateUtils';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import type { SessionData } from '@/types/workflow';

interface MonthlyMetrics {
  receita: number;
  previsto: number;
  aReceber: number;
  sessoes: number;
}

interface WorkflowMonthlyMetrics {
  [key: string]: MonthlyMetrics & { lastUpdated: string };
}

/**
 * Função para calcular total de uma sessão
 */
const calculateSessionTotal = (session: SessionData): number => {
  try {
    const valorPacoteStr = typeof session.valorPacote === 'string' ? session.valorPacote : String(session.valorPacote || '0');
    const valorPacote = parseFloat(valorPacoteStr.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    
    const valorFotoExtraStr = typeof session.valorTotalFotoExtra === 'string' ? session.valorTotalFotoExtra : String(session.valorTotalFotoExtra || '0');
    const valorFotoExtra = parseFloat(valorFotoExtraStr.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    
    const valorAdicionalStr = typeof session.valorAdicional === 'string' ? session.valorAdicional : String(session.valorAdicional || '0');
    const valorAdicional = parseFloat(valorAdicionalStr.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    
    const desconto = session.desconto || 0;

    // Apenas produtos manuais somam ao total
    let valorProdutosManuais = 0;
    if (session.produtosList && session.produtosList.length > 0) {
      const produtosManuais = session.produtosList.filter(p => p.tipo === 'manual');
      valorProdutosManuais = produtosManuais.reduce((total, p) => total + p.valorUnitario * p.quantidade, 0);
    } else if (session.valorTotalProduto) {
      const valorProdutoStr = typeof session.valorTotalProduto === 'string' ? session.valorTotalProduto : String(session.valorTotalProduto || '0');
      valorProdutosManuais = parseFloat(valorProdutoStr.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    }
    
    return valorPacote + valorFotoExtra + valorProdutosManuais + valorAdicional - desconto;
  } catch (error) {
    console.error('Erro no cálculo de total da sessão:', error);
    return 0;
  }
};

/**
 * Função para calcular valor restante de uma sessão
 */
const calculateSessionRemaining = (session: SessionData): number => {
  const total = calculateSessionTotal(session);
  const valorPagoStr = typeof session.valorPago === 'string' ? session.valorPago : String(session.valorPago || '0');
  const valorPago = parseFloat(valorPagoStr.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
  return total - valorPago;
};

/**
 * Função para extrair valor pago de uma sessão
 */
const extractSessionRevenue = (session: SessionData): number => {
  const paidStr = typeof session.valorPago === 'string' ? session.valorPago : String(session.valorPago || '0');
  return parseFloat(paidStr.replace(/[^\d,]/g, '').replace(',', '.') || '0');
};

/**
 * Recalcula completamente o cache baseado em todas as sessões salvas
 */
export const recalculateWorkflowCache = (): void => {
  console.log('🔄 Iniciando recálculo completo do cache de workflow...');
  
  try {
    // Carregar todas as sessões do localStorage
    const allSessions: SessionData[] = storage.load(STORAGE_KEYS.WORKFLOW_ITEMS, []);
    
    if (allSessions.length === 0) {
      console.log('⚠️ Nenhuma sessão encontrada para recalcular cache');
      return;
    }

    // Agrupar sessões por mês baseado na data REAL
    const metricasPorMes: Record<string, MonthlyMetrics> = {};
    let sessoesProcessadas = 0;
    let erros = 0;

    allSessions.forEach(session => {
      try {
        // Extrair data real do agendamento
        const sessionDate = parseDateFromStorage(session.data);
        const mesReal = sessionDate.getUTCMonth() + 1; // 1-12
        const anoReal = sessionDate.getUTCFullYear();
        const chaveReal = `${anoReal}-${mesReal.toString().padStart(2, '0')}`;

        // Inicializar se não existe
        if (!metricasPorMes[chaveReal]) {
          metricasPorMes[chaveReal] = {
            receita: 0,
            previsto: 0,
            aReceber: 0,
            sessoes: 0
          };
        }

        // Calcular valores
        const receita = extractSessionRevenue(session);
        const previsto = calculateSessionTotal(session);
        const aReceber = calculateSessionRemaining(session);

        // Acumular métricas
        metricasPorMes[chaveReal].receita += receita;
        metricasPorMes[chaveReal].previsto += previsto;
        metricasPorMes[chaveReal].aReceber += aReceber;
        metricasPorMes[chaveReal].sessoes += 1;

        sessoesProcessadas++;
      } catch (error) {
        erros++;
        console.warn('❌ Erro ao processar sessão:', session.id, error);
      }
    });

    // Salvar cache recalculado
    const newCache: WorkflowMonthlyMetrics = {};
    const timestamp = new Date().toISOString();

    Object.entries(metricasPorMes).forEach(([chave, metricas]) => {
      newCache[chave] = {
        ...metricas,
        lastUpdated: timestamp
      };
    });

    // Persistir cache
    localStorage.setItem('workflow_monthly_metrics', JSON.stringify(newCache));

    // Log do resultado
    const mesesAfetados = Object.keys(metricasPorMes);
    console.log(`✅ Cache recalculado com sucesso!`);
    console.log(`📊 ${sessoesProcessadas} sessões processadas`);
    console.log(`📅 ${mesesAfetados.length} meses atualizados:`, mesesAfetados);
    if (erros > 0) {
      console.warn(`⚠️ ${erros} erros encontrados durante o processamento`);
    }

    // Disparar evento para atualizar interfaces
    window.dispatchEvent(new CustomEvent('workflowCacheRecalculated', { 
      detail: { 
        monthsUpdated: mesesAfetados.length,
        sessionsProcessed: sessoesProcessadas,
        errors: erros 
      } 
    }));

  } catch (error) {
    console.error('❌ Erro fatal no recálculo do cache:', error);
  }
};

/**
 * Limpa entradas de cache antigas ou corrompidas
 */
export const cleanCorruptedCache = (): void => {
  console.log('🧹 Limpando cache corrompido...');
  
  try {
    const cache: WorkflowMonthlyMetrics = JSON.parse(
      localStorage.getItem('workflow_monthly_metrics') || '{}'
    );

    const cleanedCache: WorkflowMonthlyMetrics = {};
    let removidas = 0;

    Object.entries(cache).forEach(([key, metrics]) => {
      // Validar formato da chave (YYYY-MM)
      const keyPattern = /^\d{4}-\d{2}$/;
      if (!keyPattern.test(key)) {
        removidas++;
        console.warn(`🗑️ Removendo chave inválida: ${key}`);
        return;
      }

      // Validar estrutura das métricas
      if (
        typeof metrics.receita === 'number' &&
        typeof metrics.previsto === 'number' &&
        typeof metrics.aReceber === 'number' &&
        typeof metrics.sessoes === 'number' &&
        !isNaN(metrics.receita) &&
        !isNaN(metrics.previsto) &&
        !isNaN(metrics.aReceber) &&
        !isNaN(metrics.sessoes)
      ) {
        cleanedCache[key] = metrics;
      } else {
        removidas++;
        console.warn(`🗑️ Removendo métricas corrompidas para: ${key}`);
      }
    });

    // Salvar cache limpo
    localStorage.setItem('workflow_monthly_metrics', JSON.stringify(cleanedCache));
    
    console.log(`✅ Cache limpo! ${removidas} entradas removidas`);
    
  } catch (error) {
    console.error('❌ Erro ao limpar cache:', error);
  }
};

/**
 * Valida consistência entre cache e dados reais
 */
export const validateCacheConsistency = (): { 
  isConsistent: boolean;
  discrepancies: string[];
  recommendation: string;
} => {
  console.log('🔍 Validando consistência do cache...');
  
  const discrepancies: string[] = [];
  
  try {
    // Carregar cache atual
    const cache: WorkflowMonthlyMetrics = JSON.parse(
      localStorage.getItem('workflow_monthly_metrics') || '{}'
    );

    // Carregar sessões reais
    const allSessions: SessionData[] = storage.load(STORAGE_KEYS.WORKFLOW_ITEMS, []);

    // Agrupar sessões reais por mês
    const realMetrics: Record<string, MonthlyMetrics> = {};
    
    allSessions.forEach(session => {
      try {
        const sessionDate = parseDateFromStorage(session.data);
        const mesReal = sessionDate.getUTCMonth() + 1;
        const anoReal = sessionDate.getUTCFullYear();
        const chaveReal = `${anoReal}-${mesReal.toString().padStart(2, '0')}`;

        if (!realMetrics[chaveReal]) {
          realMetrics[chaveReal] = { receita: 0, previsto: 0, aReceber: 0, sessoes: 0 };
        }

        realMetrics[chaveReal].receita += extractSessionRevenue(session);
        realMetrics[chaveReal].previsto += calculateSessionTotal(session);
        realMetrics[chaveReal].aReceber += calculateSessionRemaining(session);
        realMetrics[chaveReal].sessoes += 1;
      } catch (error) {
        // Ignorar sessões com erro de data
      }
    });

    // Comparar cache vs realidade
    const allMonths = new Set([...Object.keys(cache), ...Object.keys(realMetrics)]);
    
    allMonths.forEach(month => {
      const cached = cache[month];
      const real = realMetrics[month];

      if (!cached && real) {
        discrepancies.push(`Mês ${month}: presente nos dados mas ausente no cache`);
      } else if (cached && !real) {
        discrepancies.push(`Mês ${month}: presente no cache mas ausente nos dados`);
      } else if (cached && real) {
        const tolerance = 0.01; // Tolerância de R$ 0,01 para diferenças de arredondamento
        
        if (Math.abs(cached.receita - real.receita) > tolerance) {
          discrepancies.push(`Mês ${month}: receita diverge (cache: R$ ${cached.receita.toFixed(2)}, real: R$ ${real.receita.toFixed(2)})`);
        }
        
        if (Math.abs(cached.previsto - real.previsto) > tolerance) {
          discrepancies.push(`Mês ${month}: previsto diverge (cache: R$ ${cached.previsto.toFixed(2)}, real: R$ ${real.previsto.toFixed(2)})`);
        }
        
        if (cached.sessoes !== real.sessoes) {
          discrepancies.push(`Mês ${month}: quantidade de sessões diverge (cache: ${cached.sessoes}, real: ${real.sessoes})`);
        }
      }
    });

    const isConsistent = discrepancies.length === 0;
    
    let recommendation = '';
    if (!isConsistent) {
      recommendation = 'Execute recalculateWorkflowCache() para corrigir as inconsistências.';
    } else {
      recommendation = 'Cache está consistente com os dados.';
    }

    console.log(isConsistent ? '✅ Cache consistente' : `❌ ${discrepancies.length} inconsistências encontradas`);
    
    return {
      isConsistent,
      discrepancies,
      recommendation
    };

  } catch (error) {
    console.error('❌ Erro na validação:', error);
    return {
      isConsistent: false,
      discrepancies: ['Erro interno na validação'],
      recommendation: 'Execute recalculateWorkflowCache() e cleanCorruptedCache()'
    };
  }
};

/**
 * Função de correção automática que combina limpeza e recálculo
 */
export const autoFixWorkflowCache = (): void => {
  console.log('🔧 Iniciando correção automática do cache...');
  
  // 1. Limpar cache corrompido
  cleanCorruptedCache();
  
  // 2. Recalcular cache baseado em dados reais
  recalculateWorkflowCache();
  
  // 3. Validar resultado
  const validation = validateCacheConsistency();
  
  if (validation.isConsistent) {
    console.log('✅ Correção automática concluída com sucesso!');
  } else {
    console.warn('⚠️ Ainda há inconsistências após correção automática:', validation.discrepancies);
  }
};