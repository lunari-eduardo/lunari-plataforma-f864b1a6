import { useState, useEffect, useCallback } from 'react';
import { ClientPaymentPlan, PaymentInstallment, ReceivablesMetrics, ReceivablesSummary } from '@/types/receivables';
import { formatCurrency } from '@/utils/financialUtils';
import { getCurrentDateString, formatDateForStorage } from '@/utils/dateUtils';
import { ReceivablesServiceV2 } from '@/services/ReceivablesServiceV2';
import { useToast } from '@/hooks/use-toast';

const STORAGE_KEYS = {
  PAYMENT_PLANS: 'lunari_payment_plans',
  INSTALLMENTS: 'lunari_installments'
};

export function useClientReceivables() {
  const [paymentPlans, setPaymentPlans] = useState<ClientPaymentPlan[]>([]);
  const [installments, setInstallments] = useState<PaymentInstallment[]>([]);
  const { toast } = useToast();

  // Carregar dados do localStorage com migração automática
  useEffect(() => {
    // Migrar dados da V1 se necessário
    const v2Plans = localStorage.getItem('lunari_payment_plans_v2');
    if (!v2Plans && localStorage.getItem('lunari_payment_plans')) {
      console.log('🔄 Migrando dados para V2...');
      ReceivablesServiceV2.migrateFromV1();
    }
    
    setPaymentPlans(ReceivablesServiceV2.loadPaymentPlans());
    setInstallments(ReceivablesServiceV2.loadInstallments());
  }, []);

  // Salvar planos de pagamento
  const savePaymentPlans = useCallback((plans: ClientPaymentPlan[]) => {
    ReceivablesServiceV2.savePaymentPlans(plans);
    setPaymentPlans(plans);
  }, []);

  // Salvar parcelas
  const saveInstallments = useCallback((installmentsList: PaymentInstallment[]) => {
    ReceivablesServiceV2.saveInstallments(installmentsList);
    setInstallments(installmentsList);
  }, []);

  // V2: Criar agendamento de pagamento (100% idempotente)
  const criarOuAtualizarPlanoPagamento = useCallback(async (
    sessionId: string,
    clienteId: string,
    valorTotalNegociado: number,
    valorJaPago: number,
    formaPagamento: 'avista' | 'parcelado',
    numeroParcelas: number = 1,
    diaVencimento: number = 10,
    observacoes?: string
  ) => {
    console.log(`🔄 [V2] Configurando agendamento - Session: ${sessionId}, Total: ${valorTotalNegociado}, Informado pago: ${valorJaPago}`);
    
    const result = ReceivablesServiceV2.createOrUpdatePaymentSchedule(
      sessionId,
      clienteId,
      valorTotalNegociado,
      valorJaPago,
      formaPagamento,
      numeroParcelas,
      diaVencimento,
      observacoes
    );
    
    // Atualizar estados locais
    setPaymentPlans(ReceivablesServiceV2.loadPaymentPlans());
    setInstallments(ReceivablesServiceV2.loadInstallments());

    const valorRestante = Math.max(0, valorTotalNegociado - ReceivablesServiceV2.getTotalPaidForSession(sessionId));
    const descricao = valorRestante > 0
      ? `${formaPagamento === 'avista' ? '1x' : `${numeroParcelas}x`} de ${formatCurrency(result.plan.valorParcela)} agendado`
      : 'Totalmente quitado';

    toast({
      title: "Pagamento agendado",
      description: descricao
    });

    // Dispatch evento para sincronização
    window.dispatchEvent(new CustomEvent('payment-plan:scheduled', {
      detail: {
        sessionId,
        clienteId,
        valorTotal: valorTotalNegociado,
        formaPagamento,
        numeroParcelas
      }
    }));

    return result.plan;
  }, [savePaymentPlans, saveInstallments, toast]);

  // V2: Registrar pagamento rápido
  const registrarPagamentoRapido = useCallback(async (
    sessionId: string,
    clienteId: string,
    valorPago: number,
    valorTotalSessao?: number
  ) => {
    console.log(`💸 [V2] Pagamento rápido - Session: ${sessionId}, Valor: ${valorPago}`);
    
    const quickPayment = ReceivablesServiceV2.addQuickPayment(
      sessionId,
      clienteId,
      valorPago,
      valorTotalSessao
    );

    // Atualizar estados locais
    setPaymentPlans(ReceivablesServiceV2.loadPaymentPlans());
    setInstallments(ReceivablesServiceV2.loadInstallments());

    toast({
      title: "Pagamento registrado",
      description: formatCurrency(valorPago)
    });

    return quickPayment;
  }, [toast]);

  // Compatibilidade com nome antigo
  const criarPlanoPagamento = criarOuAtualizarPlanoPagamento;

  // Marcar parcela como paga
  const marcarComoPago = useCallback(async (installmentId: string, dataPagamento?: string, observacoes?: string) => {
    const novasInstallments = installments.map(installment => {
      if (installment.id === installmentId) {
        return {
          ...installment,
          status: 'pago' as const,
          dataPagamento: dataPagamento || getCurrentDateString(),
          observacoes
        };
      }
      return installment;
    });

    saveInstallments(novasInstallments);

    // Dispatch event for global synchronization
    const installment = installments.find(i => i.id === installmentId);
    if (installment) {
      const plano = paymentPlans.find(p => p.id === installment.paymentPlanId);
      if (plano?.sessionId) {
        window.dispatchEvent(new CustomEvent('receivables:installment-paid', {
          detail: {
            sessionId: plano.sessionId,
            clienteId: plano.clienteId,
            valor: installment.valor
          }
        }));
      }
    }

    // Verificar se o plano foi quitado
    const foundInstallment = installments.find(i => i.id === installmentId);
    if (foundInstallment) {
      const parcelasDoPlano = novasInstallments.filter(i => i.paymentPlanId === foundInstallment.paymentPlanId);
      const todasPagas = parcelasDoPlano.every(p => p.status === 'pago');
      
      if (todasPagas) {
        const novosPlanos = paymentPlans.map(plan => {
          if (plan.id === foundInstallment.paymentPlanId) {
            return { ...plan, status: 'quitado' as const };
          }
          return plan;
        });
        savePaymentPlans(novosPlanos);
      }
    }

    toast({
      title: "Parcela marcada como paga",
      description: "Pagamento registrado com sucesso"
    });
  }, [installments, paymentPlans, saveInstallments, savePaymentPlans, toast]);

  // Calcular métricas do mês
  const calcularMetricasMes = useCallback((ano: number, mes: number): ReceivablesMetrics => {
    const inicioMes = formatDateForStorage(new Date(ano, mes - 1, 1));
    const fimMes = formatDateForStorage(new Date(ano, mes, 0));
    const hoje = getCurrentDateString();

    const parcelasDoMes = installments.filter(installment => 
      installment.dataVencimento >= inicioMes && installment.dataVencimento <= fimMes
    );

    const pendentes = parcelasDoMes.filter(p => p.status === 'pendente');
    const pagas = parcelasDoMes.filter(p => p.status === 'pago');
    const emAtraso = pendentes.filter(p => p.dataVencimento < hoje);

    return {
      totalAReceber: pendentes.reduce((sum, p) => sum + p.valor, 0),
      totalEmAtraso: emAtraso.reduce((sum, p) => sum + p.valor, 0),
      totalQuitado: pagas.reduce((sum, p) => sum + p.valor, 0),
      quantidadeParcelas: parcelasDoMes.length,
      quantidadeEmAtraso: emAtraso.length
    };
  }, [installments]);

  // Obter resumo completo
  const obterResumo = useCallback((): ReceivablesSummary => {
    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1;
    const anoAtual = hoje.getFullYear();
    const proximoMes = mesAtual === 12 ? 1 : mesAtual + 1;
    const anoProximoMes = mesAtual === 12 ? anoAtual + 1 : anoAtual;

    const hojeFmtd = getCurrentDateString();
    const proximosSeteDias = new Date();
    proximosSeteDias.setDate(hoje.getDate() + 7);
    const proximosSeteDiasFmtd = formatDateForStorage(proximosSeteDias);

    return {
      mesAtual: calcularMetricasMes(anoAtual, mesAtual),
      proximoMes: calcularMetricasMes(anoProximoMes, proximoMes),
      vencimentosHoje: installments.filter(i => 
        i.dataVencimento === hojeFmtd && i.status === 'pendente'
      ),
      vencimentosProximos: installments.filter(i => 
        i.dataVencimento > hojeFmtd && 
        i.dataVencimento <= proximosSeteDiasFmtd && 
        i.status === 'pendente'
      )
    };
  }, [installments, calcularMetricasMes]);

  // Obter planos por cliente
  const obterPlanosPorCliente = useCallback((clienteId: string) => {
    return paymentPlans.filter(plan => plan.clienteId === clienteId);
  }, [paymentPlans]);

  // Obter parcelas por plano
  const obterParcelasPorPlano = useCallback((paymentPlanId: string) => {
    return installments.filter(installment => installment.paymentPlanId === paymentPlanId);
  }, [installments]);

  // V2: Obter valores já pagos de uma sessão
  const obterValorJaPago = useCallback((sessionId: string): number => {
    return ReceivablesServiceV2.getTotalPaidForSession(sessionId);
  }, []);

  // V2: Verificar se tem agendamentos
  const temAgendamentos = useCallback((sessionId: string): boolean => {
    return ReceivablesServiceV2.hasScheduledPayments(sessionId);
  }, []);

  // V2: Obter informações do agendamento
  const obterInfoAgendamento = useCallback((sessionId: string) => {
    return ReceivablesServiceV2.getPaymentScheduleInfo(sessionId);
  }, []);

  // V2: Remover dados da sessão com opção de preservar pagamentos
  const removerDadosSessao = useCallback((sessionId: string, preservarPagamentos: boolean = true) => {
    console.log(`🗑️ [V2] Removendo dados da sessão ${sessionId}, preservar: ${preservarPagamentos}`);
    
    ReceivablesServiceV2.removeSessionData(sessionId, preservarPagamentos);
    
    // Atualizar estados locais
    setPaymentPlans(ReceivablesServiceV2.loadPaymentPlans());
    setInstallments(ReceivablesServiceV2.loadInstallments());
    
    toast({
      title: preservarPagamentos ? "Agendamento removido" : "Dados removidos",
      description: preservarPagamentos ? "Pagamentos preservados" : "Todos os dados foram removidos"
    });
  }, [toast]);

  return {
    paymentPlans,
    installments,
    criarPlanoPagamento: criarOuAtualizarPlanoPagamento, // Compatibilidade
    criarOuAtualizarPlanoPagamento,
    registrarPagamentoRapido,
    marcarComoPago,
    calcularMetricasMes,
    obterResumo,
    obterPlanosPorCliente,
    obterParcelasPorPlano,
    obterValorJaPago,
    temAgendamentos,
    obterInfoAgendamento,
    removerDadosSessao,
    savePaymentPlans,
    saveInstallments
  };
}