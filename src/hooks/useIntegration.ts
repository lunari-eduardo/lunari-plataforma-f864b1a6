/**
 * Integração Orçamento ↔ Agenda.
 *
 * Lê appointments via `useAppointmentsRangeQuery` (módulo Agenda) com janela
 * ampla (-6/+12 meses) e usa `useAppointmentMutations` para criar/atualizar/
 * remover. Não depende mais de `useAppointments`/`AgendaContext`.
 */
import { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { format, addMonths, subMonths } from 'date-fns';
import { useOrcamentos } from './useOrcamentos';
import { toast } from '@/hooks/use-toast';
import { parseDateFromStorage } from '@/utils/dateUtils';
import {
  useAppointmentsRangeQuery,
  useAppointmentMutations,
} from '@/modules/agenda/presentation';

type AppointmentLike = {
  id: string;
  status: 'confirmado' | 'a confirmar';
  client?: string;
  orcamentoId?: string;
  origem?: 'agenda' | 'orcamento';
};

export const useIntegration = () => {
  const [isReady, setIsReady] = useState(false);

  const orcamentosHook = useOrcamentos();
  const { orcamentos = [], atualizarOrcamento } = orcamentosHook || {};

  // Janela ampla — orçamentos podem ser agendados meses à frente
  const range = useMemo(() => {
    const now = new Date();
    return {
      start: format(subMonths(now, 6), 'yyyy-MM-dd'),
      end: format(addMonths(now, 12), 'yyyy-MM-dd'),
    };
  }, []);
  const appointmentsQuery = useAppointmentsRangeQuery(range);
  const appointments = (appointmentsQuery.data ?? []) as AppointmentLike[];

  const { addAppointment, updateAppointment, deleteAppointment } = useAppointmentMutations();

  const syncInProgressRef = useRef(false);
  const lastSyncTimeRef = useRef<Record<string, number>>({});
  const createdAppointmentsRef = useRef<Set<string>>(new Set());

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
    return !(appointment.id?.startsWith('orcamento-') || (appointment as any).origem === 'orcamento');
  }, []);

  const shouldSync = useCallback((id: string, currentTime: number) => {
    const lastSync = lastSyncTimeRef.current[id] || 0;
    if (currentTime - lastSync < 100) return false;
    lastSyncTimeRef.current[id] = currentTime;
    return true;
  }, []);

  useEffect(() => {
    if (orcamentos && !appointmentsQuery.isLoading) {
      setIsReady(true);
    }
  }, [orcamentos, appointmentsQuery.isLoading]);

  // Orçamento fechado → cria agendamento
  useEffect(() => {
    if (!isReady || syncInProgressRef.current) return;

    const orcamentosFechados = orcamentos.filter(orc => orc.status === 'fechado');

    orcamentosFechados.forEach(async orcamento => {
      const currentTime = Date.now();
      if (!shouldSync(`create-${orcamento.id}`, currentTime)) return;
      if (createdAppointmentsRef.current.has(orcamento.id)) return;

      const existingAppointment = appointments.find(app =>
        app.id === `orcamento-${orcamento.id}` ||
        (app as any).orcamentoId === orcamento.id
      );

      if (!existingAppointment) {
        const appointmentDate = parseDateFromStorage(orcamento.data);
        if (isNaN(appointmentDate.getTime())) {
          console.warn(`Data inválida no orçamento ${orcamento.id}: ${orcamento.data}`);
          return;
        }

        syncInProgressRef.current = true;

        const newAppointment = {
          title: orcamento.cliente.nome,
          date: appointmentDate,
          time: orcamento.hora,
          type: orcamento.categoria,
          client: orcamento.cliente.nome,
          status: 'confirmado' as const,
          description: orcamento.detalhes,
          packageId: orcamento.pacotes[0]?.id || undefined,
          paidAmount: 0,
          email: orcamento.cliente.email,
          whatsapp: orcamento.cliente.telefone,
          orcamentoId: orcamento.id,
          origem: 'orcamento' as const,
        };

        console.log('🔵 [APPOINTMENT-CREATE]', {
          orcamentoId: orcamento.id,
          source: 'useIntegration',
          timestamp: new Date().toISOString(),
        });

        try {
          await addAppointment(newAppointment);
          createdAppointmentsRef.current.add(orcamento.id);
          toast({
            title: 'Agendamento criado automaticamente',
            description: `Orçamento de ${orcamento.cliente.nome} foi confirmado e adicionado à agenda.`,
          });
        } catch (error) {
          console.error('❌ Erro ao criar agendamento automático:', error);
        }

        setTimeout(() => {
          syncInProgressRef.current = false;
        }, 50);
      }
    });
  }, [orcamentos, appointments, addAppointment, shouldSync, isReady]);

  // Orçamento perdido → remove agendamento
  const manualDeletionInProgressRef = useRef(false);

  useEffect(() => {
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
            appointmentId: relatedAppointment.id,
          });
          await deleteAppointment(relatedAppointment.id);
          toast({
            title: 'Agendamento removido',
            description: `Orçamento de ${orcamento.cliente.nome} foi cancelado e removido da agenda.`,
            variant: 'destructive',
          });
        } catch (error) {
          console.error('❌ Erro ao remover agendamento:', error);
        }
        setTimeout(() => {
          syncInProgressRef.current = false;
        }, 50);
      }
    });
  }, [orcamentos, appointments, deleteAppointment, shouldSync, isReady]);

  // Agendamentos confirmados sem orçamento "fechado" → voltam para "a confirmar"
  useEffect(() => {
    if (!isReady || syncInProgressRef.current) return;

    const agendamentosOrfaos = appointments.filter(appointment => {
      if (!isFromBudget(appointment) || appointment.status !== 'confirmado') return false;
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
      setTimeout(() => {
        syncInProgressRef.current = false;
      }, 50);
    });
  }, [orcamentos, appointments, isFromBudget, getBudgetId, updateAppointment, shouldSync, isReady]);

  // Limpeza manual de órfãos
  const cleanupOrphanedAppointments = useCallback(() => {
    if (orcamentos.length === 0) {
      console.warn('⚠️ [useIntegration] Orçamentos não carregados, cancelando limpeza automática');
      return 0;
    }

    const orphanedAppointments = appointments.filter(appointment => {
      if (!isFromBudget(appointment)) return false;
      const budgetId = getBudgetId(appointment);
      if (!budgetId) return true;
      const correspondingBudget = orcamentos.find(orc => orc.id === budgetId);
      return !correspondingBudget;
    });

    if (orphanedAppointments.length > 0) {
      console.log('🗑️ [useIntegration] Removendo agendamentos órfãos:',
        orphanedAppointments.map(a => ({ id: a.id, client: a.client }))
      );
    }

    orphanedAppointments.forEach(appointment => {
      deleteAppointment(appointment.id);
      toast({
        title: 'Agendamento órfão removido',
        description: `Agendamento de ${appointment.client} foi removido pois não tem orçamento correspondente.`,
        variant: 'destructive',
      });
    });

    return orphanedAppointments.length;
  }, [appointments, orcamentos, isFromBudget, getBudgetId, deleteAppointment]);

  return {
    isFromBudget,
    getBudgetId,
    canEditFully,
    cleanupOrphanedAppointments,
  };
};
