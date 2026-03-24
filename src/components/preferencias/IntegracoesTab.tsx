import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plug, CreditCard, Calendar, Crown } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PaymentSettings } from '@/components/integracoes/PaymentSettings';
import { GoogleCalendarCard } from '@/components/integracoes/GoogleCalendarCard';
import { useGoogleCalendarIntegration } from '@/hooks/useGoogleCalendarIntegration';
import { useAccessControl } from '@/hooks/useAccessControl';
import { toast } from 'sonner';

export function IntegracoesTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { refetch: refetchGoogleCalendar } = useGoogleCalendarIntegration();
  const { hasPro } = useAccessControl();

  // Handle Google Calendar OAuth callbacks
  useEffect(() => {
    const googleSuccess = searchParams.get('google_success');
    const googleError = searchParams.get('google_error');

    if (googleSuccess) {
      toast.success('Google Calendar conectado com sucesso');
      refetchGoogleCalendar();
      setSearchParams({ tab: 'integracoes' });
      return;
    }

    if (googleError) {
      const errorMessages: Record<string, string> = {
        'access_denied': 'Acesso negado pelo usuário',
        'missing_params': 'Parâmetros inválidos',
        'token_exchange_failed': 'Falha na autenticação',
        'database_error': 'Erro ao salvar integração',
      };
      toast.error(errorMessages[googleError] || 'Erro ao conectar Google Calendar');
      setSearchParams({ tab: 'integracoes' });
      return;
    }
  }, [searchParams, setSearchParams, refetchGoogleCalendar]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Plug className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Integrações</h2>
        </div>
        <p className="text-muted-foreground text-sm">
          Gerencie suas integrações de pagamento e calendário
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pagamentos" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="pagamentos" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Pagamentos
          </TabsTrigger>
          <TabsTrigger 
            value="calendar" 
            className="gap-2"
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
            Google Calendar
            {!hasPro && <Crown className="h-3.5 w-3.5 text-primary" />}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pagamentos" className="mt-6">
          <PaymentSettings />
        </TabsContent>

        <TabsContent value="calendar" className="mt-6">
          <div className="max-w-xl">
            <GoogleCalendarCard />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
