import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface WorkflowInfo {
  hasSession: boolean;
  hasPayments: boolean;
  sessionId?: string;
  totalPaid?: number;
}

/**
 * Hook to check if an appointment has workflow session and payments
 */
export const useAppointmentWorkflowInfo = (appointmentId?: string) => {
  const [workflowInfo, setWorkflowInfo] = useState<WorkflowInfo>({
    hasSession: false,
    hasPayments: false
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!appointmentId) {
      setWorkflowInfo({ hasSession: false, hasPayments: false });
      return;
    }

    const checkWorkflowInfo = async () => {
      setLoading(true);
      try {
        const { data: user } = await supabase.auth.getUser();
        if (!user?.user) return;

        // Get appointment data first
        const { data: appointment } = await supabase
          .from('appointments')
          .select('session_id')
          .eq('id', appointmentId)
          .eq('user_id', user.user.id)
          .single();

        if (!appointment) {
          setWorkflowInfo({ hasSession: false, hasPayments: false });
          return;
        }

        // Check for workflow session
        const { data: session } = await supabase
          .from('clientes_sessoes')
          .select('session_id, valor_pago')
          .eq('user_id', user.user.id)
          .or(`appointment_id.eq.${appointmentId},session_id.eq.${appointment.session_id}`)
          .maybeSingle();

        if (session) {
          // Check for transactions/payments
          const { data: transactions } = await supabase
            .from('clientes_transacoes')
            .select('valor')
            .eq('session_id', session.session_id)
            .eq('user_id', user.user.id)
            .eq('tipo', 'pagamento');

          const totalPaid = transactions?.reduce((sum, t) => sum + Number(t.valor), 0) || 0;

          setWorkflowInfo({
            hasSession: true,
            hasPayments: totalPaid > 0,
            sessionId: session.session_id,
            totalPaid
          });
        } else {
          setWorkflowInfo({ hasSession: false, hasPayments: false });
        }

      } catch (error) {
        console.error('Error checking workflow info:', error);
        setWorkflowInfo({ hasSession: false, hasPayments: false });
      } finally {
        setLoading(false);
      }
    };

    checkWorkflowInfo();
  }, [appointmentId]);

  return { workflowInfo, loading };
};