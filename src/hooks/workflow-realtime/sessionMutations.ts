import { supabase } from '@/integrations/supabase/client';
import { generateUniversalSessionId } from '@/types/appointments-supabase';
import { WorkflowSession, PaymentActionType } from './types';

export const createWorkflowSession = async (
  sessionData: Omit<WorkflowSession, 'id' | 'user_id' | 'created_at' | 'updated_at'>,
  userId: string,
): Promise<WorkflowSession> => {
  const { pricingFreezingService } = await import('@/services/PricingFreezingService');

  // Freeze complete data including package and products
  const regrasCongeladas = await pricingFreezingService.congelarDadosCompletos(
    sessionData.pacote,
    sessionData.categoria,
  );

  // Initialize extra photo values with frozen rules
  const valorFotoExtraInicial = regrasCongeladas
    ? pricingFreezingService.calcularValorFotoExtraComRegrasCongeladas(1, regrasCongeladas).valorUnitario
    : 0;

  // FASE 2: Extract valor_base_pacote from frozen rules
  const valorBasePacote = regrasCongeladas?.valorBase ? Number(regrasCongeladas.valorBase) : 0;

  const { data, error } = await supabase
    .from('clientes_sessoes')
    .insert({
      ...sessionData,
      user_id: userId,
      updated_by: userId,
      regras_congeladas: regrasCongeladas as any,
      valor_base_pacote: valorBasePacote,
      valor_foto_extra: valorFotoExtraInicial,
      valor_total_foto_extra: 0,
      qtd_fotos_extra: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data as WorkflowSession;
};

export const deleteWorkflowSession = async (
  id: string,
  paymentAction: PaymentActionType = 'preserve',
): Promise<{ deleted: boolean; description: string }> => {
  const { data, error } = await supabase.rpc('delete_workflow_session_cascade', {
    p_session_pk: id,
    p_action: paymentAction,
  });

  if (error) throw error;

  const result = (data ?? {}) as {
    deleted_session?: number;
    deleted_appointment?: number;
    deleted_transactions?: number;
    estornos_criados?: number;
    soft_deleted?: boolean;
  };

  const shouldRemoveFromLocalState = paymentAction === 'preserve' || (result.deleted_session ?? 0) > 0;

  const description =
    paymentAction === 'refund'
      ? `Sessão excluída e ${result.estornos_criados ?? 0} estorno(s) criado(s).`
      : paymentAction === 'remove'
      ? `Sessão e ${result.deleted_transactions ?? 0} pagamento(s) excluídos permanentemente.`
      : 'Sessão movida para o histórico do cliente.';

  return {
    deleted: shouldRemoveFromLocalState,
    description,
  };
};

export const createSessionFromAppointmentPayload = async (
  appointmentId: string,
  appointmentData: any,
  userId: string,
): Promise<WorkflowSession> => {
  const sessionId = generateUniversalSessionId('workflow');

  // FASE 2: Set ONLY base package value - SQL trigger will add extras automatically
  const sessionData = {
    session_id: sessionId,
    appointment_id: appointmentId,
    cliente_id: appointmentData.clienteId || '',
    data_sessao:
      typeof appointmentData.date === 'string'
        ? appointmentData.date
        : `${appointmentData.date.getFullYear()}-${String(appointmentData.date.getMonth() + 1).padStart(2, '0')}-${String(appointmentData.date.getDate()).padStart(2, '0')}`,
    hora_sessao: appointmentData.time,
    categoria: appointmentData.categoria || '',
    pacote: appointmentData.pacote || '',
    descricao: appointmentData.description || '',
    status: '',
    valor_total: appointmentData.valorPacote || 0, // ONLY base package value - trigger adds extras
    valor_pago: appointmentData.paidAmount || 0,
    produtos_incluidos: appointmentData.produtosIncluidos || [],
  };

  console.log('💰 Creating session with base package value (trigger will add extras):', sessionData.valor_total);
  return await createWorkflowSession(sessionData as any, userId);
};
