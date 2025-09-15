import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { WorkflowSupabaseService } from '@/services/WorkflowSupabaseService';

interface IntegrityIssue {
  type: 'confirmed_without_session' | 'orphaned_session' | 'mismatched_session_id';
  appointmentId?: string;
  sessionId?: string;
  description: string;
}

/**
 * Hook to check and repair data integrity between appointments and workflow sessions
 */
export const useDataIntegrityCheck = () => {
  const [issues, setIssues] = useState<IntegrityIssue[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);

  const runIntegrityCheck = async () => {
    setIsChecking(true);
    const foundIssues: IntegrityIssue[] = [];

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) return;

      // Check 1: Confirmed appointments without sessions
      const { data: confirmedAppointments } = await supabase
        .from('appointments')
        .select('*')
        .eq('user_id', user.user.id)
        .eq('status', 'confirmado');

      if (confirmedAppointments) {
        for (const appointment of confirmedAppointments) {
          const { data: session } = await supabase
            .from('clientes_sessoes')
            .select('id')
            .eq('user_id', user.user.id)
            .or(`appointment_id.eq.${appointment.id},session_id.eq.${appointment.session_id}`)
            .maybeSingle();

          if (!session) {
            foundIssues.push({
              type: 'confirmed_without_session',
              appointmentId: appointment.id,
              description: `Agendamento confirmado "${appointment.title}" sem sessão no workflow`
            });
          }
        }
      }

      // Check 2: Sessions with appointment_id that don't exist
      const { data: sessions } = await supabase
        .from('clientes_sessoes')
        .select('*')
        .eq('user_id', user.user.id)
        .not('appointment_id', 'is', null);

      if (sessions) {
        for (const session of sessions) {
          const { data: appointment } = await supabase
            .from('appointments')
            .select('id')
            .eq('id', session.appointment_id)
            .eq('user_id', user.user.id)
            .maybeSingle();

          if (!appointment) {
            foundIssues.push({
              type: 'orphaned_session',
              sessionId: session.id,
              description: `Sessão "${session.descricao || session.session_id}" vinculada a agendamento inexistente`
            });
          }
        }
      }

      // Check 3: Mismatched session_ids
      if (confirmedAppointments) {
        for (const appointment of confirmedAppointments) {
          if (appointment.session_id) {
            const { data: session } = await supabase
              .from('clientes_sessoes')
              .select('*')
              .eq('session_id', appointment.session_id)
              .eq('user_id', user.user.id)
              .maybeSingle();

            if (session && session.appointment_id !== appointment.id) {
              foundIssues.push({
                type: 'mismatched_session_id',
                appointmentId: appointment.id,
                sessionId: session.id,
                description: `Agendamento "${appointment.title}" com session_id não correspondente`
              });
            }
          }
        }
      }

      console.log('🔍 [IntegrityCheck] Found issues:', foundIssues);
      setIssues(foundIssues);

    } catch (error) {
      console.error('❌ [IntegrityCheck] Error during integrity check:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const repairAllIssues = async () => {
    setIsRepairing(true);
    let repairedCount = 0;

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) return;

      for (const issue of issues) {
        try {
          switch (issue.type) {
            case 'confirmed_without_session':
              if (issue.appointmentId) {
                // Get appointment data and create session
                const { data: appointment } = await supabase
                  .from('appointments')
                  .select('*')
                  .eq('id', issue.appointmentId)
                  .eq('user_id', user.user.id)
                  .single();

                if (appointment) {
                  await WorkflowSupabaseService.createSessionFromAppointment(
                    appointment.id,
                    appointment
                  );
                  repairedCount++;
                  console.log('✅ [IntegrityRepair] Created session for appointment:', appointment.id);
                }
              }
              break;

            case 'orphaned_session':
              if (issue.sessionId) {
                // Unlink orphaned session
                await supabase
                  .from('clientes_sessoes')
                  .update({ 
                    appointment_id: null,
                    status: 'desvinculado'
                  })
                  .eq('id', issue.sessionId)
                  .eq('user_id', user.user.id);

                repairedCount++;
                console.log('✅ [IntegrityRepair] Unlinked orphaned session:', issue.sessionId);
              }
              break;

            case 'mismatched_session_id':
              if (issue.appointmentId && issue.sessionId) {
                // Update session to link correctly
                await supabase
                  .from('clientes_sessoes')
                  .update({ appointment_id: issue.appointmentId })
                  .eq('id', issue.sessionId)
                  .eq('user_id', user.user.id);

                repairedCount++;
                console.log('✅ [IntegrityRepair] Fixed session link:', issue.sessionId);
              }
              break;
          }
        } catch (error) {
          console.error('❌ [IntegrityRepair] Error repairing issue:', issue, error);
        }
      }

      console.log(`✅ [IntegrityRepair] Repaired ${repairedCount} issues`);
      
      // Re-run check to update issues list
      await runIntegrityCheck();

    } catch (error) {
      console.error('❌ [IntegrityRepair] Error during repair:', error);
    } finally {
      setIsRepairing(false);
    }

    return repairedCount;
  };

  // Auto-run integrity check on mount
  useEffect(() => {
    runIntegrityCheck();
  }, []);

  return {
    issues,
    isChecking,
    isRepairing,
    runIntegrityCheck,
    repairAllIssues,
    hasIssues: issues.length > 0
  };
};