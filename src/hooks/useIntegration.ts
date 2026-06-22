
import { useEffect, useCallback, useRef, useState } from 'react';
import { useOrcamentos } from './useOrcamentos';
import { useAppointments } from './useAppointments';
import { toast } from '@/hooks/use-toast';
import { parseDateFromStorage, formatDateForStorage } from '@/utils/dateUtils';
import { Appointment } from '@/modules/agenda/presentation';

export const useIntegration = () => {
  // Defensive hook initialization to prevent conditional calls
  const [isReady, setIsReady] = useState(false);
  
  // SEMPRE chamar os hooks no mesmo lugar (regra dos hooks do React)
  const orcamentosHook = useOrcamentos();
  const appointmentsHook = useAppointments();
  
  // Extract with null checks
  const { orcamentos = [], atualizarOrcamento } = orcamentosHook || {};
  const { appointments = [], addAppointment, updateAppointment, deleteAppointment } = appointmentsHook || {};
  
  // Controle de sincronização para evitar loops infinitos
  const syncInProgressRef = useRef(false);
  const lastSyncTimeRef = useRef<Record<string, number>>({});
  // FASE 4: Rastrear orçamentos já processados para evitar duplicação
  const createdAppointmentsRef = useRef<Set<string>>(new Set());

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
    
    orcamentosFechados.forEach(async orcamento => {
      const currentTime = Date.now();
      if (!shouldSync(`create-${orcamento.id}`, currentTime)) return;

      // FASE 4: Verificar se já criamos este appointment nesta sessão
      if (createdAppointmentsRef.current.has(orcamento.id)) {
        return;
      }

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

        // FASE 4: Criar o agendamento (sem tentar modificar o ID depois)
        console.log('🔵 [APPOINTMENT-CREATE]', {
          orcamentoId: orcamento.id,
          source: 'useIntegration',
          timestamp: new Date().toISOString()
        });
        
        const appointment = await addAppointment(newAppointment);
        
        // Marcar como criado
        createdAppointmentsRef.current.add(orcamento.id);

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
  // ✅ FASE 6: Adicionar flag para evitar execução durante deleção manual
  const manualDeletionInProgressRef = useRef(false);
  
  useEffect(() => {
    // ✅ CORREÇÃO: Não executar se há deleção manual em andamento
    if (!isReady || syncInProgressRef.current || manualDeletionInProgressRef.current) return;

    const orcamentosPerdidos = orcamentos.filter(orc => orc.status === 'perdido');
    
    orcamentosPerdidos.forEach(async (orcamento) => {
      const currentTime = Date.now();
      if (!shouldSync(`delete-${orcamento.id}`, currentTime)) return;

      const relatedAppointment = appointments.find(app => 
        app.id === `orcamento-${orcamento.id}` || 
        (app as any).orcamentoId === orcamento.id
      );
      
      if (relatedAppointment) {
        syncInProgressRef.current = true;
        
        try {
          console.log('🔵 [useIntegration] Auto-deletando appointment de orçamento perdido:', {
            orcamentoId: orcamento.id,
            appointmentId: relatedAppointment.id
          });
          await deleteAppointment(relatedAppointment.id);
          toast({
            title: "Agendamento removido",
            description: `Orçamento de ${orcamento.cliente.nome} foi cancelado e removido da agenda.`,
            variant: "destructive"
          });
        } catch (error) {
          console.error('❌ Erro ao remover agendamento:', error);
        }
        
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

    agendamentosOrfaos.forEach(async (appointment) => {
      const currentTime = Date.now();
      if (!shouldSync(`fix-${appointment.id}`, currentTime)) return;

      syncInProgressRef.current = true;
      
      try {
        await updateAppointment(appointment.id, { status: 'a confirmar' });
      } catch (error) {
        console.error('Erro ao atualizar agendamento:', error);
      }
      
      // Reset flag após um pequeno delay
      setTimeout(() => {
        syncInProgressRef.current = false;
      }, 50);
    });
  }, [orcamentos, appointments, isFromBudget, getBudgetId, updateAppointment, shouldSync]);

  // Monitor mudanças de data em agendamentos para sincronizar com orçamentos
  // REMOVIDO: Esta sincronização bidirecional estava causando o loop infinito
  // Agora a sincronização é apenas Orçamento → Agendamento

  // Função para limpar agendamentos órfãos - FASE 1: APENAS MANUAL (não automático)
  // Esta função agora só é executada quando chamada explicitamente pelo usuário
  const cleanupOrphanedAppointments = useCallback(() => {
    // ✅ CORREÇÃO: Não executar se orçamentos não carregaram completamente
    if (orcamentos.length === 0) {
      console.warn('⚠️ [useIntegration] Orçamentos não carregados, cancelando limpeza automática');
      return 0;
    }
    
    const orphanedAppointments = appointments.filter(appointment => {
      // Se não é de orçamento, não é órfão
      if (!isFromBudget(appointment)) return false;
      
      // Verificar se existe o orçamento correspondente
      const budgetId = getBudgetId(appointment);
      if (!budgetId) return true; // Órfão se não tem ID de orçamento
      
      const correspondingBudget = orcamentos.find(orc => orc.id === budgetId);
      return !correspondingBudget; // Órfão se não encontrou o orçamento
    });
    
    // ✅ CORREÇÃO: Log antes de deletar para debug
    if (orphanedAppointments.length > 0) {
      console.log('🗑️ [useIntegration] Removendo agendamentos órfãos:', 
        orphanedAppointments.map(a => ({ id: a.id, client: a.client }))
      );
    }
    
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

  // ✅ FASE 1: REMOVIDO - Limpeza automática agressiva
  // A limpeza agora só é executada manualmente via cleanupOrphanedAppointments()
  // Isso evita deleções não intencionais quando orçamentos ainda estão carregando

  return {
    // Funções de utilidade para identificar origem dos agendamentos
    isFromBudget,
    getBudgetId,
    canEditFully,
    cleanupOrphanedAppointments
  };
};
