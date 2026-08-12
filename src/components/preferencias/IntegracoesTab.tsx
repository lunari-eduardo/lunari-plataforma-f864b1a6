
import { CreditCard, Calendar, Crown, FileSignature } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PaymentSettings } from '@/components/integracoes/PaymentSettings';
import { GoogleCalendarCard } from '@/components/integracoes/GoogleCalendarCard';
import { AutentiqueCard } from '@/components/integracoes/AutentiqueCard';

import { useAccessControl } from '@/hooks/useAccessControl';
import { toast } from 'sonner';
import { PAGE_TABS_LIST, PAGE_TABS_TRIGGER, PAGE_TABS_CONTENT } from '@/components/layout/PageTabs';

export function IntegracoesTab() {
  const { hasPro } = useAccessControl();


  return (
    <div className="space-y-5">
      {/* Tabs */}
      <Tabs defaultValue="pagamentos" className="w-full">
        <TabsList className={PAGE_TABS_LIST}>
          <TabsTrigger value="pagamentos" className={PAGE_TABS_TRIGGER} title="Pagamentos">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Pagamentos</span>
          </TabsTrigger>
          <TabsTrigger value="assinatura" className={PAGE_TABS_TRIGGER} title="Assinatura">
            <FileSignature className="h-4 w-4" />
            <span className="hidden sm:inline">Assinatura</span>
          </TabsTrigger>
          <TabsTrigger
            value="calendar"
            className={PAGE_TABS_TRIGGER}
            title="Google Calendar"
            onClick={(e) => {
              if (!hasPro) {
                e.preventDefault();
                toast('Recurso exclusivo do plano Pro', {
                  description: 'Faça upgrade para integrar com o Google Calendar.',
                  action: {
                    label: 'Ver planos',
                    onClick: () => window.location.href = '/escolher-plano',
                  },
                });
              }
            }}
            disabled={!hasPro}
          >
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Calendar</span>
            {!hasPro && <Crown className="h-3.5 w-3.5 text-accent-gold" />}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pagamentos" className={PAGE_TABS_CONTENT}>
          <PaymentSettings />
        </TabsContent>

        <TabsContent value="assinatura" className={PAGE_TABS_CONTENT}>
          <div className="max-w-2xl">
            <AutentiqueCard />
          </div>
        </TabsContent>

        <TabsContent value="calendar" className={PAGE_TABS_CONTENT}>
          <div className="max-w-2xl">
            <GoogleCalendarCard />
          </div>
        </TabsContent>

      </Tabs>
    </div>
  );
}
