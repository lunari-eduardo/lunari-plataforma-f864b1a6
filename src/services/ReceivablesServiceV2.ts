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

  // Idempotent operations - safe to call multiple times
  static createOrUpdatePaymentSchedule(
    sessionId: string,
    clienteId: string,
    valorTotal: number,
    valorEntrada: number,
    formaPagamento: 'avista' | 'parcelado',
    numeroParcelas: number,
    dataPrimeiroPagamento: string,
    observacoes?: string
  ): { plan: ClientPaymentPlan; newInstallments: PaymentInstallment[] } {
    console.log(`🔄 [V2] Criando agendamento de pagamento - Session: ${sessionId}, Total: ${valorTotal}, Entrada: ${valorEntrada}`);
    
    const plans = this.loadPaymentPlans();
    const installments = this.loadInstallments();
    
    // 1. Separar tipos de pagamentos existentes
    const existingInstallments = this.getInstallmentsForSession(sessionId);
    const existingEntradas = existingInstallments.filter(i => i.numeroParcela === -1 && i.status === 'pago'); // Entradas
    const existingQuickPayments = existingInstallments.filter(i => i.numeroParcela === 0 && i.status === 'pago'); // Pagamentos rápidos
    
    console.log(`💰 [V2] Entradas: ${existingEntradas.length}, Pagamentos rápidos: ${existingQuickPayments.length}`);
    
    // 3. Remover TODOS os dados da sessão (vamos recriar)
    const cleanPlans = plans.filter(p => p.sessionId !== sessionId);
    const cleanInstallments = installments.filter(i => {
      const plan = plans.find(p => p.id === i.paymentPlanId);
      return plan?.sessionId !== sessionId;
    });
    
    // 4. Criar novo plano (valor restante = total - apenas entradas)
    const planId = `plan-v2-${sessionId}-${Date.now()}`;
    const valorTotalEntradas = existingEntradas.reduce((total, e) => total + e.valor, 0) + valorEntrada;
    const valorRestante = Math.max(0, valorTotal - valorTotalEntradas);
    const valorParcela = valorRestante > 0 ? 
      (formaPagamento === 'avista' ? valorRestante : valorRestante / numeroParcelas) : 0;
    
    const newPlan: ClientPaymentPlan = {
      id: planId,
      sessionId,
      clienteId,
      valorTotal,
      formaPagamento,
      numeroParcelas: formaPagamento === 'avista' ? 1 : numeroParcelas,
      valorParcela,
      diaVencimento: new Date(dataPrimeiroPagamento).getDate(),
      status: valorRestante <= 0 ? 'quitado' : 'ativo',
      observacoes,
      criadoEm: new Date().toISOString()
    };
    
    // 5. Re-anexar pagamentos existentes ao novo plano
    const reattachedInstallments = [...existingEntradas, ...existingQuickPayments].map(p => ({
      ...p,
      paymentPlanId: planId
    }));
    
    console.log(`🔗 [V2] Re-anexando ${reattachedInstallments.length} pagamentos ao plano ${planId}`);
    
    // 6. Criar entrada se informada
    if (valorEntrada > 0) {
      console.log(`➕ [V2] Criando entrada de ${valorEntrada}`);
      
      const entrada: PaymentInstallment = {
        id: `installment-v2-${planId}-entrada-${Date.now()}`,
        paymentPlanId: planId,
        numeroParcela: -1, // Entrada
        valor: valorEntrada,
        dataVencimento: getCurrentDateString(),
        status: 'pago',
        dataPagamento: getCurrentDateString(),
        observacoes: 'Entrada via agendamento de pagamento'
      };
      
      reattachedInstallments.push(entrada);
    }
    
    // 7. Criar novas parcelas pendentes (APENAS se há valor restante)
    const newPendingInstallments: PaymentInstallment[] = [];
    
    if (valorRestante > 0) {
      const dataPrimeiro = new Date(dataPrimeiroPagamento);
      const parcelas = formaPagamento === 'avista' ? 1 : numeroParcelas;
      
      for (let i = 1; i <= parcelas; i++) {
        const dataVencimento = new Date(dataPrimeiro);
        dataVencimento.setMonth(dataVencimento.getMonth() + (i - 1));
        
        const parcela: PaymentInstallment = {
          id: `installment-v2-${planId}-${i}-${Date.now()}`,
          paymentPlanId: planId,
          numeroParcela: i,
          valor: valorParcela,
          dataVencimento: formatDateForStorage(dataVencimento),
          status: 'pendente',
          observacoes: formaPagamento === 'avista' ? 'Agendamento à vista' : `Parcela ${i} agendada`
        };
        
        newPendingInstallments.push(parcela);
      }
    }
    
    // 8. Salvar tudo
    const allNewInstallments = [...reattachedInstallments, ...newPendingInstallments];
    const finalPlans = [...cleanPlans, newPlan];
    const finalInstallments = [...cleanInstallments, ...allNewInstallments];
    
    this.savePaymentPlans(finalPlans);
    this.saveInstallments(finalInstallments);
    
    console.log(`✅ [V2] Agendamento criado - Plano: ${planId}, Parcelas: ${allNewInstallments.length}`);
    
    return {
      plan: newPlan,
      newInstallments: allNewInstallments
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
    
    // Encontrar ou criar plano básico
    let plan = plans.find(p => p.sessionId === sessionId);
    
    if (!plan) {
      const planId = `plan-v2-quick-${sessionId}-${Date.now()}`;
      plan = {
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
      
      const updatedPlans = [...plans, plan];
      this.savePaymentPlans(updatedPlans);
    }
    
    // Criar parcela paga
      const quickPayment: PaymentInstallment = {
        id: `installment-v2-quick-${plan.id}-${Date.now()}`,
        paymentPlanId: plan.id,
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