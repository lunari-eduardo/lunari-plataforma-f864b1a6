import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ProviderOption, SelectedProvider } from './ProviderRow';
import { Loader2, AlertCircle, Star } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import pixLogo from '@/assets/pix-logo.png';
import infinitepayLogo from '@/assets/infinitepay-logo.png';
import mercadopagoLogo from '@/assets/mercadopago-logo.png';
import asaasLogo from '@/assets/asaas-logo.png';

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

        const methods: string[] = [];
        if (habilitarPix) methods.push('Pix');
        if (habilitarCartao) methods.push(`Cartão até ${maxParcelas}x`);
        const description = methods.join(' + ') || 'Checkout';

        available.push({
          id: 'mercadopago_link',
          name: 'Mercado Pago',
          description,
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

      // Check for Asaas
      const asaas = integrationData.find(i => i.provedor === 'asaas');
      if (asaas) {
        const settings = asaas.dados_extras || {};
        const isDefault = settings.is_default === true;
        const methods: string[] = [];
        if (settings.habilitarPix !== false) methods.push('Pix');
        if (settings.habilitarCartao !== false) methods.push('Cartão');
        if (settings.habilitarBoleto === true) methods.push('Boleto');

        available.push({
          id: 'asaas',
          name: 'Asaas',
          description: methods.join(' + ') || 'Checkout transparente',
          logo: asaasLogo,
          isDefault,
          provedor: 'asaas',
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
      <div className="flex items-center justify-center py-4 gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Carregando...</span>
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-4 gap-2 text-muted-foreground">
        <AlertCircle className="h-6 w-6 text-muted-foreground/50" />
        <div className="text-center">
          <p className="text-sm font-medium">Nenhum meio de pagamento configurado</p>
          <p className="text-xs mt-1">
            Vá em Configurações &gt; Integrações para conectar um provedor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Select value={selectedProvider || undefined} onValueChange={(v) => onSelect(v as SelectedProvider)}>
      <SelectTrigger className="h-10 text-sm">
        <SelectValue placeholder="Selecione o meio de cobrança">
          {selectedProvider && (() => {
            const p = providers.find(pr => pr.id === selectedProvider);
            if (!p) return null;
            return (
              <div className="flex items-center gap-2">
                <img src={p.logo} alt={p.name} className="w-5 h-5 object-contain" />
                <span className="font-medium">{p.name}</span>
                <span className="text-muted-foreground text-xs">— {p.description}</span>
                {p.isDefault && <Star className="h-3 w-3 text-amber-500 fill-amber-500" />}
              </div>
            );
          })()}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {providers.map(provider => (
          <SelectItem key={provider.id} value={provider.id}>
            <div className="flex items-center gap-2">
              <img src={provider.logo} alt={provider.name} className="w-5 h-5 object-contain" />
              <span className="font-medium">{provider.name}</span>
              <span className="text-muted-foreground text-xs">— {provider.description}</span>
              {provider.isDefault && <Star className="h-3 w-3 text-amber-500 fill-amber-500" />}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
