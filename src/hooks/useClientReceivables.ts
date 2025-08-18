import { useState, useEffect, useCallback } from 'react';
import { ClientPaymentPlan, PaymentInstallment, ReceivablesMetrics, ReceivablesSummary } from '@/types/receivables';
import { formatCurrency } from '@/utils/financialUtils';
import { useToast } from '@/hooks/use-toast';

const STORAGE_KEYS = {
  PAYMENT_PLANS: 'lunari_payment_plans',
  INSTALLMENTS: 'lunari_installments'
};

export function useClientReceivables() {
  const [paymentPlans, setPaymentPlans] = useState<ClientPaymentPlan[]>([]);
  const [installments, setInstallments] = useState<PaymentInstallment[]>([]);
  const { toast } = useToast();

  // Carregar dados do localStorage
  useEffect(() => {
    const savedPlans = localStorage.getItem(STORAGE_KEYS.PAYMENT_PLANS);
    const savedInstallments = localStorage.getItem(STORAGE_KEYS.INSTALLMENTS);
    
    if (savedPlans) {
      setPaymentPlans(JSON.parse(savedPlans));
    }
    
    if (savedInstallments) {
      setInstallments(JSON.parse(savedInstallments));
    }
  }, []);

  // Salvar planos de pagamento
  const savePaymentPlans = useCallback((plans: ClientPaymentPlan[]) => {
    localStorage.setItem(STORAGE_KEYS.PAYMENT_PLANS, JSON.stringify(plans));
    setPaymentPlans(plans);
  }, []);

  // Salvar parcelas
  const saveInstallments = useCallback((installmentsList: PaymentInstallment[]) => {
    localStorage.setItem(STORAGE_KEYS.INSTALLMENTS, JSON.stringify(installmentsList));
    setInstallments(installmentsList);
  }, []);

  // Criar plano de pagamento
  const criarPlanoPagamento = useCallback(async (
    sessionId: string,
    clienteId: string,
    valorTotal: number,
    formaPagamento: 'avista' | 'parcelado',
    numeroParcelas: number = 1,
    diaVencimento: number = 10
  ) => {
    const planId = `plan-${Date.now()}`;
    const valorParcela = valorTotal / numeroParcelas;
    
    const novoPlan: ClientPaymentPlan = {
      id: planId,
      sessionId,
      clienteId,
      valorTotal,
      formaPagamento,
      numeroParcelas,
      valorParcela,
      diaVencimento,
      status: 'ativo',
      criadoEm: new Date().toISOString()
    };

    // Gerar parcelas automaticamente
    const novasParcelas: PaymentInstallment[] = [];
    const hoje = new Date();
    
    for (let i = 1; i <= numeroParcelas; i++) {
      const dataVencimento = new Date(hoje.getFullYear(), hoje.getMonth() + (i - 1), diaVencimento);
      
      // Se a data já passou neste mês, mover para o próximo mês
      if (i === 1 && dataVencimento < hoje) {
        dataVencimento.setMonth(dataVencimento.getMonth() + 1);
      }
      
      const parcela: PaymentInstallment = {
        id: `installment-${planId}-${i}`,
        paymentPlanId: planId,
        numeroParcela: i,
        valor: valorParcela,
        dataVencimento: dataVencimento.toISOString().split('T')[0],
        status: 'pendente'
      };
      
      novasParcelas.push(parcela);
    }

    // Salvar no localStorage
    const novosPlanos = [...paymentPlans, novoPlan];
    const novasInstallments = [...installments, ...novasParcelas];
    
    savePaymentPlans(novosPlanos);
    saveInstallments(novasInstallments);

    toast({
      title: "Plano de pagamento criado",
      description: `${numeroParcelas}x de ${formatCurrency(valorParcela)}`
    });

    return novoPlan;
  }, [paymentPlans, installments, savePaymentPlans, saveInstallments, toast]);

  // Marcar parcela como paga
  const marcarComoPago = useCallback(async (installmentId: string, dataPagamento?: string, observacoes?: string) => {
    const novasInstallments = installments.map(installment => {
      if (installment.id === installmentId) {
        return {
          ...installment,
          status: 'pago' as const,
          dataPagamento: dataPagamento || new Date().toISOString().split('T')[0],
          observacoes
        };
      }
      return installment;
    });

    saveInstallments(novasInstallments);

    // Verificar se o plano foi quitado
    const installment = installments.find(i => i.id === installmentId);
    if (installment) {
      const parcelasDoPlano = novasInstallments.filter(i => i.paymentPlanId === installment.paymentPlanId);
      const todasPagas = parcelasDoPlano.every(p => p.status === 'pago');
      
      if (todasPagas) {
        const novosPlanos = paymentPlans.map(plan => {
          if (plan.id === installment.paymentPlanId) {
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
    const inicioMes = new Date(ano, mes - 1, 1).toISOString().split('T')[0];
    const fimMes = new Date(ano, mes, 0).toISOString().split('T')[0];
    const hoje = new Date().toISOString().split('T')[0];

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

    const hojeFmtd = hoje.toISOString().split('T')[0];
    const proximosSeteDias = new Date();
    proximosSeteDias.setDate(hoje.getDate() + 7);
    const proximosSeteDiasFmtd = proximosSeteDias.toISOString().split('T')[0];

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

  return {
    paymentPlans,
    installments,
    criarPlanoPagamento,
    marcarComoPago,
    calcularMetricasMes,
    obterResumo,
    obterPlanosPorCliente,
    obterParcelasPorPlano
  };
}