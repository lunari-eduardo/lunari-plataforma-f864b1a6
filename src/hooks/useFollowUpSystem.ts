import { useState, useEffect, useCallback } from 'react';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import { useLeads } from './useLeads';
import { useLeadInteractions } from './useLeadInteractions';
import type { FollowUpConfig, FollowUpNotification } from '@/types/leadInteractions';
import type { Lead } from '@/types/leads';

const DEFAULT_CONFIG: FollowUpConfig = {
  diasParaFollowUp: 3,
  ativo: true,
  statusMonitorado: 'orcamento_enviado'
};

export function useFollowUpSystem() {
  const { leads, updateLead } = useLeads();
  const { addInteraction } = useLeadInteractions();
  
  const [config, setConfig] = useState<FollowUpConfig>(() => 
    storage.load(`${STORAGE_KEYS.LEADS}_followup_config`, DEFAULT_CONFIG)
  );

  const [notifications, setNotifications] = useState<FollowUpNotification[]>(() =>
    storage.load(`${STORAGE_KEYS.LEADS}_followup_notifications`, [])
  );

  // Save config changes
  useEffect(() => {
    storage.save(`${STORAGE_KEYS.LEADS}_followup_config`, config);
  }, [config]);

  // Save notifications changes
  useEffect(() => {
    storage.save(`${STORAGE_KEYS.LEADS}_followup_notifications`, notifications);
  }, [notifications]);

  const calculateDaysSinceLastChange = useCallback((lead: Lead): number => {
    const statusChangeDate = lead.statusTimestamp || lead.dataCriacao;
    const daysDiff = Math.floor(
      (new Date().getTime() - new Date(statusChangeDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysDiff;
  }, []);

  const checkForFollowUps = useCallback(() => {
    if (!config.ativo) return;

    const leadsNeedingFollowUp = leads.filter(lead => {
      if (lead.status !== config.statusMonitorado) return false;
      
      const daysSinceChange = calculateDaysSinceLastChange(lead);
      return daysSinceChange >= config.diasParaFollowUp && !lead.needsFollowUp;
    });

    leadsNeedingFollowUp.forEach(lead => {
      const daysSinceChange = calculateDaysSinceLastChange(lead);
      
      // Mark lead as needing follow-up and move to follow-up column
      updateLead(lead.id, {
        needsFollowUp: true,
        diasSemInteracao: daysSinceChange,
        status: 'followup' // Auto-move to follow-up column
      });

      // Create notification
      const notification: FollowUpNotification = {
        id: `followup_${Date.now()}_${lead.id}`,
        leadId: lead.id,
        leadNome: lead.nome,
        diasSemInteracao: daysSinceChange,
        timestamp: new Date().toISOString(),
        visualizada: false
      };

      setNotifications(prev => [notification, ...prev.filter(n => n.leadId !== lead.id)]);

      // Add interaction
      addInteraction(
        lead.id,
        'followup',
        `Sistema detectou necessidade de follow-up após ${daysSinceChange} dias sem interação`,
        true,
        `Lead foi automaticamente movido para coluna "Follow-up" após ${daysSinceChange} dias em "${config.statusMonitorado}"`
      );
    });
  }, [leads, config, calculateDaysSinceLastChange, updateLead, addInteraction]);

  // Run follow-up check periodically
  useEffect(() => {
    checkForFollowUps();
    
    const interval = setInterval(checkForFollowUps, 60000 * 60); // Check every hour
    return () => clearInterval(interval);
  }, [checkForFollowUps]);

  const updateConfig = useCallback((newConfig: Partial<FollowUpConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

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
    checkForFollowUps
  };
}