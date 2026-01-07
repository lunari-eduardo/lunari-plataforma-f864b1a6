import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plug } from 'lucide-react';
import { IntegrationCard } from '@/components/integracoes/IntegrationCard';
import { GoogleCalendarCard } from '@/components/integracoes/GoogleCalendarCard';
import { useIntegracoes } from '@/hooks/useIntegracoes';
import { useGoogleCalendarIntegration } from '@/hooks/useGoogleCalendarIntegration';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

// Mercado Pago official logo
const MercadoPagoIcon = () => (
  <svg viewBox="0 0 50 50" className="w-6 h-6">
    <path fill="#00AEEF" d="M25 2C12.3 2 2 12.3 2 25s10.3 23 23 23 23-10.3 23-23S37.7 2 25 2z"/>
    <path fill="#fff" d="M36.4 20.2c-1.8-3.2-5.3-5.4-9.3-5.4-3.1 0-5.9 1.3-7.9 3.4-2-2.1-4.8-3.4-7.9-3.4-4 0-7.5 2.2-9.3 5.4-.6 1-.9 2.2-.9 3.4 0 .9.2 1.8.5 2.6 1.3 3.5 4.6 6 8.5 6h.1c.4 2.3 2.4 4.1 4.8 4.1s4.4-1.8 4.8-4.1h.3c.4 2.3 2.4 4.1 4.8 4.1s4.4-1.8 4.8-4.1h.1c3.9 0 7.2-2.5 8.5-6 .3-.8.5-1.7.5-2.6 0-1.2-.3-2.4-.9-3.4zm-25.1 9.1c-2.8 0-5.2-1.8-6.1-4.3-.2-.5-.3-1.1-.3-1.6 0-.8.2-1.5.6-2.2 1.2-2.1 3.4-3.5 6-3.5 2.3 0 4.4 1.2 5.6 3 .1.1.1.2.2.3-.2.5-.3 1.1-.3 1.7 0 2.1 1.2 3.9 2.9 4.8-.3.1-.6.1-.9.1h-.1c-.7-1.8-2.4-3.1-4.4-3.1s-3.7 1.3-4.4 3.1c-.3-.1-.6-.2-.8-.3zm8.7 4.6c-1.6 0-2.9-1.3-2.9-2.9s1.3-2.9 2.9-2.9 2.9 1.3 2.9 2.9-1.3 2.9-2.9 2.9zm10 0c-1.6 0-2.9-1.3-2.9-2.9s1.3-2.9 2.9-2.9 2.9 1.3 2.9 2.9-1.3 2.9-2.9 2.9zm8.7-4.6c-.2.1-.5.2-.8.3-.7-1.8-2.4-3.1-4.4-3.1s-3.7 1.3-4.4 3.1h-.1c-.3 0-.6 0-.9-.1 1.7-.9 2.9-2.7 2.9-4.8 0-.6-.1-1.2-.3-1.7.1-.1.1-.2.2-.3 1.2-1.8 3.3-3 5.6-3 2.6 0 4.8 1.4 6 3.5.4.7.6 1.4.6 2.2 0 .5-.1 1.1-.3 1.6-.9 2.5-3.3 4.3-6.1 4.3z"/>
  </svg>
);

export function IntegracoesTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    loading,
    connecting,
    mercadoPagoStatus,
    connectMercadoPago,
    disconnectMercadoPago,
    handleOAuthCallback,
    integracoes,
  } = useIntegracoes();

  const { refetch: refetchGoogleCalendar } = useGoogleCalendarIntegration();

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
      handleOAuthCallback(code).then((success) => {
        setSearchParams({ tab: 'integracoes' });
      });
    }
  }, [searchParams, setSearchParams, handleOAuthCallback, refetchGoogleCalendar]);

  const mpIntegration = integracoes.find(i => i.provedor === 'mercadopago');
  const connectedInfo = mpIntegration?.conectado_em 
    ? `Conectado em ${new Date(mpIntegration.conectado_em).toLocaleDateString('pt-BR')}`
    : undefined;

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
          <h2 className="text-lg font-semibold">Integrações e Conexões</h2>
        </div>
        <p className="text-muted-foreground text-sm">
          Conecte suas contas para automatizar cobranças, pagamentos e agenda
        </p>
      </div>

      {/* Integration Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Google Calendar */}
        <GoogleCalendarCard />

        {/* Mercado Pago */}
        <IntegrationCard
          title="Mercado Pago"
          description="Permita que o Lunari envie cobranças via Pix e link de pagamento usando sua conta Mercado Pago. Os pagamentos vão diretamente para sua conta."
          icon={<MercadoPagoIcon />}
          status={mercadoPagoStatus}
          onConnect={connectMercadoPago}
          onDisconnect={disconnectMercadoPago}
          loading={connecting}
          connectedInfo={connectedInfo}
        />
      </div>

      {/* Instructions */}
      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
        <h3 className="font-medium">Como funciona?</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Clique em "Conectar" para autorizar o Lunari a usar sua conta</li>
          <li>• Você será redirecionado para autorizar o acesso</li>
          <li>• Após autorizar, a integração será ativada automaticamente</li>
          <li>• Você pode desconectar a qualquer momento</li>
        </ul>
      </div>
    </div>
  );
}
