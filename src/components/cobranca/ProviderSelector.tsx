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
  is_default: boolean;
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
        .select('provedor, status, dados_extras, is_default')
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
        const isDefault = mercadoPago.is_default === true;
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
        const isDefault = infinitePay.is_default === true;
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
        const isDefault = pixManual.is_default === true;
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
        const isDefault = asaas.is_default === true;
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
      <SelectTrigger className="h-14 w-full bg-card/50 border-border/60 hover:bg-muted/20 transition-colors px-3 rounded-xl focus:ring-1 focus:ring-primary/30">
        <SelectValue placeholder="Selecione o meio de cobrança">
          {selectedProvider && (() => {
            const p = providers.find(pr => pr.id === selectedProvider);
            if (!p) return null;
            return (
              <div className="flex items-center gap-3 w-full text-left">
                <div className="h-8 w-8 rounded-full bg-background border border-border/50 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                  <img src={p.logo} alt={p.name} className="w-5 h-5 object-contain" />
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">{p.name}</span>
                    {p.isDefault && (
                      <span className="bg-accent-gold/15 text-accent-gold border border-accent-gold/30 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0">
                        Padrão
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground truncate leading-tight">
                    {p.description}
                  </span>
                </div>
              </div>
            );
          })()}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="rounded-xl border-border/60">
        {providers.map(provider => (
          <SelectItem key={provider.id} value={provider.id} className="py-2.5 px-3 rounded-lg my-0.5 cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-background border border-border/50 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                <img src={provider.logo} alt={provider.name} className="w-5 h-5 object-contain" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-foreground">{provider.name}</span>
                  {provider.isDefault && (
                    <span className="bg-accent-gold/15 text-accent-gold border border-accent-gold/30 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded">
                      Padrão
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground leading-tight">
                  {provider.description}
                </span>
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
