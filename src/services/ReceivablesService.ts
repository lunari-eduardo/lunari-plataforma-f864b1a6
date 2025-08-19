import { ClientPaymentPlan, PaymentInstallment } from '@/types/receivables';
import { getCurrentDateString, formatDateForStorage } from '@/utils/dateUtils';

const STORAGE_KEYS = {
  PAYMENT_PLANS: 'lunari_payment_plans',
  INSTALLMENTS: 'lunari_installments'
};

export class ReceivablesService {
  static loadPaymentPlans(): ClientPaymentPlan[] {
    const saved = localStorage.getItem(STORAGE_KEYS.PAYMENT_PLANS);
    return saved ? JSON.parse(saved) : [];
  }

  static loadInstallments(): PaymentInstallment[] {
    const saved = localStorage.getItem(STORAGE_KEYS.INSTALLMENTS);
    return saved ? JSON.parse(saved) : [];
  }

  static savePaymentPlans(plans: ClientPaymentPlan[]): void {
    localStorage.setItem(STORAGE_KEYS.PAYMENT_PLANS, JSON.stringify(plans));
  }

  static saveInstallments(installments: PaymentInstallment[]): void {
    localStorage.setItem(STORAGE_KEYS.INSTALLMENTS, JSON.stringify(installments));
  }

  static upsertPlan(
    sessionId: string,
    clienteId: string,
    valorTotal: number,
    formaPagamento: 'avista' | 'parcelado',
    numeroParcelas: number,
    diaVencimento: number
  ): ClientPaymentPlan {
    const plans = this.loadPaymentPlans();
    const installments = this.loadInstallments();

    // Remove existing plan for this session
    const filteredPlans = plans.filter(plan => plan.sessionId !== sessionId);
    const filteredInstallments = installments.filter(installment => {
      const planoDaParcela = plans.find(plan => plan.id === installment.paymentPlanId);
      return planoDaParcela?.sessionId !== sessionId;
    });

    const planId = `plan-${Date.now()}`;
    const valorParcela = formaPagamento === 'avista' ? valorTotal : valorTotal / numeroParcelas;
    
    const newPlan: ClientPaymentPlan = {
      id: planId,
      sessionId,
      clienteId,
      valorTotal,
      formaPagamento,
      numeroParcelas: formaPagamento === 'avista' ? 1 : numeroParcelas,
      valorParcela,
      diaVencimento,
      status: 'ativo',
      criadoEm: new Date().toISOString()
    };

    const updatedPlans = [...filteredPlans, newPlan];
    this.savePaymentPlans(updatedPlans);
    this.saveInstallments(filteredInstallments);

    return newPlan;
  }

  static addEntradaPago(
    sessionId: string,
    clienteId: string,
    valor: number,
    data?: string
  ): PaymentInstallment {
    const plans = this.loadPaymentPlans();
    const installments = this.loadInstallments();

    let plan = plans.find(p => p.sessionId === sessionId);
    
    if (!plan) {
      // Create a basic plan if it doesn't exist
      plan = this.upsertPlan(sessionId, clienteId, valor, 'avista', 1, 10);
    }

    // **ROBUST NON-DUPLICATION**: Check if appointment entry payment already exists to prevent duplication
    const existingEntrada = installments.find(i => 
      i.paymentPlanId === plan.id && 
      i.numeroParcela === 0 && 
      i.status === 'pago' &&
      i.observacoes === 'Entrada do agendamento'
    );

    if (existingEntrada) {
      console.log('⚠️ Entry payment already exists, skipping duplication:', existingEntrada.id);
      return existingEntrada;
    }

    const entradaParcela: PaymentInstallment = {
      id: `installment-${plan.id}-entrada-${Date.now()}`,
      paymentPlanId: plan.id,
      numeroParcela: 0, // Entry payment
      valor,
      dataVencimento: data || getCurrentDateString(),
      status: 'pago',
      dataPagamento: data || getCurrentDateString(),
      observacoes: 'Entrada do agendamento'
    };

    const updatedInstallments = [...installments, entradaParcela];
    this.saveInstallments(updatedInstallments);

    console.log('✅ Entry payment created:', entradaParcela.id);
    return entradaParcela;
  }

  static migrateSessionReceivables(
    fromSessionId: string,
    toSessionId: string,
    clienteId: string
  ): void {
    const plans = this.loadPaymentPlans();
    const installments = this.loadInstallments();

    // Find existing plan with fromSessionId
    const existingPlan = plans.find(p => p.sessionId === fromSessionId);
    if (!existingPlan) {
      console.log('⚠️ No existing plan found for migration:', fromSessionId);
      return;
    }

    // Check if target session already has a plan to prevent duplication
    const targetPlan = plans.find(p => p.sessionId === toSessionId);
    if (targetPlan) {
      console.log('⚠️ Target session already has plan, skipping migration:', toSessionId);
      return;
    }

    // Update plan sessionId
    const updatedPlans = plans.map(plan => 
      plan.id === existingPlan.id 
        ? { ...plan, sessionId: toSessionId }
        : plan
    );

    this.savePaymentPlans(updatedPlans);
    console.log('✅ Payment plan migrated:', { from: fromSessionId, to: toSessionId });
  }

  static addPagamentoRapido(
    sessionId: string,
    clienteId: string,
    valor: number,
    data?: string
  ): PaymentInstallment {
    const plans = this.loadPaymentPlans();
    const installments = this.loadInstallments();

    let plan = plans.find(p => p.sessionId === sessionId);
    
    if (!plan) {
      // Create a basic plan if it doesn't exist
      plan = this.upsertPlan(sessionId, clienteId, valor, 'avista', 1, 10);
    }

    const pagamentoRapido: PaymentInstallment = {
      id: `installment-${plan.id}-pagamento-${Date.now()}`,
      paymentPlanId: plan.id,
      numeroParcela: 0, // Quick payment
      valor,
      dataVencimento: data || getCurrentDateString(),
      status: 'pago',
      dataPagamento: data || getCurrentDateString(),
      observacoes: 'Pagamento rápido'
    };

    const updatedInstallments = [...installments, pagamentoRapido];
    this.saveInstallments(updatedInstallments);

    return pagamentoRapido;
  }

  static removeBySessionId(sessionId: string): void {
    const plans = this.loadPaymentPlans();
    const installments = this.loadInstallments();

    const filteredPlans = plans.filter(plan => plan.sessionId !== sessionId);
    const planIdsToRemove = plans
      .filter(plan => plan.sessionId === sessionId)
      .map(plan => plan.id);

    const filteredInstallments = installments.filter(
      installment => !planIdsToRemove.includes(installment.paymentPlanId)
    );

    this.savePaymentPlans(filteredPlans);
    this.saveInstallments(filteredInstallments);
  }

  static removeByClienteId(clienteId: string): void {
    const plans = this.loadPaymentPlans();
    const installments = this.loadInstallments();

    const filteredPlans = plans.filter(plan => plan.clienteId !== clienteId);
    const planIdsToRemove = plans
      .filter(plan => plan.clienteId === clienteId)
      .map(plan => plan.id);

    const filteredInstallments = installments.filter(
      installment => !planIdsToRemove.includes(installment.paymentPlanId)
    );

    this.savePaymentPlans(filteredPlans);
    this.saveInstallments(filteredInstallments);
  }

  static getValorJaPago(sessionId: string): number {
    const plans = this.loadPaymentPlans();
    const installments = this.loadInstallments();

    const plan = plans.find(p => p.sessionId === sessionId);
    if (!plan) return 0;
    
    const parcelasPagas = installments.filter(installment => 
      installment.paymentPlanId === plan.id && installment.status === 'pago'
    );
    
    return parcelasPagas.reduce((total, parcela) => total + parcela.valor, 0);
  }

  static deduplicate(): void {
    const plans = this.loadPaymentPlans();
    const installments = this.loadInstallments();

    // Remove duplicate plans (same sessionId)
    const uniquePlans = plans.filter((plan, index, self) =>
      index === self.findIndex(p => p.sessionId === plan.sessionId)
    );

    // Remove duplicate installments (same paymentPlanId + numeroParcela + status)
    const uniqueInstallments = installments.filter((installment, index, self) =>
      index === self.findIndex(i => 
        i.paymentPlanId === installment.paymentPlanId &&
        i.numeroParcela === installment.numeroParcela &&
        i.status === installment.status &&
        Math.abs(i.valor - installment.valor) < 0.01
      )
    );

    if (plans.length !== uniquePlans.length || installments.length !== uniqueInstallments.length) {
      this.savePaymentPlans(uniquePlans);
      this.saveInstallments(uniqueInstallments);
    }
  }
}