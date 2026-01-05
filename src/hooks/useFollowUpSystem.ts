import { useState, useEffect, useCallback } from 'react';
import { useLeads } from './useLeads';
import { useLeadStatuses } from './useLeadStatuses';
import { useSupabaseFollowUpConfig } from './useSupabaseFollowUpConfig';
import type { FollowUpNotification, LeadInteraction } from '@/types/leadInteractions';
import type { Lead } from '@/types/leads';

export function useFollowUpSystem() {
  const { leads, updateLead } = useLeads();
  const { statuses } = useLeadStatuses();
  
  // Usar configuração do Supabase (persistida)
  const { config, updateConfig, isLoading: configLoading } = useSupabaseFollowUpConfig();

  // Notificações locais (podem ser migradas para Supabase no futuro)
  const [notifications, setNotifications] = useState<FollowUpNotification[]>([]);

  const calculateDaysSinceLastChange = useCallback((lead: Lead): number => {
    const statusChangeDate = lead.statusTimestamp || lead.dataCriacao;
    const daysDiff = Math.floor(
      (new Date().getTime() - new Date(statusChangeDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysDiff;
  }, []);

  const checkForFollowUps = useCallback(() => {
    if (!config.ativo || configLoading) {
      console.log('🔍 [FollowUp] Sistema inativo ou carregando config');
      return;
    }

    // Verificar se o status de destino 'followup' existe
    const followupStatus = statuses.find(s => s.key === 'followup');
    if (!followupStatus) {
      console.warn('⚠️ [FollowUp] Status "followup" não encontrado nos statuses do usuário');
      return;
    }

    console.log('🔍 [FollowUp] Verificando leads para follow-up...', {
      ativo: config.ativo,
      statusMonitorado: config.statusMonitorado,
      diasParaFollowUp: config.diasParaFollowUp,
      totalLeads: leads.length
    });

    const leadsNeedingFollowUp = leads.filter(lead => {
      // Ignorar leads arquivados
      if (lead.arquivado) return false;
      
      // CRÍTICO: Ignorar leads em status finais (nunca devem voltar para followup)
      const finalStatuses = ['fechado', 'perdido'];
      if (finalStatuses.includes(lead.status)) return false;
      
      // Deve estar no status monitorado
      if (lead.status !== config.statusMonitorado) return false;
      
      // Já marcado como needsFollowUp? Ignorar
      if (lead.needsFollowUp) return false;
      
      const daysSinceChange = calculateDaysSinceLastChange(lead);
      return daysSinceChange >= config.diasParaFollowUp;
    });

    console.log('📋 [FollowUp] Leads elegíveis:', leadsNeedingFollowUp.map(l => ({
      id: l.id,
      nome: l.nome,
      status: l.status,
      diasNoStatus: calculateDaysSinceLastChange(l)
    })));

    leadsNeedingFollowUp.forEach(lead => {
      const daysSinceChange = calculateDaysSinceLastChange(lead);
      const now = new Date().toISOString();
      
      // Criar interação de follow-up
      const interaction: LeadInteraction = {
        id: `followup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        leadId: lead.id,
        tipo: 'followup',
        descricao: `Sistema detectou necessidade de follow-up após ${daysSinceChange} dias sem interação`,
        timestamp: now,
        automatica: true,
        detalhes: `Lead foi automaticamente movido para coluna "Follow-up" após ${daysSinceChange} dias em "${config.statusMonitorado}"`
      };

      console.log('🚀 [FollowUp] Movendo lead para follow-up:', {
        leadId: lead.id,
        nome: lead.nome,
        diasSemInteracao: daysSinceChange
      });

      // UMA ÚNICA CHAMADA para evitar race condition
      // Inclui: status, needsFollowUp, diasSemInteracao, statusTimestamp, interacoes, ultimaInteracao
      updateLead(lead.id, (currentLead) => ({
        ...currentLead,
        needsFollowUp: true,
        diasSemInteracao: daysSinceChange,
        status: 'followup',
        statusTimestamp: now,
        interacoes: [interaction, ...(currentLead.interacoes || [])],
        ultimaInteracao: now,
        historicoStatus: [
          ...(currentLead.historicoStatus || []),
          { status: 'followup', data: now }
        ]
      }));

      // Criar notificação local
      const notification: FollowUpNotification = {
        id: `notification_${Date.now()}_${lead.id}`,
        leadId: lead.id,
        leadNome: lead.nome,
        diasSemInteracao: daysSinceChange,
        timestamp: now,
        visualizada: false
      };

      setNotifications(prev => [notification, ...prev.filter(n => n.leadId !== lead.id)]);
    });
  }, [leads, config, configLoading, statuses, calculateDaysSinceLastChange, updateLead]);

  // Executar verificação periodicamente
  useEffect(() => {
    // Aguardar config carregar
    if (configLoading) return;
    
    // Verificar imediatamente
    checkForFollowUps();
    
    // Verificar a cada hora
    const interval = setInterval(checkForFollowUps, 60000 * 60);
    return () => clearInterval(interval);
  }, [checkForFollowUps, configLoading]);

  const markNotificationAsViewed = useCallback((notificationId: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, visualizada: true }
          : notification
      )
    );
  }, []);

  const dismissFollowUp = useCallback((leadId: string) => {
    updateLead(leadId, { needsFollowUp: false });
    setNotifications(prev => prev.filter(n => n.leadId !== leadId));
  }, [updateLead]);

  const getUnviewedNotifications = useCallback(() => {
    return notifications.filter(n => !n.visualizada);
  }, [notifications]);

  const getLeadsNeedingFollowUp = useCallback(() => {
    return leads.filter(lead => lead.needsFollowUp);
  }, [leads]);

  return {
    config,
    updateConfig,
    notifications,
    getUnviewedNotifications,
    getLeadsNeedingFollowUp,
    markNotificationAsViewed,
    dismissFollowUp,
    checkForFollowUps,
    isLoading: configLoading
  };
}
