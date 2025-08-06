import { NormalizedWorkflowData } from '@/types/salesAnalytics';
import { parseMonetaryValue } from '@/utils/workflowSessionsAdapter';

/**
 * Normaliza dados brutos do workflow_sessions para estrutura otimizada de vendas
 * Garante dados limpos e consistentes para análise
 */
export function normalizeWorkflowItems(): NormalizedWorkflowData[] {
  try {
    console.log('📊 [SalesAnalytics] Carregando dados do localStorage.workflow_sessions...');
    
    const rawSessions = localStorage.getItem('workflow_sessions');
    if (!rawSessions) {
      console.log('⚠️ [SalesAnalytics] Nenhum dado encontrado em workflow_sessions');
      return [];
    }

    const sessions = JSON.parse(rawSessions);
    console.log(`📊 [SalesAnalytics] ${sessions.length} sessões encontradas`);

    const normalizedData: NormalizedWorkflowData[] = sessions
      .map((session: any, index: number) => {
        try {
          // Parse e validação da data
          const dateStr = session.data;
          if (!dateStr) {
            console.warn(`⚠️ [SalesAnalytics] Sessão ${index} sem data válida`);
            return null;
          }

          const date = new Date(dateStr);
          if (isNaN(date.getTime())) {
            console.warn(`⚠️ [SalesAnalytics] Data inválida para sessão ${index}: ${dateStr}`);
            return null;
          }

          // Parse valores monetários
          const total = parseMonetaryValue(session.total || session.valor || 0);
          const valorPago = parseMonetaryValue(session.valorPago || 0);
          const valorPacote = parseMonetaryValue(session.valorPacote || 0);
          const valorTotalFotoExtra = parseMonetaryValue(session.valorTotalFotoExtra || 0);
          const valorAdicional = parseMonetaryValue(session.valorAdicional || 0);

          const normalized: NormalizedWorkflowData = {
            id: session.id || `session-${index}`,
            sessionId: session.sessionId || session.id || `session-${index}`,
            data: dateStr,
            hora: session.hora || '',
            nome: session.nome || '',
            whatsapp: session.whatsapp || '',
            email: session.email || '',
            descricao: session.descricao || '',
            status: session.status || '',
            categoria: session.categoria || '',
            pacote: session.pacote || '',
            valorPacote: valorPacote,
            desconto: session.desconto || 0,
            valorFotoExtra: parseMonetaryValue(session.valorFotoExtra || 0),
            qtdFotosExtra: session.qtdFotosExtra || 0,
            valorTotalFotoExtra: valorTotalFotoExtra,
            valorAdicional: valorAdicional,
            detalhes: session.detalhes || '',
            total: total,
            valorPago: valorPago,
            restante: total - valorPago,
            fonte: session.fonte || 'agenda',
            clienteId: session.clienteId,
            month: date.getMonth(),
            year: date.getFullYear(),
            date: date
          };

          // Debug log para primeiras 3 sessões
          if (index < 3) {
            console.log(`📊 [SalesAnalytics] Sessão ${index} normalizada:`, {
              id: normalized.id,
              data: normalized.data,
              total: normalized.total,
              valorPago: normalized.valorPago,
              categoria: normalized.categoria,
              status: normalized.status
            });
          }

          return normalized;
        } catch (error) {
          console.error(`❌ [SalesAnalytics] Erro ao normalizar sessão ${index}:`, error);
          return null;
        }
      })
      .filter(Boolean); // Remove itens nulos

    // Filtrar sessões canceladas
    const activeSessions = normalizedData.filter(item => item.status !== 'Cancelado');
    
    console.log(`✅ [SalesAnalytics] ${normalizedData.length} sessões normalizadas (${activeSessions.length} ativas)`);
    
    // Debug: Mostrar distribuição por mês
    const monthlyDistribution = activeSessions.reduce((acc, item) => {
      const monthKey = `${item.year}-${String(item.month + 1).padStart(2, '0')}`;
      acc[monthKey] = (acc[monthKey] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('📅 [SalesAnalytics] Distribuição por mês:', monthlyDistribution);

    return activeSessions;
  } catch (error) {
    console.error('❌ [SalesAnalytics] Erro ao normalizar dados:', error);
    return [];
  }
}

/**
 * Gera dados de placeholder para todos os 12 meses
 * Garante que sempre temos dados para visualização
 */
export function generateAllMonthsData(year: number, normalizedData: NormalizedWorkflowData[]) {
  const months = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
  ];

  return months.map((month, index) => {
    const monthData = normalizedData.filter(item => 
      item.year === year && item.month === index
    );

    const revenue = monthData.reduce((sum, item) => sum + item.total, 0);
    const sessions = monthData.length;
    const averageTicket = sessions > 0 ? revenue / sessions : 0;
    const extraPhotoRevenue = monthData.reduce((sum, item) => sum + item.valorTotalFotoExtra, 0);

    // Metas progressivas por mês
    const baseGoal = 30000;
    const goal = baseGoal + (index * 2000);

    return {
      month,
      monthIndex: index,
      revenue,
      sessions,
      averageTicket,
      extraPhotoRevenue,
      goal
    };
  });
}