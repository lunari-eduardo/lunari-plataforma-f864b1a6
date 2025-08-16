
import { useEffect, useCallback, useRef, useState } from 'react';
import { useOrcamentos } from './useOrcamentos';
import { useAgenda, Appointment } from './useAgenda';
import { toast } from '@/hooks/use-toast';
import { parseDateFromStorage, formatDateForStorage } from '@/utils/dateUtils';

export const useIntegration = () => {
  // Defensive hook initialization to prevent conditional calls
  const [isReady, setIsReady] = useState(false);
  
  // SEMPRE chamar os hooks no mesmo lugar (regra dos hooks do React)
  const orcamentosHook = useOrcamentos();
  const agendaHook = useAgenda();
  
  // Extract with null checks
  const { orcamentos = [], atualizarOrcamento } = orcamentosHook || {};
  const { appointments = [], addAppointment, updateAppointment, deleteAppointment } = agendaHook || {};
  
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

  // Initialize ready state
  useEffect(() => {
    if (orcamentos && appointments && addAppointment && updateAppointment && deleteAppointment) {
      setIsReady(true);
    }
  }, [orcamentos, appointments, addAppointment, updateAppointment, deleteAppointment]);

  // Monitor orçamentos fechados e criar agendamentos automaticamente
  useEffect(() => {
    if (!isReady || syncInProgressRef.current) return;

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

  // Monitor agendamentos removidos de orçamentos cancelados ou não fechados
  useEffect(() => {
    if (!isReady || syncInProgressRef.current) return;

    const orcamentosPerdidos = orcamentos.filter(orc => orc.status === 'perdido');
    
    orcamentosPerdidos.forEach(orcamento => {
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

  // Monitor agendamentos "confirmado" cujos orçamentos não estão mais "fechado"
  useEffect(() => {
    if (!isReady || syncInProgressRef.current) return;

    const agendamentosOrfaos = appointments.filter(appointment => {
      // Só verificar agendamentos de orçamento que estão confirmados
      if (!isFromBudget(appointment) || appointment.status !== 'confirmado') {
        return false;
      }

      const budgetId = getBudgetId(appointment);
      if (!budgetId) return true;

      const correspondingBudget = orcamentos.find(orc => orc.id === budgetId);
      return correspondingBudget && correspondingBudget.status !== 'fechado';
    });

    agendamentosOrfaos.forEach(appointment => {
      const currentTime = Date.now();
      if (!shouldSync(`fix-${appointment.id}`, currentTime)) return;

      syncInProgressRef.current = true;
      
      updateAppointment(appointment.id, { status: 'a confirmar' });
      
      // Reset flag após um pequeno delay
      setTimeout(() => {
        syncInProgressRef.current = false;
      }, 50);
    });
  }, [orcamentos, appointments, isFromBudget, getBudgetId, updateAppointment, shouldSync]);

  // Monitor mudanças de data em agendamentos para sincronizar com orçamentos
  // REMOVIDO: Esta sincronização bidirecional estava causando o loop infinito
  // Agora a sincronização é apenas Orçamento → Agendamento

  // Função para limpar agendamentos órfãos
  const cleanupOrphanedAppointments = useCallback(() => {
    const orphanedAppointments = appointments.filter(appointment => {
      // Se não é de orçamento, não é órfão
      if (!isFromBudget(appointment)) return false;
      
      // Verificar se existe o orçamento correspondente
      const budgetId = getBudgetId(appointment);
      if (!budgetId) return true; // Órfão se não tem ID de orçamento
      
      const correspondingBudget = orcamentos.find(orc => orc.id === budgetId);
      return !correspondingBudget; // Órfão se não encontrou o orçamento
    });
    
    // Remover agendamentos órfãos
    orphanedAppointments.forEach(appointment => {
      deleteAppointment(appointment.id);
      toast({
        title: "Agendamento órfão removido",
        description: `Agendamento de ${appointment.client} foi removido pois não tem orçamento correspondente.`,
        variant: "destructive"
      });
    });
    
    return orphanedAppointments.length;
  }, [appointments, orcamentos, isFromBudget, getBudgetId, deleteAppointment]);

  // Executar limpeza na inicialização
  useEffect(() => {
    const timer = setTimeout(() => {
      const removedCount = cleanupOrphanedAppointments();
      if (removedCount > 0) {
        console.log(`Limpeza executada: ${removedCount} agendamentos órfãos removidos`);
      }
    }, 1000); // Delay para garantir que tudo foi carregado

    return () => clearTimeout(timer);
  }, [cleanupOrphanedAppointments]);

  return {
    // Funções de utilidade para identificar origem dos agendamentos
    isFromBudget,
    getBudgetId,
    canEditFully,
    cleanupOrphanedAppointments
  };
};
