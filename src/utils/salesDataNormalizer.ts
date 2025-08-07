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
          // Parse e validação da data com interpretação UTC para consistência
          const dateStr = session.data;
          if (!dateStr) {
            console.warn(`⚠️ [SalesAnalytics] Sessão ${index} sem data válida`);
            return null;
          }

          // Parse explícito da data garantindo interpretação UTC
          let date: Date;
          if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            // Para formato YYYY-MM-DD, usar interpretação UTC para evitar mudanças de timezone
            const [year, month, day] = dateStr.split('-').map(Number);
            date = new Date(year, month - 1, day); // month - 1 porque Date usa 0-11 para meses
            console.log(`📅 [SalesAnalytics] Sessão ${index}: "${dateStr}" → ano:${year}, mês:${month-1} (${month}), dia:${day}`);
          } else {
            // Para outros formatos, usar parse padrão
            date = new Date(dateStr);
          }
          
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

          // Calcular mês e ano com logs detalhados
          const calculatedMonth = date.getMonth(); // 0-11
          const calculatedYear = date.getFullYear();
          const monthName = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][calculatedMonth];
          
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
            month: calculatedMonth, // 0-11 (Jan=0, Jul=6)
            year: calculatedYear,
            date: date
          };

          // Debug log detalhado para primeiras 3 sessões
          if (index < 3) {
            console.log(`📊 [SalesAnalytics] Sessão ${index} normalizada:`, {
              id: normalized.id,
              dataOriginal: normalized.data,
              dataParsed: date.toISOString(),
              monthIndex: calculatedMonth,
              monthName: monthName,
              year: calculatedYear,
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
    
    // Debug: Mostrar distribuição detalhada por mês
    const monthlyDistribution = activeSessions.reduce((acc, item) => {
      const monthKey = `${item.year}-${String(item.month + 1).padStart(2, '0')}`;
      const monthName = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][item.month];
      const fullKey = `${monthKey} (${monthName})`;
      acc[fullKey] = (acc[fullKey] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('📅 [SalesAnalytics] Distribuição detalhada por mês:', monthlyDistribution);
    
    // Log específico para dados de julho 2025
    const julyData = activeSessions.filter(item => item.year === 2025 && item.month === 6); // Julho = 6
    if (julyData.length > 0) {
      console.log(`🔍 [SalesAnalytics] Dados de Julho/2025 encontrados: ${julyData.length} sessões`, 
        julyData.map(item => ({ data: item.data, month: item.month, valorPago: item.valorPago }))
      );
    }

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

    const revenue = monthData.reduce((sum, item) => sum + item.valorPago, 0);
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