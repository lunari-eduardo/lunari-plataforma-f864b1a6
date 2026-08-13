import { Tag, Receipt, Package } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { GlobalSettings, SaleMode, ChargeType, PricingModel } from '@/types/gallery';
import { UpdateSettingsOptions } from '@/hooks/useGallerySettings';

interface DefaultsSalesTabProps {
  settings: GlobalSettings;
  updateSettings: (data: Partial<GlobalSettings>, options?: UpdateSettingsOptions) => void;
}

export function DefaultsSalesTab({ settings, updateSettings }: DefaultsSalesTabProps) {
  return (
    <div className="space-y-6">
      {/* Default Sale Mode */}
      <div className="lunari-card p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Tag className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-medium">Modo de Venda Padrão</h2>
            <p className="text-sm text-muted-foreground">
              Aplicado automaticamente em novas galerias
            </p>
          </div>
        </div>

        <RadioGroup
          value={settings.defaultSaleMode || 'no_sale'}
          onValueChange={(v) => updateSettings({ defaultSaleMode: v as SaleMode }, { successMessage: 'Modo de venda salvo.' })}
          className="space-y-3"
        >
          <div className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="no_sale" id="sale-no" className="mt-0.5" />
            <Label htmlFor="sale-no" className="flex-1 cursor-pointer">
              <p className="font-medium">Não, sem venda</p>
              <p className="text-sm text-muted-foreground">
                Cliente não vê preços nem pode comprar fotos extras
              </p>
            </Label>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="sale_with_payment" id="sale-with" className="mt-0.5" />
            <Label htmlFor="sale-with" className="flex-1 cursor-pointer">
              <p className="font-medium">Sim, COM pagamento</p>
              <p className="text-sm text-muted-foreground">
                Cliente é cobrado ao finalizar a seleção
              </p>
            </Label>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="sale_without_payment" id="sale-without" className="mt-0.5" />
            <Label htmlFor="sale-without" className="flex-1 cursor-pointer">
              <p className="font-medium">Sim, SEM pagamento</p>
              <p className="text-sm text-muted-foreground">
                Cliente vê os preços, mas o pagamento é tratado fora da plataforma
              </p>
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Default Charge Type */}
      <div className="lunari-card p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Receipt className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-medium">Tipo de Cobrança Padrão</h2>
            <p className="text-sm text-muted-foreground">
              Aplicado quando há venda ativa em novas galerias
            </p>
          </div>
        </div>

        <RadioGroup
          value={settings.defaultChargeType ?? 'only_extras'}
          onValueChange={(v) => updateSettings({ defaultChargeType: v as ChargeType }, { successMessage: 'Tipo de cobrança salvo.' })}
          className="space-y-3"
        >
          <div className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="only_extras" id="charge-extras" className="mt-0.5" />
            <Label htmlFor="charge-extras" className="flex-1 cursor-pointer">
              <p className="font-medium">Cobrar apenas as fotos extras</p>
              <p className="text-sm text-muted-foreground">
                As fotos incluídas no pacote são gratuitas
              </p>
            </Label>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="all_selected" id="charge-all" className="mt-0.5" />
            <Label htmlFor="charge-all" className="flex-1 cursor-pointer">
              <p className="font-medium">Cobrar todas as fotos selecionadas</p>
              <p className="text-sm text-muted-foreground">
                Todas as fotos selecionadas pelo cliente serão cobradas
              </p>
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Default Pricing Model */}
      <div className="lunari-card p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-medium">Modelo de Preços Padrão</h2>
            <p className="text-sm text-muted-foreground">
              Como as fotos extras serão precificadas em novas galerias
            </p>
          </div>
        </div>

        <RadioGroup
          value={settings.defaultPricingModel ?? 'fixed'}
          onValueChange={(v) => updateSettings({ defaultPricingModel: v as PricingModel }, { successMessage: 'Modelo de preços salvo.' })}
          className="space-y-3"
        >
          <div className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="fixed" id="pricing-fixed" className="mt-0.5" />
            <Label htmlFor="pricing-fixed" className="flex-1 cursor-pointer">
              <p className="font-medium">Preço único</p>
              <p className="text-sm text-muted-foreground">
                Mesmo valor por foto extra independentemente da quantidade
              </p>
            </Label>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="packages" id="pricing-packages" className="mt-0.5" />
            <Label htmlFor="pricing-packages" className="flex-1 cursor-pointer">
              <p className="font-medium">Pacotes com desconto</p>
              <p className="text-sm text-muted-foreground">
                Faixas progressivas de preço por quantidade
              </p>
            </Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}
