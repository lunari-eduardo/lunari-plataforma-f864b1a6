import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface WorkflowInfo {
  hasSession: boolean;
  hasPayments: boolean;
  sessionId?: string;
  totalPaid?: number;
}

interface SessionDetails {
  categoria: string;
  pacote: string | null;
  valorBasePacote: number;
  valorTotal: number;
  valorPago: number;
  desconto: number;
  valorAdicional: number;
  qtdFotosExtra: number;
  valorFotoExtra: number;
  valorTotalFotoExtra: number;
  produtos: Array<{ nome: string; quantidade: number; valorTotal: number }>;
  status: string | null;
  dataSessao: string;
  horaSessao: string;
}

/**
 * Hook to check if an appointment has workflow session and payments
 */
export const useAppointmentWorkflowInfo = (appointmentId?: string) => {
  const [workflowInfo, setWorkflowInfo] = useState<WorkflowInfo>({
    hasSession: false,
    hasPayments: false
  });
  const [sessionDetails, setSessionDetails] = useState<SessionDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (!appointmentId) {
      setWorkflowInfo({ hasSession: false, hasPayments: false });
      setSessionDetails(null);
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

  // Lazy load session details when requested
  const fetchSessionDetails = useCallback(async () => {
    if (!appointmentId || !workflowInfo.hasSession) return;
    
    setLoadingDetails(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) return;

      const { data: appointment } = await supabase
        .from('appointments')
        .select('session_id')
        .eq('id', appointmentId)
        .eq('user_id', user.user.id)
        .single();

      if (!appointment) return;

      const { data: session } = await supabase
        .from('clientes_sessoes')
        .select('*')
        .eq('user_id', user.user.id)
        .or(`appointment_id.eq.${appointmentId},session_id.eq.${appointment.session_id}`)
        .maybeSingle();

      if (session) {
        // Parse produtos_incluidos
        let produtos: Array<{ nome: string; quantidade: number; valorTotal: number }> = [];
        if (session.produtos_incluidos) {
          try {
            const parsedProdutos = typeof session.produtos_incluidos === 'string' 
              ? JSON.parse(session.produtos_incluidos) 
              : session.produtos_incluidos;
            
            if (Array.isArray(parsedProdutos)) {
              produtos = parsedProdutos.map((p: any) => ({
                nome: p.nome || p.name || 'Produto',
                quantidade: p.quantidade || p.qty || 1,
                valorTotal: p.valorTotal || p.total || 0
              }));
            }
          } catch (e) {
            console.error('Error parsing produtos:', e);
          }
        }

        setSessionDetails({
          categoria: session.categoria,
          pacote: session.pacote,
          valorBasePacote: Number(session.valor_base_pacote) || 0,
          valorTotal: Number(session.valor_total) || 0,
          valorPago: Number(session.valor_pago) || 0,
          desconto: Number(session.desconto) || 0,
          valorAdicional: Number(session.valor_adicional) || 0,
          qtdFotosExtra: session.qtd_fotos_extra || 0,
          valorFotoExtra: Number(session.valor_foto_extra) || 0,
          valorTotalFotoExtra: Number(session.valor_total_foto_extra) || 0,
          produtos,
          status: session.status,
          dataSessao: session.data_sessao,
          horaSessao: session.hora_sessao
        });
      }
    } catch (error) {
      console.error('Error fetching session details:', error);
    } finally {
      setLoadingDetails(false);
    }
  }, [appointmentId, workflowInfo.hasSession]);

  return { 
    workflowInfo, 
    loading, 
    sessionDetails, 
    loadingDetails, 
    fetchSessionDetails 
  };
};
