import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAsaasSubscription } from '@/hooks/useAsaasSubscription';
import { isSubActiveForPlan } from '@/lib/transferPlans';

import { PaymentState } from './payment/types';
import { SelectFlow } from './payment/components/SelectFlow';
import { SubscriptionWizard } from './payment/components/SubscriptionWizard';

export default function CreditsPayment() {
  const navigate = useNavigate();
  const location = useLocation();
  const { subscriptions: allSubs, isLoading: subsLoading } = useAsaasSubscription();

  const pkg = location.state as PaymentState | null;

  // Guard: redirect if user already has this subscription plan active
  useEffect(() => {
    if (subsLoading || !pkg || pkg.type !== 'subscription' || pkg.isUpgrade) return;
    if (isSubActiveForPlan(allSubs, pkg.planType)) {
      toast.error('Você já possui este plano ativo.');
      navigate('/credits/subscription', { replace: true });
    }
  }, [subsLoading, allSubs, pkg, navigate]);

  if (!pkg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Nenhum pacote selecionado.</p>
          <Button variant="outline" onClick={() => navigate('/app/planos-e-creditos?tab=select')}>
            Voltar para pacotes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container max-w-5xl py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              navigate(`/credits/checkout?tab=${pkg?.type === 'subscription' ? 'transfer' : 'select'}`)
            }
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <div className="h-4 w-px bg-border" />
          <span className="text-sm text-muted-foreground">Checkout</span>
        </div>
      </header>

      <main className="container max-w-5xl py-8">
        {pkg.type === 'select' ? <SelectFlow pkg={pkg} /> : <SubscriptionWizard pkg={pkg} />}
      </main>
    </div>
  );
}
