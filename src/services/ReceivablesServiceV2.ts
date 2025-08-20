import { ClientPaymentPlan, PaymentInstallment } from '@/types/receivables';
import { getCurrentDateString, formatDateForStorage } from '@/utils/dateUtils';

const STORAGE_KEYS = {
  PAYMENT_PLANS: 'lunari_payment_plans_v2',
  INSTALLMENTS: 'lunari_installments_v2'
};

export class ReceivablesServiceV2 {
  // Core CRUD operations
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

  // Simplified payment schedule creation
  static createOrUpdatePaymentSchedule(
    sessionId: string,
    clienteId: string,
    valorAgendar: number, // Valor direto a ser agendado
    valorEntrada: number, // Ignorado na V3
    formaPagamento: 'avista' | 'parcelado',
    numeroParcelas: number,
    dataPrimeiroPagamento: string,
    observacoes?: string
  ): { plan: ClientPaymentPlan; newInstallments: PaymentInstallment[] } {
    console.log(`🔄 [V3] Agendamento simplificado - Session: ${sessionId}, Valor a agendar: ${valorAgendar}`);
    
    const plans = this.loadPaymentPlans();
    const installments = this.loadInstallments();
    
    // 1. Separar e preservar quick plans/payments
    const quickPlans = plans.filter(p => p.sessionId === sessionId && p.id.includes('plan-v2-quick-'));
    const otherPlans = plans.filter(p => p.sessionId !== sessionId);
    
    const quickInstallments = installments.filter(i => {
      const plan = quickPlans.find(p => p.id === i.paymentPlanId);
      return plan !== undefined;
    });
    const otherInstallments = installments.filter(i => {
      const plan = plans.find(p => p.id === i.paymentPlanId);
      return !plan || plan.sessionId !== sessionId || quickPlans.some(qp => qp.id === plan.id);
    });
    
    // 2. Criar novo plano apenas com o valor a agendar
    const planId = `plan-v2-scheduled-${sessionId}-${Date.now()}`;
    const valorParcela = formaPagamento === 'avista' ? valorAgendar : valorAgendar / numeroParcelas;
    
    const newPlan: ClientPaymentPlan = {
      id: planId,
      sessionId,
      clienteId,
      valorTotal: valorAgendar,
      formaPagamento,
      numeroParcelas: formaPagamento === 'avista' ? 1 : numeroParcelas,
      valorParcela,
      diaVencimento: new Date(dataPrimeiroPagamento).getDate(),
      status: 'ativo',
      observacoes,
      criadoEm: new Date().toISOString()
    };
    
    // 3. Criar apenas parcelas agendadas (numeroParcela sequencial: 1, 2, 3...)
    const newScheduledInstallments: PaymentInstallment[] = [];
    const dataPrimeiro = new Date(dataPrimeiroPagamento);
    const qtdParcelas = formaPagamento === 'avista' ? 1 : numeroParcelas;
    
    for (let i = 1; i <= qtdParcelas; i++) {
      const dataVencimento = new Date(dataPrimeiro);
      dataVencimento.setMonth(dataVencimento.getMonth() + (i - 1));
      
      const parcela: PaymentInstallment = {
        id: `installment-v2-${planId}-${i}-${Date.now()}`,
        paymentPlanId: planId,
        numeroParcela: i,
        valor: valorParcela,
        dataVencimento: formatDateForStorage(dataVencimento),
        status: 'pendente',
        observacoes: formaPagamento === 'avista' ? 'Pagamento à vista agendado' : `Parcela ${i}/${qtdParcelas} agendada`
      };
      
      newScheduledInstallments.push(parcela);
    }
    
    // 4. Salvar preservando quick plans e payments
    const finalPlans = [...otherPlans, ...quickPlans, newPlan];
    const finalInstallments = [...otherInstallments, ...quickInstallments, ...newScheduledInstallments];
    
    this.savePaymentPlans(finalPlans);
    this.saveInstallments(finalInstallments);
    
    console.log(`✅ [V3] Agendamento criado - ${qtdParcelas} parcela(s) de ${valorParcela.toFixed(2)} cada`);
    
    return {
      plan: newPlan,
      newInstallments: newScheduledInstallments
    };
  }

  // Utility functions
  static getInstallmentsForSession(sessionId: string): PaymentInstallment[] {
    const plans = this.loadPaymentPlans();
    const installments = this.loadInstallments();
    
    const sessionPlans = plans.filter(p => p.sessionId === sessionId);
    const sessionInstallments: PaymentInstallment[] = [];
    
    sessionPlans.forEach(plan => {
      const planInstallments = installments.filter(i => i.paymentPlanId === plan.id);
      sessionInstallments.push(...planInstallments);
    });
    
    return sessionInstallments;
  }
  
  static getPaidInstallmentsForSession(sessionId: string): PaymentInstallment[] {
    return this.getInstallmentsForSession(sessionId).filter(i => i.status === 'pago');
  }
  
  static getTotalPaidForSession(sessionId: string): number {
    const paidInstallments = this.getPaidInstallmentsForSession(sessionId);
    return paidInstallments.reduce((total, p) => total + p.valor, 0);
  }
  
  static hasScheduledPayments(sessionId: string): boolean {
    const plans = this.loadPaymentPlans();
    const installments = this.loadInstallments();
    
    const sessionPlans = plans.filter(p => p.sessionId === sessionId);
    
    return sessionPlans.some(plan => {
      const planInstallments = installments.filter(i => i.paymentPlanId === plan.id);
      return planInstallments.some(i => i.status === 'pendente');
    });
  }
  
  static getPaymentScheduleInfo(sessionId: string) {
    const plans = this.loadPaymentPlans();
    const plan = plans.find(p => p.sessionId === sessionId);
    
    if (!plan) return null;
    
    const installments = this.loadInstallments();
    const planInstallments = installments.filter(i => i.paymentPlanId === plan.id);
    const pendingInstallments = planInstallments.filter(i => i.status === 'pendente');
    
    return {
      plan,
      installments: planInstallments,
      pendingCount: pendingInstallments.length,
      hasScheduled: pendingInstallments.length > 0
    };
  }

  // Quick payment registration
  static addQuickPayment(
    sessionId: string,
    clienteId: string,
    valor: number,
    valorTotalSessao?: number
  ): PaymentInstallment {
    console.log(`💸 [V2] Pagamento rápido - Session: ${sessionId}, Valor: ${valor}`);
    
    const plans = this.loadPaymentPlans();
    const installments = this.loadInstallments();
    
    // Buscar especificamente por plano quick da sessão (evita duplicação)
    let quickPlan = plans.find(p => p.sessionId === sessionId && p.id.includes('plan-v2-quick-'));
    
    if (!quickPlan) {
      const planId = `plan-v2-quick-${sessionId}-${Date.now()}`;
      quickPlan = {
        id: planId,
        sessionId,
        clienteId,
        valorTotal: valorTotalSessao || valor,
        formaPagamento: 'avista',
        numeroParcelas: 1,
        valorParcela: valorTotalSessao || valor,
        diaVencimento: 10,
        status: 'ativo',
        criadoEm: new Date().toISOString()
      };
      
      const updatedPlans = [...plans, quickPlan];
      this.savePaymentPlans(updatedPlans);
      console.log(`✅ [V2] Novo plano quick criado: ${planId}`);
    } else {
      console.log(`🔄 [V2] Usando plano quick existente: ${quickPlan.id}`);
    }
    
    // Criar parcela paga
      const quickPayment: PaymentInstallment = {
        id: `installment-v2-quick-${quickPlan.id}-${Date.now()}`,
        paymentPlanId: quickPlan.id,
        numeroParcela: 0, // Pagamento à vista (workflow)
        valor,
        dataVencimento: getCurrentDateString(),
        status: 'pago',
        dataPagamento: getCurrentDateString(),
        observacoes: 'Pagamento à vista via workflow'
      };
    
    const updatedInstallments = [...installments, quickPayment];
    this.saveInstallments(updatedInstallments);
    
    console.log(`✅ [V2] Pagamento rápido registrado: ${quickPayment.id}`);
    
    return quickPayment;
  }

  // Session cleanup with confirmation
  static removeSessionData(sessionId: string, preservePayments: boolean = true): void {
    console.log(`🗑️ [V2] Removendo dados da sessão ${sessionId}, preservar pagamentos: ${preservePayments}`);
    
    const plans = this.loadPaymentPlans();
    const installments = this.loadInstallments();
    
    if (preservePayments) {
      // Preservar apenas pagamentos realizados, remover agendamentos
      const sessionPlans = plans.filter(p => p.sessionId === sessionId);
      const planIds = sessionPlans.map(p => p.id);
      
      // Manter apenas parcelas pagas, remover pendentes
      const filteredInstallments = installments.filter(i => 
        !planIds.includes(i.paymentPlanId) || i.status === 'pago'
      );
      
      // Remover planos se não têm mais parcelas pendentes
      const filteredPlans = plans.filter(p => {
        if (p.sessionId !== sessionId) return true;
        
        const planInstallments = filteredInstallments.filter(i => i.paymentPlanId === p.id);
        return planInstallments.length > 0; // Manter se ainda tem parcelas (pagas)
      });
      
      this.savePaymentPlans(filteredPlans);
      this.saveInstallments(filteredInstallments);
    } else {
      // Remover tudo relacionado à sessão
      const filteredPlans = plans.filter(p => p.sessionId !== sessionId);
      const planIdsToRemove = plans
        .filter(p => p.sessionId === sessionId)
        .map(p => p.id);
      
      const filteredInstallments = installments.filter(
        i => !planIdsToRemove.includes(i.paymentPlanId)
      );
      
      this.savePaymentPlans(filteredPlans);
      this.saveInstallments(filteredInstallments);
    }
    
    console.log(`✅ [V2] Dados da sessão removidos`);
  }

  // Migration from V1 to V2
  static migrateFromV1(): void {
    const v1Plans = localStorage.getItem('lunari_payment_plans');
    const v1Installments = localStorage.getItem('lunari_installments');
    
    if (v1Plans) {
      const plans = JSON.parse(v1Plans);
      console.log(`🔄 [V2] Migrando ${plans.length} planos da V1`);
      this.savePaymentPlans(plans);
    }
    
    if (v1Installments) {
      const installments = JSON.parse(v1Installments);
      console.log(`🔄 [V2] Migrando ${installments.length} parcelas da V1`);
      this.saveInstallments(installments);
    }
  }
}