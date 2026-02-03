import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ProviderRow, ProviderOption, SelectedProvider } from './ProviderRow';
import { Loader2, AlertCircle } from 'lucide-react';
import pixLogo from '@/assets/pix-logo.png';
import infinitepayLogo from '@/assets/infinitepay-logo.png';
import mercadopagoLogo from '@/assets/mercadopago-logo.png';

interface ProviderSelectorProps {
  selectedProvider: SelectedProvider | null;
  onSelect: (provider: SelectedProvider) => void;
}

interface IntegrationData {
  provedor: string;
  status: string;
  dados_extras: Record<string, unknown>;
}

export function ProviderSelector({ selectedProvider, onSelect }: ProviderSelectorProps) {
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProviders = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setProviders([]);
        setLoading(false);
        return;
      }

      const { data: integracoes, error } = await supabase
        .from('usuarios_integracoes')
        .select('provedor, status, dados_extras')
        .eq('user_id', user.id)
        .eq('status', 'ativo');

      if (error) {
        console.error('[ProviderSelector] Error loading integrations:', error);
        setProviders([]);
        setLoading(false);
        return;
      }

      const available: ProviderOption[] = [];
      const integrationData = (integracoes || []) as IntegrationData[];

      // Check for Mercado Pago
      const mercadoPago = integrationData.find(i => i.provedor === 'mercadopago');
      if (mercadoPago) {
        const settings = mercadoPago.dados_extras || {};
        const isDefault = settings.is_default === true;
        const habilitarPix = settings.habilitarPix !== false;
        const habilitarCartao = settings.habilitarCartao !== false;
        const maxParcelas = (settings.maxParcelas as number) || 12;

        // Add PIX option if enabled
        if (habilitarPix) {
          available.push({
            id: 'pix_mercadopago',
            name: 'PIX',
            description: 'Confirmação automática',
            logo: pixLogo,
            isDefault: isDefault && !habilitarCartao, // Only default if no card enabled
            provedor: 'mercadopago',
          });
        }

        // Add Link option (shows both PIX and card when available)
        const cardDescription = habilitarCartao && habilitarPix
          ? `Pix + Cartão até ${maxParcelas}x`
          : habilitarCartao
            ? `Cartão até ${maxParcelas}x`
            : 'Pix';

        available.push({
          id: 'mercadopago_link',
          name: 'Mercado Pago',
          description: cardDescription,
          logo: mercadopagoLogo,
          isDefault,
          provedor: 'mercadopago',
        });
      }

      // Check for InfinitePay
      const infinitePay = integrationData.find(i => i.provedor === 'infinitepay');
      if (infinitePay) {
        const isDefault = infinitePay.dados_extras?.is_default === true;
        available.push({
          id: 'infinitepay',
          name: 'InfinitePay',
          description: 'Pix + Cartão',
          logo: infinitepayLogo,
          isDefault,
          provedor: 'infinitepay',
        });
      }

      // Check for PIX Manual
      const pixManual = integrationData.find(i => i.provedor === 'pix_manual');
      if (pixManual) {
        const isDefault = pixManual.dados_extras?.is_default === true;
        available.push({
          id: 'pix_manual',
          name: 'PIX Manual',
          description: 'Confirmação manual',
          logo: pixLogo,
          isDefault,
          provedor: 'pix_manual',
        });
      }

      setProviders(available);

      // Auto-select default provider if nothing selected
      if (!selectedProvider && available.length > 0) {
        const defaultProvider = available.find(p => p.isDefault) || available[0];
        onSelect(defaultProvider.id);
      }
    } catch (error) {
      console.error('[ProviderSelector] Error:', error);
      setProviders([]);
    } finally {
      setLoading(false);
    }
  }, [selectedProvider, onSelect]);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Carregando meios de pagamento...</span>
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3 text-muted-foreground">
        <AlertCircle className="h-10 w-10 text-muted-foreground/50" />
        <div className="text-center">
          <p className="text-sm font-medium">Nenhum meio de pagamento configurado</p>
          <p className="text-xs mt-1">
            Vá em Configurações &gt; Integrações para conectar um provedor de pagamento.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {providers.map(provider => (
        <ProviderRow
          key={provider.id}
          provider={provider}
          selected={selectedProvider === provider.id}
          onClick={() => onSelect(provider.id)}
        />
      ))}
    </div>
  );
}
