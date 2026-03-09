import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plug, CreditCard, Calendar, Crown, Lock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PagamentosTab } from '@/components/integracoes/PagamentosTab';
import { GoogleCalendarCard } from '@/components/integracoes/GoogleCalendarCard';
import { useIntegracoes } from '@/hooks/useIntegracoes';
import { useGoogleCalendarIntegration } from '@/hooks/useGoogleCalendarIntegration';
import { useAccessControl } from '@/hooks/useAccessControl';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

export function IntegracoesTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    loading,
    connecting,
    mercadoPagoStatus,
    mercadoPagoConnectedAt,
    mercadoPagoUserId,
    mercadoPagoSettings,
    infinitePayStatus,
    infinitePayHandle,
    pixManualStatus,
    pixManualData,
    asaasStatus,
    asaasSettings,
    provedorPadrao,
    connectMercadoPago,
    disconnectMercadoPago,
    handleOAuthCallback,
    updateMercadoPagoSettings,
    saveInfinitePayHandle,
    disconnectInfinitePay,
    savePixManual,
    disconnectPixManual,
    saveAsaas,
    updateAsaasSettings,
    disconnectAsaas,
    setProvedorPadrao,
  } = useIntegracoes();

  const { refetch: refetchGoogleCalendar } = useGoogleCalendarIntegration();
  const { hasPro } = useAccessControl();

  // Handle OAuth callbacks (Mercado Pago and Google Calendar)
  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const googleSuccess = searchParams.get('google_success');
    const googleError = searchParams.get('google_error');

    // Handle Google Calendar callback
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

    // Handle Mercado Pago callback
    if (error) {
      console.error('[IntegracoesTab] OAuth error:', error);
      setSearchParams({ tab: 'integracoes' });
      return;
    }

    if (code) {
      console.log('[IntegracoesTab] Processing OAuth callback with code');
      handleOAuthCallback(code).then(() => {
        setSearchParams({ tab: 'integracoes' });
      });
    }
  }, [searchParams, setSearchParams, handleOAuthCallback, refetchGoogleCalendar]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

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
          <PagamentosTab
            mercadoPagoStatus={mercadoPagoStatus}
            mercadoPagoConnectedAt={mercadoPagoConnectedAt}
            mercadoPagoUserId={mercadoPagoUserId}
            mercadoPagoSettings={mercadoPagoSettings}
            onConnectMercadoPago={connectMercadoPago}
            onDisconnectMercadoPago={disconnectMercadoPago}
            onUpdateMercadoPagoSettings={updateMercadoPagoSettings}
            infinitePayStatus={infinitePayStatus}
            infinitePayHandle={infinitePayHandle}
            onSaveInfinitePay={saveInfinitePayHandle}
            onDisconnectInfinitePay={disconnectInfinitePay}
            pixManualStatus={pixManualStatus}
            pixManualData={pixManualData}
            onSavePixManual={savePixManual}
            onDisconnectPixManual={disconnectPixManual}
            asaasStatus={asaasStatus}
            asaasSettings={asaasSettings}
            onSaveAsaas={saveAsaas}
            onUpdateAsaasSettings={updateAsaasSettings}
            onDisconnectAsaas={disconnectAsaas}
            provedorPadrao={provedorPadrao}
            onSetProvedorPadrao={setProvedorPadrao}
            loading={loading}
            connecting={connecting}
          />
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
