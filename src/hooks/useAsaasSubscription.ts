import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { PLAN_FAMILIES, PLAN_INCLUDES } from '@/lib/planConfig';

export interface AsaasSubscription {
  id: string;
  user_id: string;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
  plan_type: string;
  billing_cycle: string;
  status: string;
  value_cents: number;
  next_due_date: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown> | null;
  pending_downgrade_plan: string | null;
  pending_downgrade_cycle: string | null;
}

interface DowngradeSubscriptionParams {
  subscriptionId: string;
  newPlanType: string;
  newBillingCycle?: string;
}

interface CreateCustomerParams {
  name: string;
  cpfCnpj: string;
  email?: string;
}

interface CreateSubscriptionParams {
  planType: string;
  billingCycle: 'MONTHLY' | 'YEARLY';
  creditCard: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  creditCardHolderInfo: {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    phone: string;
  };
  remoteIp: string;
}

interface CreatePaymentParams {
  productType: 'subscription_yearly';
  planType?: string;
  installmentCount?: number;
  creditCard: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  creditCardHolderInfo: {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    phone: string;
  };
  remoteIp: string;
}

interface UpgradeSubscriptionParams {
  currentSubscriptionId: string;
  newPlanType: string;
  billingCycle: 'MONTHLY' | 'YEARLY';
  creditCard: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  creditCardHolderInfo: {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    phone: string;
  };
  remoteIp: string;
}

function subHasStudio(planType: string): boolean {
  return PLAN_INCLUDES[planType]?.studio ?? false;
}

export function useAsaasSubscription() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: allSubscriptions = [], isLoading } = useQuery({
    queryKey: ['asaas-subscription', user?.id],
    queryFn: async (): Promise<AsaasSubscription[]> => {
      if (!user?.id) return [];

      const { data: activeSubs, error } = await supabase
        .from('subscriptions_asaas' as any)
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['ACTIVE', 'PENDING', 'OVERDUE'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching subscriptions:', error);
        return [];
      }

      const results = (activeSubs as unknown as AsaasSubscription[]) || [];

      // Fallback: CANCELLED with future next_due_date
      const { data: cancelledSubs } = await supabase
        .from('subscriptions_asaas' as any)
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'CANCELLED')
        .gte('next_due_date', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (cancelledSubs) {
        const activePlanTypes = new Set(results.map(s => s.plan_type));
        for (const cs of cancelledSubs as unknown as AsaasSubscription[]) {
          if (!activePlanTypes.has(cs.plan_type)) results.push(cs);
        }
      }

      return results;
    },
    enabled: !!user?.id,
  });

  const subscription = allSubscriptions.length > 0 ? allSubscriptions[0] : null;
  const studioSub = allSubscriptions.find(s => subHasStudio(s.plan_type));

  // Mutations
  const createCustomerMutation = useMutation({
    mutationFn: async (params: CreateCustomerParams) => {
      const { data, error } = await supabase.functions.invoke('asaas-create-customer', { body: params });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as { customerId: string };
    },
  });

  const createSubscriptionMutation = useMutation({
    mutationFn: async (params: CreateSubscriptionParams) => {
      const { data, error } = await supabase.functions.invoke('asaas-create-subscription', { body: params });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as { subscriptionId: string; status: string; localId: string };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['asaas-subscription'] }),
  });

  const createPaymentMutation = useMutation({
    mutationFn: async (params: CreatePaymentParams) => {
      const { data, error } = await supabase.functions.invoke('asaas-create-payment', { body: params });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as { paymentId: string; status: string; localId?: string; installmentCount?: number };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['asaas-subscription'] }),
  });

  const upgradeSubscriptionMutation = useMutation({
    mutationFn: async (params: UpgradeSubscriptionParams) => {
      const { data, error } = await supabase.functions.invoke('asaas-upgrade-subscription', { body: params });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as { newSubscriptionId: string; status: string; prorataValueCents: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asaas-subscription'] });
      toast({ title: 'Upgrade realizado com sucesso!' });
    },
    onError: (error: Error) => toast({ title: 'Erro', description: error.message, variant: 'destructive' }),
  });

  const cancelSubscriptionMutation = useMutation({
    mutationFn: async (subscriptionId: string) => {
      const { data, error } = await supabase.functions.invoke('asaas-cancel-subscription', { body: { subscriptionId } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asaas-subscription'] });
      toast({ title: 'Assinatura cancelada com sucesso.' });
    },
    onError: (error: Error) => toast({ title: 'Erro', description: error.message, variant: 'destructive' }),
  });

  const downgradeSubscriptionMutation = useMutation({
    mutationFn: async (params: DowngradeSubscriptionParams) => {
      const { data, error } = await supabase.functions.invoke('asaas-downgrade-subscription', { body: params });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as { success: boolean; scheduledPlan: string; message: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['asaas-subscription'] });
      toast({ title: data.message || 'Downgrade agendado com sucesso.' });
    },
    onError: (error: Error) => toast({ title: 'Erro', description: error.message, variant: 'destructive' }),
  });

  const cancelDowngradeMutation = useMutation({
    mutationFn: async (subscriptionId: string) => {
      const { error } = await supabase
        .from('subscriptions_asaas' as any)
        .update({ pending_downgrade_plan: null, pending_downgrade_cycle: null } as any)
        .eq('id', subscriptionId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asaas-subscription'] });
      toast({ title: 'Downgrade cancelado.' });
    },
    onError: (error: Error) => toast({ title: 'Erro', description: error.message, variant: 'destructive' }),
  });

  const reactivateSubscriptionMutation = useMutation({
    mutationFn: async (subscriptionId: string) => {
      const { data, error } = await supabase.functions.invoke('asaas-cancel-subscription', {
        body: { subscriptionId, action: 'reactivate' },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asaas-subscription'] });
      toast({ title: 'Assinatura reativada com sucesso!' });
    },
    onError: (error: Error) => toast({ title: 'Erro', description: error.message, variant: 'destructive' }),
  });

  return {
    subscriptions: allSubscriptions,
    subscription,
    studioSub,
    isLoading,
    createCustomer: createCustomerMutation.mutateAsync,
    isCreatingCustomer: createCustomerMutation.isPending,
    createSubscription: createSubscriptionMutation.mutateAsync,
    isCreatingSubscription: createSubscriptionMutation.isPending,
    createPayment: createPaymentMutation.mutateAsync,
    isCreatingPayment: createPaymentMutation.isPending,
    upgradeSubscription: upgradeSubscriptionMutation.mutateAsync,
    isUpgrading: upgradeSubscriptionMutation.isPending,
    cancelSubscription: cancelSubscriptionMutation.mutateAsync,
    isCancelling: cancelSubscriptionMutation.isPending,
    downgradeSubscription: downgradeSubscriptionMutation.mutateAsync,
    isDowngrading: downgradeSubscriptionMutation.isPending,
    cancelDowngrade: cancelDowngradeMutation.mutateAsync,
    isCancellingDowngrade: cancelDowngradeMutation.isPending,
    reactivateSubscription: reactivateSubscriptionMutation.mutateAsync,
    isReactivating: reactivateSubscriptionMutation.isPending,
  };
}
