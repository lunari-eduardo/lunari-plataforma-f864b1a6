import { useEffect } from 'react';
import { useLeads } from './useLeads';
import { useOrcamentos } from './useOrcamentos';
import { useLeadInteractions } from './useLeadInteractions';
import { useAppContext } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import type { Orcamento } from '@/types/orcamentos';
import type { Lead } from '@/types/leads';

/**
 * Hook for managing bidirectional synchronization between leads and budgets
 */
export function useLeadOrcamentoSync() {
  const { leads, updateLead } = useLeads();
  const { orcamentos, atualizarOrcamento } = useOrcamentos();
  const { addInteraction } = useLeadInteractions();
  const { addAppointment } = useAppContext();
  const { toast } = useToast();

  // Sync lead status when budget status changes
  useEffect(() => {
    const handleBudgetStatusChange = (event: CustomEvent) => {
      const { orcamentoId, newStatus, oldStatus } = event.detail;
      const orcamento = orcamentos.find(o => o.id === orcamentoId);
      
      if (!orcamento?.leadId) return;
      
      const lead = leads.find(l => l.id === orcamento.leadId);
      if (!lead) return;

      // Sync lead status based on budget status
      if (newStatus === 'enviado' && oldStatus !== 'enviado') {
        // Budget was sent -> move lead to "orcamento_enviado"
        updateLead(lead.id, {
          status: 'orcamento_enviado',
          needsFollowUp: false,
          statusTimestamp: new Date().toISOString()
        });
        
        addInteraction(
          lead.id,
          'followup',
          'Orçamento enviado - timer de follow-up iniciado',
          true,
          `Orçamento #${orcamento.id} foi enviado`
        );
      }
      
      if (newStatus === 'fechado' && oldStatus !== 'fechado') {
        // Budget was closed -> move lead to "fechado" and create appointment if data/hora exists
        if (orcamento.data && orcamento.hora) {
          // Create appointment
          try {
            addAppointment({
              title: `${orcamento.cliente.nome} - ${orcamento.categoria || 'Sessão'}`,
              date: new Date(orcamento.data),
              time: orcamento.hora,
              type: orcamento.categoria || 'sessao',
              client: orcamento.cliente.nome,
              clienteId: orcamento.cliente.id,
              description: orcamento.descricao || '',
              sessionId: orcamento.sessionId || `budget_${orcamento.id}`,
              status: 'confirmado' as const,
              origem: 'orcamento' as const,
              orcamentoId: orcamento.id,
              packageId: orcamento.packageId,
              produtosIncluidos: orcamento.pacotePrincipal?.produtosIncluidos?.map(p => ({
                id: p.produtoId,
                nome: p.nome,
                quantidade: p.quantidade,
                valorUnitario: p.valorUnitarioCongelado,
                tipo: p.tipo
              })) || []
            });
            
            updateLead(lead.id, {
              status: 'fechado',
              needsScheduling: false,
              scheduledAppointmentId: `budget_${orcamento.id}`
            });
            
            addInteraction(
              lead.id,
              'manual',
              'Orçamento fechado e agendamento criado',
              false,
              `Cliente agendado para ${orcamento.data} às ${orcamento.hora}`
            );
            
            toast({
              title: 'Agendamento Criado',
              description: `${lead.nome} foi agendado automaticamente!`
            });
          } catch (error) {
            console.error('Error creating appointment:', error);
            // Still mark as closed but with scheduling flag
            updateLead(lead.id, {
              status: 'fechado',
              needsScheduling: true
            });
            
            addInteraction(
              lead.id,
              'manual',
              'Orçamento fechado - agendamento pendente',
              false,
              'Erro ao criar agendamento automático'
            );
          }
        } else {
          // No date/time - mark as needing scheduling
          updateLead(lead.id, {
            status: 'fechado',
            needsScheduling: true
          });
          
          addInteraction(
            lead.id,
            'manual',
            'Orçamento fechado - agendamento necessário',
            false,
            'Orçamento não possui data/hora para agendamento automático'
          );
        }
      }
    };

    // Listen for budget status changes
    window.addEventListener('orcamento:statusChanged', handleBudgetStatusChange as EventListener);
    
    return () => {
      window.removeEventListener('orcamento:statusChanged', handleBudgetStatusChange as EventListener);
    };
  }, [leads, orcamentos, updateLead, addInteraction, addAppointment, toast]);

  // Helper function to add one hour to time string
  const addOneHour = (timeStr: string): string => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const newHours = (hours + 1) % 24;
    return `${String(newHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  // Ensure bidirectional links are maintained
  useEffect(() => {
    // Check for orphaned links and repair them
    orcamentos.forEach(orcamento => {
      if (orcamento.leadId) {
        const lead = leads.find(l => l.id === orcamento.leadId);
        if (lead && (!lead.orcamentoIds || !lead.orcamentoIds.includes(orcamento.id))) {
          // Repair missing link on lead side
          const currentIds = lead.orcamentoIds || [];
          updateLead(lead.id, {
            orcamentoIds: [...currentIds, orcamento.id]
          });
        }
      }
    });

    leads.forEach(lead => {
      if (lead.orcamentoIds) {
        lead.orcamentoIds.forEach(orcamentoId => {
          const orcamento = orcamentos.find(o => o.id === orcamentoId);
          if (orcamento && orcamento.leadId !== lead.id) {
            // Repair missing link on budget side
            atualizarOrcamento(orcamentoId, { leadId: lead.id });
          }
        });
      }
      
      // Migrate legacy orcamentoId to orcamentoIds
      if (lead.orcamentoId && (!lead.orcamentoIds || !lead.orcamentoIds.includes(lead.orcamentoId))) {
        const currentIds = lead.orcamentoIds || [];
        updateLead(lead.id, {
          orcamentoIds: [...currentIds, lead.orcamentoId]
        });
      }
    });

    // Auto-link budgets to leads when created
    orcamentos.forEach(orcamento => {
      if (orcamento.leadId && !orcamento.cliente.id) return;
      
      // Try to find matching lead by client
      if (orcamento.cliente?.id && !orcamento.leadId) {
        const matchingLead = leads.find(lead => lead.clienteId === orcamento.cliente.id);
        if (matchingLead) {
          atualizarOrcamento(orcamento.id, { leadId: matchingLead.id });
          const currentIds = matchingLead.orcamentoIds || [];
          if (!currentIds.includes(orcamento.id)) {
            updateLead(matchingLead.id, {
              orcamentoIds: [...currentIds, orcamento.id]
            });
          }
        }
      }
    });
  }, [leads, orcamentos, updateLead, atualizarOrcamento]);

  return {
    // Utility functions for manual operations
    linkLeadToBudget: (leadId: string, orcamentoId: string) => {
      const lead = leads.find(l => l.id === leadId);
      if (lead) {
        const currentIds = lead.orcamentoIds || [];
        if (!currentIds.includes(orcamentoId)) {
          updateLead(leadId, {
            orcamentoIds: [...currentIds, orcamentoId]
          });
        }
      }
      
      atualizarOrcamento(orcamentoId, { leadId });
    },
    
    unlinkLeadFromBudget: (leadId: string, orcamentoId: string) => {
      const lead = leads.find(l => l.id === leadId);
      if (lead && lead.orcamentoIds) {
        updateLead(leadId, {
          orcamentoIds: lead.orcamentoIds.filter(id => id !== orcamentoId)
        });
      }
      
      atualizarOrcamento(orcamentoId, { leadId: undefined });
    }
  };
}