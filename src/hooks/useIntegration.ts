
import { useEffect, useCallback, useRef } from 'react';
import { useOrcamentos } from './useOrcamentos';
import { useAgenda, Appointment } from './useAgenda';
import { toast } from '@/hooks/use-toast';
import { parseDateFromStorage, formatDateForStorage } from '@/utils/dateUtils';

export const useIntegration = () => {
  const { orcamentos, atualizarOrcamento } = useOrcamentos();
  const { appointments, addAppointment, updateAppointment, deleteAppointment } = useAgenda();
  
  // Controle de sincronização para evitar loops infinitos
  const syncInProgressRef = useRef(false);
  const lastSyncTimeRef = useRef<Record<string, number>>({});

  // Utility functions with useCallback to ensure stable references
  const isFromBudget = useCallback((appointment: Appointment) => {
    return appointment.id?.startsWith('orcamento-') || (appointment as any).origem === 'orcamento';
  }, []);
  
  const getBudgetId = useCallback((appointment: Appointment) => {
    if (appointment.id?.startsWith('orcamento-')) {
      return appointment.id.replace('orcamento-', '');
    }
    return (appointment as any).orcamentoId;
  }, []);
  
  const canEditFully = useCallback((appointment: Appointment) => {
    // Agendamentos de orçamentos só podem editar data/hora na agenda
    return !(appointment.id?.startsWith('orcamento-') || (appointment as any).origem === 'orcamento');
  }, []);

  // Função para verificar se deve sincronizar (evita atualizações desnecessárias)
  const shouldSync = useCallback((id: string, currentTime: number) => {
    const lastSync = lastSyncTimeRef.current[id] || 0;
    const timeDiff = currentTime - lastSync;
    
    // Evita sincronizações muito próximas (menos de 100ms)
    if (timeDiff < 100) {
      return false;
    }
    
    lastSyncTimeRef.current[id] = currentTime;
    return true;
  }, []);

  // Monitor orçamentos fechados e criar agendamentos automaticamente
  useEffect(() => {
    if (syncInProgressRef.current) return;

    const orcamentosFechados = orcamentos.filter(orc => orc.status === 'fechado');
    
    orcamentosFechados.forEach(orcamento => {
      const currentTime = Date.now();
      if (!shouldSync(`create-${orcamento.id}`, currentTime)) return;

      // Verificar se já existe um agendamento para este orçamento
      const existingAppointment = appointments.find(app => 
        app.id === `orcamento-${orcamento.id}` || 
        (app as any).orcamentoId === orcamento.id
      );
      
      if (!existingAppointment) {
        // Criar agendamento automático usando função que trata timezone corretamente
        const appointmentDate = parseDateFromStorage(orcamento.data);
        
        // Verificar se a data é válida
        if (isNaN(appointmentDate.getTime())) {
          console.warn(`Data inválida no orçamento ${orcamento.id}: ${orcamento.data}`);
          return;
        }
        
        syncInProgressRef.current = true;
        
        const newAppointment: Omit<Appointment, 'id'> = {
          title: orcamento.cliente.nome,
          date: appointmentDate,
          time: orcamento.hora,
          type: orcamento.categoria,
          client: orcamento.cliente.nome,
          status: 'confirmado',
          description: orcamento.detalhes,
          packageId: orcamento.pacotes[0]?.id || undefined,
          paidAmount: 0,
          email: orcamento.cliente.email,
          whatsapp: orcamento.cliente.telefone,
          orcamentoId: orcamento.id,
          origem: 'orcamento'
        };

        // Criar o agendamento com ID específico
        const appointment = addAppointment(newAppointment);
        updateAppointment(appointment.id, { 
          id: `orcamento-${orcamento.id}`
        });

        toast({
          title: "Agendamento criado automaticamente",
          description: `Orçamento de ${orcamento.cliente.nome} foi confirmado e adicionado à agenda.`,
        });
        
        // Reset flag após um pequeno delay
        setTimeout(() => {
          syncInProgressRef.current = false;
        }, 50);
      }
    });
  }, [orcamentos, appointments, addAppointment, updateAppointment, shouldSync]);

  // Monitor agendamentos removidos de orçamentos cancelados
  useEffect(() => {
    if (syncInProgressRef.current) return;

    const orcamentosCancelados = orcamentos.filter(orc => orc.status === 'cancelado');
    
    orcamentosCancelados.forEach(orcamento => {
      const currentTime = Date.now();
      if (!shouldSync(`delete-${orcamento.id}`, currentTime)) return;

      const relatedAppointment = appointments.find(app => 
        app.id === `orcamento-${orcamento.id}` || 
        (app as any).orcamentoId === orcamento.id
      );
      
      if (relatedAppointment) {
        syncInProgressRef.current = true;
        
        deleteAppointment(relatedAppointment.id);
        toast({
          title: "Agendamento removido",
          description: `Orçamento de ${orcamento.cliente.nome} foi cancelado e removido da agenda.`,
          variant: "destructive"
        });
        
        // Reset flag após um pequeno delay
        setTimeout(() => {
          syncInProgressRef.current = false;
        }, 50);
      }
    });
  }, [orcamentos, appointments, deleteAppointment, shouldSync]);

  // Monitor mudanças de data em agendamentos para sincronizar com orçamentos
  // REMOVIDO: Esta sincronização bidirecional estava causando o loop infinito
  // Agora a sincronização é apenas Orçamento → Agendamento

  return {
    // Funções de utilidade para identificar origem dos agendamentos
    isFromBudget,
    getBudgetId,
    canEditFully
  };
};
