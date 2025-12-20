import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CreditCard, Plug } from 'lucide-react';
import { IntegrationCard } from '@/components/integracoes/IntegrationCard';
import { useIntegracoes } from '@/hooks/useIntegracoes';
import { Skeleton } from '@/components/ui/skeleton';

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

  // Handle OAuth callback
  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      console.error('[IntegracoesTab] OAuth error:', error);
      // Keep tab param, clear others
      setSearchParams({ tab: 'integracoes' });
      return;
    }

    if (code) {
      console.log('[IntegracoesTab] Processing OAuth callback with code');
      handleOAuthCallback(code).then((success) => {
        // Clear the URL params after processing, keep tab
        setSearchParams({ tab: 'integracoes' });
      });
    }
  }, [searchParams, setSearchParams, handleOAuthCallback]);

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
          Conecte suas contas para automatizar cobranças e pagamentos
        </p>
      </div>

      {/* Integration Cards */}
      <div className="grid gap-4 md:grid-cols-2">
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
          <li>• Você será redirecionado para o Mercado Pago para autorizar</li>
          <li>• Após autorizar, você poderá criar cobranças Pix e Links de pagamento</li>
          <li>• Os pagamentos vão diretamente para sua conta Mercado Pago</li>
        </ul>
      </div>
    </div>
  );
}
