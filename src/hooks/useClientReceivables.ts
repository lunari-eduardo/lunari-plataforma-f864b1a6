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

    // Gerar parcela de entrada se houver valor já pago
    const novasParcelas: PaymentInstallment[] = [];
    if (valorJaPago > 0) {
      const parcelaEntrada: PaymentInstallment = {
        id: `installment-${planId}-entrada`,
        paymentPlanId: planId,
        numeroParcela: 0, // Entrada
        valor: valorJaPago,
        dataVencimento: new Date().toISOString().split('T')[0],
        status: 'pago',
        dataPagamento: new Date().toISOString().split('T')[0],
        observacoes: 'Pagamento já realizado (entrada/pagamento rápido)'
      };
      novasParcelas.push(parcelaEntrada);
    }

    // Gerar parcelas futuras apenas se houver valor restante
    if (valorRestante > 0) {
      const hoje = new Date();
      const parcelas = formaPagamento === 'avista' ? 1 : numeroParcelas;
      
      for (let i = 1; i <= parcelas; i++) {
        // Fix: Calcular data corretamente para parcelas sequenciais
        const dataVencimento = new Date(hoje.getFullYear(), hoje.getMonth() + i - 1, diaVencimento);
        
        // Se a data já passou, mover para o próximo mês
        if (dataVencimento <= hoje) {
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
    // Verificar se já existe plano para esta sessão
    let planoExistente = paymentPlans.find(plan => plan.sessionId === sessionId);
    
    if (!planoExistente) {
      // Criar plano básico se não existir
      const planId = `plan-${Date.now()}`;
      planoExistente = {
        id: planId,
        sessionId,
        clienteId,
        valorTotal: valorTotalSessao,
        formaPagamento: 'avista',
        numeroParcelas: 1,
        valorParcela: valorTotalSessao,
        diaVencimento: 10,
        status: 'ativo',
        criadoEm: new Date().toISOString()
      };

      const novosPlanos = [...paymentPlans, planoExistente];
      savePaymentPlans(novosPlanos);
    }

    // Criar parcela paga
    const novaParcela: PaymentInstallment = {
      id: `installment-${planoExistente.id}-${Date.now()}`,
      paymentPlanId: planoExistente.id,
      numeroParcela: 0, // Pagamento avulso
      valor: valorPago,
      dataVencimento: new Date().toISOString().split('T')[0],
      status: 'pago',
      dataPagamento: new Date().toISOString().split('T')[0],
      observacoes: 'Pagamento rápido'
    };

    const novasInstallments = [...installments, novaParcela];
    saveInstallments(novasInstallments);

    toast({
      title: "Pagamento registrado",
      description: formatCurrency(valorPago)
    });

    return novaParcela;
  }, [paymentPlans, installments, savePaymentPlans, saveInstallments, toast]);

  // Compatibilidade com nome antigo
  const criarPlanoPagamento = criarOuAtualizarPlanoPagamento;

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