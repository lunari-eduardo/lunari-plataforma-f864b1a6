import { useState, useEffect, useCallback } from 'react';
import { ClientPaymentPlan, PaymentInstallment, ReceivablesMetrics, ReceivablesSummary } from '@/types/receivables';
import { formatCurrency } from '@/utils/financialUtils';
import { getCurrentDateString, formatDateForStorage } from '@/utils/dateUtils';
import { ReceivablesService } from '@/services/ReceivablesService';
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
    // Clean up duplicates on load
    ReceivablesService.deduplicate();
    setPaymentPlans(ReceivablesService.loadPaymentPlans());
    setInstallments(ReceivablesService.loadInstallments());
  }, []);

  // Salvar planos de pagamento
  const savePaymentPlans = useCallback((plans: ClientPaymentPlan[]) => {
    ReceivablesService.savePaymentPlans(plans);
    setPaymentPlans(plans);
  }, []);

  // Salvar parcelas
  const saveInstallments = useCallback((installmentsList: PaymentInstallment[]) => {
    ReceivablesService.saveInstallments(installmentsList);
    setInstallments(installmentsList);
  }, []);

  // Criar ou atualizar plano de pagamento (considerando pagamentos já existentes)
  const criarOuAtualizarPlanoPagamento = useCallback(async (
    sessionId: string,
    clienteId: string,
    valorTotalNegociado: number,
    valorJaPago: number,
    formaPagamento: 'avista' | 'parcelado',
    numeroParcelas: number = 1,
    diaVencimento: number = 10
  ) => {
    // Remover plano existente se houver
    const planosExistentes = paymentPlans.filter(plan => plan.sessionId !== sessionId);
    const parcelasExistentes = installments.filter(installment => {
      const planoDaParcela = paymentPlans.find(plan => plan.id === installment.paymentPlanId);
      return planoDaParcela?.sessionId !== sessionId;
    });

    const planId = `plan-${Date.now()}`;
    const valorRestante = Math.max(0, valorTotalNegociado - valorJaPago);
    const valorParcela = formaPagamento === 'avista' ? valorRestante : valorRestante / numeroParcelas;
    
    const novoPlan: ClientPaymentPlan = {
      id: planId,
      sessionId,
      clienteId,
      valorTotal: valorTotalNegociado,
      formaPagamento,
      numeroParcelas: formaPagamento === 'avista' ? 1 : numeroParcelas,
      valorParcela,
      diaVencimento,
      status: valorRestante <= 0 ? 'quitado' : 'ativo',
      criadoEm: new Date().toISOString()
    };

    // **PRESERVE EXISTING PAYMENTS**: Don't create a single generic entry payment when there's valorJaPago
    // Instead, keep existing payments (entries + quick payments) and create only future installments
    const novasParcelas: PaymentInstallment[] = [];

    // Gerar parcelas futuras apenas se houver valor restante
    if (valorRestante > 0) {
      const hoje = new Date();
      const parcelas = formaPagamento === 'avista' ? 1 : numeroParcelas;
      
      for (let i = 1; i <= parcelas; i++) {
        // Calcular data corretamente para parcelas sequenciais
        let dataVencimento = new Date(hoje.getFullYear(), hoje.getMonth(), diaVencimento);
        
        // Se a data do vencimento já passou no mês atual, começar no próximo mês
        if (dataVencimento <= hoje) {
          dataVencimento = new Date(hoje.getFullYear(), hoje.getMonth() + 1, diaVencimento);
        }
        
        // Adicionar i-1 meses para parcelas sequenciais (primeira parcela no próximo mês válido)
        dataVencimento.setMonth(dataVencimento.getMonth() + (i - 1));
        
        const parcela: PaymentInstallment = {
          id: `installment-${planId}-${i}`,
          paymentPlanId: planId,
          numeroParcela: i,
          valor: valorParcela,
          dataVencimento: formatDateForStorage(dataVencimento),
          status: 'pendente'
        };
        
        novasParcelas.push(parcela);
      }
    }

    // Salvar no localStorage
    const novosPlanos = [...planosExistentes, novoPlan];
    const novasInstallments = [...parcelasExistentes, ...novasParcelas];
    
    savePaymentPlans(novosPlanos);
    saveInstallments(novasInstallments);

    const descricao = valorJaPago > 0 
      ? `Entrada: ${formatCurrency(valorJaPago)} + ${formaPagamento === 'avista' ? 1 : numeroParcelas}x de ${formatCurrency(valorParcela)}`
      : `${formaPagamento === 'avista' ? 1 : numeroParcelas}x de ${formatCurrency(valorParcela)}`;

    toast({
      title: "Plano de pagamento configurado",
      description: descricao
    });

    return novoPlan;
  }, [paymentPlans, installments, savePaymentPlans, saveInstallments, toast]);

  // Registrar pagamento rápido (cria parcela paga automaticamente)
  const registrarPagamentoRapido = useCallback(async (
    sessionId: string,
    clienteId: string,
    valorPago: number,
    valorTotalSessao: number
  ) => {
    const novaParcela = ReceivablesService.addPagamentoRapido(
      sessionId,
      clienteId,
      valorPago,
      getCurrentDateString()
    );

    // Reload data from service
    setPaymentPlans(ReceivablesService.loadPaymentPlans());
    setInstallments(ReceivablesService.loadInstallments());

    toast({
      title: "Pagamento registrado",
      description: formatCurrency(valorPago)
    });

    return novaParcela;
  }, [setPaymentPlans, setInstallments, toast]);

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

  // Obter valores já pagos de uma sessão
  const obterValorJaPago = useCallback((sessionId: string): number => {
    const plano = paymentPlans.find(plan => plan.sessionId === sessionId);
    if (!plano) return 0;
    
    const parcelasPagas = installments.filter(installment => 
      installment.paymentPlanId === plano.id && installment.status === 'pago'
    );
    
    return parcelasPagas.reduce((total, parcela) => total + parcela.valor, 0);
  }, [paymentPlans, installments]);

  return {
    paymentPlans,
    installments,
    criarPlanoPagamento,
    criarOuAtualizarPlanoPagamento,
    registrarPagamentoRapido,
    marcarComoPago,
    calcularMetricasMes,
    obterResumo,
    obterPlanosPorCliente,
    obterParcelasPorPlano,
    obterValorJaPago
  };
}