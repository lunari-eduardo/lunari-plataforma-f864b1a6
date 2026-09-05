import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getPlanDisplayName } from '@/lib/transferPlans';

import { useCreditsCheckoutData } from './checkout/hooks/useCreditsCheckoutData';
import { SelectAvulsoSection } from './checkout/components/SelectAvulsoSection';
import { CombosSection } from './checkout/components/CombosSection';
import { ComparisonTableSection } from './checkout/components/ComparisonTableSection';
import { TransferSection } from './checkout/components/TransferSection';
import { DowngradeDialog } from './checkout/components/DowngradeDialog';

export default function CreditsCheckout() {
  const d = useCreditsCheckoutData();

  if (d.isLoadingPlans) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="container max-w-6xl py-3 flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => d.navigate('/app/minha-conta?tab=planos')}
              className="gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </div>
        </header>
        <div className="container max-w-6xl py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-96 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Back button */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-6xl py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => d.navigate('/app/minha-conta?tab=planos')}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-primary/3 to-transparent" />
        <div className="relative container max-w-6xl pt-10 pb-24 md:pb-28 text-center space-y-4">
          <Badge variant="secondary" className="text-xs tracking-wider uppercase">
            {d.activeTab === 'select' ? 'Créditos' : 'Armazenamento'}
          </Badge>
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-foreground max-w-2xl mx-auto text-balance">
            {d.activeTab === 'select'
              ? 'Organize e profissionalize o processo de seleção de fotos'
              : 'Entregue suas fotos com qualidade e profissionalismo'}
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto">
            {d.activeTab === 'select'
              ? 'Créditos flexíveis, sem validade e sem mensalidade.'
              : 'Armazenamento seguro com entrega profissional no seu estilo.'}
          </p>
        </div>
      </section>

      {/* Select Tab */}
      {d.activeTab === 'select' && (
        <>
          <SelectAvulsoSection
            isLoadingPackages={d.isLoadingPackages}
            avulsos={d.avulsos}
            formatPrice={d.formatPrice}
            onBuy={d.handleBuy}
          />

          <div className="text-center pb-20">
            <p className="text-sm text-muted-foreground/70 italic">
              Usa créditos com frequência? Um plano mensal pode sair mais vantajoso no longo prazo.
            </p>
          </div>

          <CombosSection
            billingPeriod={d.billingPeriod}
            setBillingPeriod={d.setBillingPeriod}
            comboPlans={d.COMBO_PLANS}
            allSubs={d.allSubs}
            formatPrice={d.formatPrice}
            onSubscribe={d.handleSubscribe}
          />

          <ComparisonTableSection comparisonRows={d.comparisonRows} />
        </>
      )}

      {/* Transfer Tab */}
      {d.activeTab === 'transfer' && (
        <TransferSection
          isUpgradeMode={d.isUpgradeMode}
          currentPlanType={d.currentPlanType}
          dynamicPlanName={d.dynamicPlanName}
          daysRemaining={d.daysRemaining}
          billingPeriod={d.billingPeriod}
          setBillingPeriod={d.setBillingPeriod}
          transferPlans={d.TRANSFER_PLANS}
          allSubs={d.allSubs}
          activeSubs={d.activeSubs}
          currentPriceCents={d.currentPriceCents}
          totalCycleDays={d.totalCycleDays}
          currentSubscriptionId={d.currentSubscriptionId}
          getCrossProductProrata={d.getCrossProductProrata}
          formatPrice={d.formatPrice}
          onSubscribe={d.handleSubscribe}
          onOpenDowngrade={(planType, planName, billingCycle) => {
            d.setDowngradeConfirmed(false);
            d.setDowngradeDialog({ planType, planName, billingCycle });
          }}
          transferCombo={d.TRANSFER_COMBO}
        />
      )}

      {/* Downgrade dialog */}
      <DowngradeDialog
        downgradeDialog={d.downgradeDialog}
        onClose={() => {
          d.setDowngradeDialog(null);
          d.setDowngradeConfirmed(false);
        }}
        onConfirm={d.handleDowngrade}
        isDowngrading={d.isDowngrading}
        isOverLimitOnDowngrade={d.isOverLimitOnDowngrade}
        newDowngradeLimitBytes={d.newDowngradeLimitBytes}
        storageUsedBytes={d.storageUsedBytes}
        downgradeConfirmed={d.downgradeConfirmed}
        setDowngradeConfirmed={d.setDowngradeConfirmed}
        planDisplayName={
          d.downgradeDialog
            ? d.dynamicPlanName(d.downgradeDialog.planType) ||
              getPlanDisplayName(d.downgradeDialog.planType)
            : ''
        }
      />
    </div>
  );
}
