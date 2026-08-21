import { useState, useMemo } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Globe, Layers, FileText, CreditCard, Image as ImageIcon, CheckCircle2, Info } from 'lucide-react';
import { LogoCard } from './LogoCard';
import { UserProfile } from '@/services/ProfileService';
import { GlobalSettings } from '@/types/gallery';
import { gestaoR2Upload } from '@/lib/gestaoR2Upload';
import { toast } from 'sonner';

export interface VisualIdentitySectionProps {
  profile: UserProfile | null;
  gallerySettings: GlobalSettings | null;
  onMasterLogoUpload: (file: File) => Promise<void>;
  onMasterLogoRemove: () => Promise<void>;
  onUpdateGallerySettings: (settings: Partial<GlobalSettings>, options?: { successMessage?: string }) => void | Promise<any>;
}

export function VisualIdentitySection({
  profile,
  gallerySettings,
  onMasterLogoUpload,
  onMasterLogoRemove,
  onUpdateGallerySettings,
}: VisualIdentitySectionProps) {
  const masterLogoUrl = profile?.logo_url || null;
  const galleryLogoUrl = gallerySettings?.studioLogo || null;
  const faviconUrl = gallerySettings?.faviconUrl || null;

  // Extrai o billing_logo_url do themeOverrides do gallery_settings
  const themeOverrides = (gallerySettings?.themeOverrides as Record<string, any>) || {};
  const billingLogoUrl = (themeOverrides.billing_logo_url || themeOverrides.billingLogoUrl || null) as string | null;

  // Determina se há personalização ativa por canal
  const hasSpecificChannelLogos = useMemo(() => {
    const hasDiffGallery = Boolean(galleryLogoUrl && galleryLogoUrl !== masterLogoUrl);
    const hasDiffBilling = Boolean(billingLogoUrl && billingLogoUrl !== masterLogoUrl);
    return hasDiffGallery || hasDiffBilling;
  }, [galleryLogoUrl, billingLogoUrl, masterLogoUrl]);

  const [useUnifiedLogo, setUseUnifiedLogo] = useState<boolean>(() => !hasSpecificChannelLogos);

  // Upload específico para Galeria
  const handleGalleryLogoUpload = async (file: File) => {
    try {
      const res = await gestaoR2Upload({ file, context: 'logo' });
      if (!res?.url) throw new Error('Falha ao obter URL da imagem');
      
      await onUpdateGallerySettings(
        { studioLogo: res.url },
        { successMessage: 'Logotipo das galerias atualizado com sucesso!' }
      );
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao enviar logotipo da galeria');
      throw err;
    }
  };

  const handleGalleryLogoRemove = async () => {
    try {
      await onUpdateGallerySettings(
        { studioLogo: undefined },
        { successMessage: 'Logotipo específico da galeria removido (herdando logotipo principal).' }
      );
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao remover logotipo');
      throw err;
    }
  };

  // Upload específico para Cobrança / Checkout
  const handleBillingLogoUpload = async (file: File) => {
    try {
      const res = await gestaoR2Upload({ file, context: 'logo' });
      if (!res?.url) throw new Error('Falha ao obter URL da imagem');

      const currentOverrides = (gallerySettings?.themeOverrides as Record<string, any>) || {};
      const newOverrides = {
        ...currentOverrides,
        billing_logo_url: res.url,
        billingLogoUrl: res.url,
      };

      await onUpdateGallerySettings(
        { themeOverrides: newOverrides },
        { successMessage: 'Logotipo das páginas de cobrança atualizado com sucesso!' }
      );
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao enviar logotipo de cobrança');
      throw err;
    }
  };

  const handleBillingLogoRemove = async () => {
    try {
      const currentOverrides = (gallerySettings?.themeOverrides as Record<string, any>) || {};
      const newOverrides = { ...currentOverrides };
      delete newOverrides.billing_logo_url;
      delete newOverrides.billingLogoUrl;

      await onUpdateGallerySettings(
        { themeOverrides: newOverrides },
        { successMessage: 'Logotipo específico de cobrança removido (herdando logotipo principal).' }
      );
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao remover logotipo de cobrança');
      throw err;
    }
  };

  // Upload de Favicon
  const handleFaviconUpload = async (file: File) => {
    try {
      const res = await gestaoR2Upload({ file, context: 'logo' });
      if (!res?.url) throw new Error('Falha ao obter URL do favicon');

      await onUpdateGallerySettings(
        { faviconUrl: res.url },
        { successMessage: 'Favicon atualizado com sucesso!' }
      );
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao enviar favicon');
      throw err;
    }
  };

  const handleFaviconRemove = async () => {
    try {
      await onUpdateGallerySettings(
        { faviconUrl: undefined },
        { successMessage: 'Favicon removido.' }
      );
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao remover favicon');
      throw err;
    }
  };

  const handleToggleUnified = (checked: boolean) => {
    setUseUnifiedLogo(checked);
    if (checked) {
      toast.info('Modo unificado ativado. O logotipo principal será aplicado em todos os canais.');
    } else {
      toast.info('Modo personalizado ativado. Agora você pode configurar um logotipo para cada canal.');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Bloco de Controle do Modo de Aplicação */}
      <div className="p-5 sm:p-6 rounded-2xl border border-border/60 bg-card/40 backdrop-blur-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-base font-semibold text-foreground">Distribuição da Identidade Visual</h3>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Escolha se deseja utilizar a mesma logomarca em todo o sistema ou personalizar por canal
            </p>
          </div>

          <div className="flex items-center gap-3 bg-muted/40 px-3.5 py-2 rounded-xl border border-border/50 self-start sm:self-auto">
            <Label htmlFor="unified-logo-switch" className="text-xs font-medium text-foreground cursor-pointer select-none">
              Usar mesma logomarca para tudo
            </Label>
            <Switch
              id="unified-logo-switch"
              checked={useUnifiedLogo}
              onCheckedChange={handleToggleUnified}
            />
          </div>
        </div>

        {useUnifiedLogo ? (
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-primary/[0.06] border border-primary/20 text-xs text-muted-foreground">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-semibold text-foreground">Modo Unificado Ativo: </span>
              O logotipo principal enviado abaixo será replicado automaticamente nas suas <span className="text-foreground font-medium">Galerias de Clientes</span>, <span className="text-foreground font-medium">Páginas de Cobrança / Checkout</span>, <span className="text-foreground font-medium">Contratos & PDFs</span> e <span className="text-foreground font-medium">Previews de Links</span>.
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-muted/40 border border-border/50 text-xs text-muted-foreground">
            <Layers className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-semibold text-foreground">Modo Personalizado por Canal Ativo: </span>
              Você pode carregar versões adaptadas da sua marca para cada ambiente (ex: versão horizontal ou clara para galerias, compacta para cobrança e padrão para documentos).
            </div>
          </div>
        )}
      </div>

      {/* Grade de Logotipos */}
      <div className="space-y-6">
        {/* 1. Logotipo Principal / Geral */}
        <LogoCard
          title={useUnifiedLogo ? "Logotipo Principal (Master)" : "Logotipo Geral & Documentos (PDFs)"}
          description={
            useUnifiedLogo
              ? "Sua logomarca base aplicada em galerias, faturas, contratos, PDFs e compartilhamentos."
              : "Utilizado no sistema, propostas comerciais, contratos e exportação de demonstrativos em PDF."
          }
          icon={FileText}
          badge={useUnifiedLogo ? "Padrão de todo o sistema" : "Documentos & Sistema"}
          badgeVariant={useUnifiedLogo ? "default" : "secondary"}
          currentUrl={masterLogoUrl}
          dimensionsRecommendation="512x512px ou 1000x500px"
          formatRecommendation="PNG (fundo transparente), JPG ou WEBP"
          maxSizeRecommendation="Até 5MB"
          onUpload={onMasterLogoUpload}
          onRemove={onMasterLogoRemove}
        />

        {/* Informações de Canais Vinculados (apenas no modo unificado) */}
        {useUnifiedLogo && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl border border-border/50 bg-card/30 space-y-2">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-foreground">Galerias de Clientes</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Exibido no topo e na capa das galerias de seleção e entrega enviadas aos clientes.
              </p>
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium pt-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Sincronizado com Principal</span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-border/50 bg-card/30 space-y-2">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-foreground">Páginas de Cobrança</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Exibido no topo da tela de pagamento PIX/Cartão e nos links de faturas.
              </p>
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium pt-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Sincronizado com Principal</span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-border/50 bg-card/30 space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-foreground">Contratos & PDFs</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Cabeçalho de contratos assinados, demonstrativos financeiros e propostas comerciais.
              </p>
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium pt-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Sincronizado com Principal</span>
              </div>
            </div>
          </div>
        )}

        {/* 2. Logotipo das Galerias de Fotos (Exibido no modo personalizado) */}
        {!useUnifiedLogo && (
          <LogoCard
            title="Logotipo das Galerias de Fotos"
            description="Exibido no cabeçalho e na capa das galerias de seleção e entrega de fotos dos clientes."
            icon={ImageIcon}
            badge="Galerias de Clientes"
            currentUrl={galleryLogoUrl}
            fallbackUrl={masterLogoUrl}
            isInherited={!galleryLogoUrl}
            inheritedLabel="Usando logotipo principal"
            dimensionsRecommendation="Proporção horizontal 3:1 ou 4:1 (ex: 600x150px)"
            formatRecommendation="PNG com fundo transparente (versão clara/branca recomendada)"
            maxSizeRecommendation="Até 5MB"
            onUpload={handleGalleryLogoUpload}
            onRemove={handleGalleryLogoRemove}
          />
        )}

        {/* 3. Logotipo de Cobrança & Checkout (Exibido no modo personalizado) */}
        {!useUnifiedLogo && (
          <LogoCard
            title="Logotipo de Cobrança & Checkout"
            description="Exibido no topo da tela de pagamento PIX e Cartão e nos links de faturas enviados aos clientes."
            icon={CreditCard}
            badge="Links de Pagamento & Checkout"
            currentUrl={billingLogoUrl}
            fallbackUrl={masterLogoUrl}
            isInherited={!billingLogoUrl}
            inheritedLabel="Usando logotipo principal"
            dimensionsRecommendation="Proporção horizontal 3:1 ou 4:1 (ex: 400x100px)"
            formatRecommendation="PNG com fundo transparente ou JPG"
            maxSizeRecommendation="Até 5MB"
            onUpload={handleBillingLogoUpload}
            onRemove={handleBillingLogoRemove}
          />
        )}

        {/* 4. Favicon das Galerias (Sempre configurável) */}
        <LogoCard
          title="Favicon das Galerias"
          description="Ícone exibido na aba do navegador dos seus clientes quando eles acessam as galerias de fotos."
          icon={Globe}
          badge="Aba do Navegador"
          currentUrl={faviconUrl}
          dimensionsRecommendation="Quadrado 32x32px ou 64x64px"
          formatRecommendation="PNG, ICO ou WEBP"
          maxSizeRecommendation="Até 2MB"
          onUpload={handleFaviconUpload}
          onRemove={handleFaviconRemove}
        />
      </div>
    </div>
  );
}
