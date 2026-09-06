import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useWorkflowPackageData } from '@/hooks/useWorkflowPackageData';
import { isWorkflowRealtimeV2Enabled } from '@/features/workflow/realtime';

import type { WorkflowSession, PaymentActionType } from './workflow-realtime/types';
import {
  fetchWorkflowSessionsWithPayments,
  runBackgroundRefreezing,
} from './workflow-realtime/sessionLoader';
import {
  createWorkflowSession,
  deleteWorkflowSession,
  createSessionFromAppointmentPayload,
} from './workflow-realtime/sessionMutations';
import { executeSessionUpdate } from './workflow-realtime/sessionUpdateSanitizer';
import { useRealtimeSubscription } from './workflow-realtime/useRealtimeSubscription';

export type { WorkflowSession };

export const useWorkflowRealtime = () => {
  const [sessions, setSessions] = useState<WorkflowSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use package data resolution hook
  const { convertSessionToData } = useWorkflowPackageData();

  // Load sessions from Supabase
  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading workflow sessions from Supabase...');

      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();

      if (!authSession?.user) {
        console.error('❌ User not authenticated');
        setError('User not authenticated');
        return;
      }

      const userId = authSession.user.id;

      // V2 gate: quando o realtime V2 está ativo, o WorkflowCacheContext já
      // hidrata por mês via repositórios
      if (isWorkflowRealtimeV2Enabled()) {
        console.log('⏭️  [useWorkflowRealtime] V2 ativo → loadSessions skip (cache assume hidratação)');
        setSessions([]);
        setError(null);
        return;
      }

      const sessionsWithPayments = await fetchWorkflowSessionsWithPayments(userId);

      setSessions(sessionsWithPayments);
      setError(null);

      // Re-freeze em background (não bloqueia UI)
      runBackgroundRefreezing(sessionsWithPayments, userId);
    } catch (err) {
      console.error('Error loading workflow sessions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
      toast({
        title: 'Erro ao carregar sessões',
        description: 'Não foi possível carregar as sessões do workflow.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Create new session with frozen pricing rules
  const createSession = useCallback(
    async (sessionData: Omit<WorkflowSession, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      try {
        const {
          data: { session: authSession },
        } = await supabase.auth.getSession();
        if (!authSession?.user) throw new Error('User not authenticated');

        const data = await createWorkflowSession(sessionData, authSession.user.id);

        setSessions((prev) => [data, ...prev]);
        toast({
          title: 'Sessão criada',
          description: 'Sessão criada com sucesso.',
        });

        return data;
      } catch (err) {
        console.error('Error creating session:', err);
        toast({
          title: 'Erro ao criar sessão',
          description: err instanceof Error ? err.message : 'Failed to create session',
          variant: 'destructive',
        });
        throw err;
      }
    },
    [],
  );

  // Update session with field mapping and sanitization
  const updateSession = useCallback(
    async (id: string, updates: any, silent: boolean = false) => {
      try {
        const {
          data: { session: authSession },
        } = await supabase.auth.getSession();
        if (!authSession?.user) throw new Error('User not authenticated');

        const userId = authSession.user.id;

        // Find current session to perform diff check
        let currentSession = sessions.find((s) => s.id === id) as any;
        if (!currentSession) {
          const { data: fresh } = await supabase
            .from('clientes_sessoes')
            .select('*, galerias(valor_total_vendido, total_fotos_extras_vendidas)')
            .eq('id', id)
            .eq('user_id', userId)
            .maybeSingle();
          if (fresh) {
            currentSession = fresh as any;
          } else {
            console.warn('⚠️ Session not found for diff check:', id);
          }
        }

        const result = await executeSessionUpdate(id, updates, currentSession, userId);

        if (!result.hasChanges) {
          console.log('📝 No changes detected, skipping update for session:', id);
          return;
        }

        const { sanitizedUpdates, fullUpdatedSession } = result;

        if (fullUpdatedSession) {
          setSessions((prev) => prev.map((session) => (session.id === id ? fullUpdatedSession : session)));

          const { workflowStore } = await import('@/features/workflow');
          workflowStore.upsert(fullUpdatedSession);

          window.dispatchEvent(
            new CustomEvent('workflow-cache-merge', {
              detail: { session: fullUpdatedSession },
            }),
          );

          window.dispatchEvent(
            new CustomEvent('workflow-session-updated', {
              detail: {
                sessionId: id,
                updates: sanitizedUpdates,
                fullSession: fullUpdatedSession,
                timestamp: new Date().toISOString(),
              },
            }),
          );
        } else {
          setSessions((prev) =>
            prev.map((session) => (session.id === id ? { ...session, ...sanitizedUpdates } : session)),
          );

          window.dispatchEvent(
            new CustomEvent('workflow-session-updated', {
              detail: { sessionId: id, updates: sanitizedUpdates, timestamp: new Date().toISOString() },
            }),
          );
        }

        if (!silent) {
          toast({
            title: 'Sessão atualizada',
            description: 'Sessão atualizada com sucesso.',
          });
        }
      } catch (err) {
        console.error('Error updating session:', err);
        if (!silent) {
          toast({
            title: 'Erro ao atualizar sessão',
            description: err instanceof Error ? err.message : 'Failed to update session',
            variant: 'destructive',
          });
        }
        throw err;
      }
    },
    [sessions],
  );

  // Delete session with flexible options — usa RPC unificada
  const deleteSession = useCallback(
    async (id: string, paymentAction: PaymentActionType = 'preserve') => {
      try {
        const session = sessions.find((s) => s.id === id);
        if (!session) throw new Error('Session not found');

        const { deleted, description } = await deleteWorkflowSession(id, paymentAction);

        if (deleted) {
          setSessions((prev) => prev.filter((s) => s.id !== id));
        }

        toast({ title: 'Sessão excluída', description });
      } catch (err) {
        console.error('Error deleting session:', err);
        toast({
          title: 'Erro ao excluir sessão',
          description: err instanceof Error ? err.message : 'Failed to delete session',
          variant: 'destructive',
        });
        throw err;
      }
    },
    [sessions],
  );

  // Convert confirmed appointment to session
  const createSessionFromAppointment = useCallback(
    async (appointmentId: string, appointmentData: any) => {
      try {
        const {
          data: { session: authSession },
        } = await supabase.auth.getSession();
        if (!authSession?.user) throw new Error('User not authenticated');

        const newSession = await createSessionFromAppointmentPayload(
          appointmentId,
          appointmentData,
          authSession.user.id,
        );

        setSessions((prev) => [newSession, ...prev]);
        toast({
          title: 'Sessão criada',
          description: 'Sessão criada a partir do agendamento com sucesso.',
        });

        return newSession;
      } catch (err) {
        console.error('Error creating session from appointment:', err);
        throw err;
      }
    },
    [],
  );

  // Realtime subscription
  useRealtimeSubscription({
    setSessions,
    loadSessions,
  });

  // Compute sessionsData using the package data hook
  const sessionsData = useMemo(() => {
    return sessions.map((session) => convertSessionToData(session));
  }, [sessions, convertSessionToData]);

  return {
    sessions,
    sessionsData,
    loading,
    error,
    createSession,
    updateSession,
    deleteSession,
    createSessionFromAppointment,
    refetch: loadSessions,
  };
};