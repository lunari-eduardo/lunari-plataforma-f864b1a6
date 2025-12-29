import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CreditCard, Plug } from 'lucide-react';
import { IntegrationCard } from '@/components/integracoes/IntegrationCard';
import { GoogleCalendarCard } from '@/components/integracoes/GoogleCalendarCard';
import { useIntegracoes } from '@/hooks/useIntegracoes';
import { useGoogleCalendarIntegration } from '@/hooks/useGoogleCalendarIntegration';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

// Mercado Pago icon as SVG
const MercadoPagoIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
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

        {/* Stripe - Coming Soon */}
        <IntegrationCard
          title="Stripe"
          description="Aceite pagamentos internacionais via cartão de crédito e débito. Ideal para clientes no exterior."
          icon={<CreditCard className="w-6 h-6" />}
          status="em_breve"
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
