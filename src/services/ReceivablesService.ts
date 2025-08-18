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

    const entradaParcela: PaymentInstallment = {
      id: `installment-${plan.id}-entrada-${Date.now()}`,
      paymentPlanId: plan.id,
      numeroParcela: 0, // Entry payment
      valor,
      dataVencimento: data || getCurrentDateString(),
      status: 'pago',
      dataPagamento: data || getCurrentDateString(),
      observacoes: 'Pagamento de entrada'
    };

    const updatedInstallments = [...installments, entradaParcela];
    this.saveInstallments(updatedInstallments);

    return entradaParcela;
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
}