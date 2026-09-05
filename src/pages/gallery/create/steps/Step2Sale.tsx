import { Ban, CreditCard, Receipt, Link2, Tag, Pencil, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { PaymentMethodSelector } from '@/components/PaymentMethodSelector';
import { cn } from '@/lib/utils';
import {
  SaleMode,
  PricingModel,
  ChargeType,
  DiscountPackage,
  PaymentMethod,
} from '@/types/gallery';
import {
  RegrasCongeladas,
  getModeloDisplayName,
  getFaixasFromRegras,
  formatFaixaDisplay,
  sanitizeExtraPrice,
} from '@/lib/pricingUtils';
import { Step2DiscountPackages } from './Step2DiscountPackages';

export interface Step2SaleProps {
  saleMode: SaleMode;
  setSaleMode: (v: SaleMode) => void;
  onSaleModeTouched?: () => void;
  paymentData: any;
  selectedPaymentMethod: PaymentMethod | null;
  setSelectedPaymentMethod: (m: PaymentMethod) => void;
  onPaymentMethodTouched?: () => void;
  regrasCongeladas: RegrasCongeladas | null;
  overridePricing: boolean;
  setOverridePricing: (v: boolean) => void;
  isLoadingRegras: boolean;
  pricingModel: PricingModel;
  setPricingModel: (v: PricingModel) => void;
  onPricingModelTouched?: () => void;
  fixedPrice: number;
  setFixedPrice: (v: number) => void;
  discountPackages: DiscountPackage[];
  setDiscountPackages: (packages: DiscountPackage[]) => void;
  addDiscountPackage: () => void;
  updateDiscountPackage: (id: string, field: keyof DiscountPackage, value: number | null) => void;
  removeDiscountPackage: (id: string) => void;
  isAssistedMode: boolean;
  settings: any;
  createDiscountPreset: any;
  updateDiscountPreset: any;
  deleteDiscountPreset: any;
  chargeType: ChargeType;
  setChargeType: (v: ChargeType) => void;
  onChargeTypeTouched?: () => void;
  includedPhotos: number;
}

export function Step2Sale({
  saleMode,
  setSaleMode,
  onSaleModeTouched,
  paymentData,
  selectedPaymentMethod,
  setSelectedPaymentMethod,
  onPaymentMethodTouched,
  regrasCongeladas,
  overridePricing,
  setOverridePricing,
  isLoadingRegras,
  pricingModel,
  setPricingModel,
  onPricingModelTouched,
  fixedPrice,
  setFixedPrice,
  discountPackages,
  setDiscountPackages,
  addDiscountPackage,
  updateDiscountPackage,
  removeDiscountPackage,
  isAssistedMode,
  settings,
  createDiscountPreset,
  updateDiscountPreset,
  deleteDiscountPreset,
  chargeType,
  setChargeType,
  onChargeTypeTouched,
  includedPhotos,
}: Step2SaleProps) {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <p className="text-muted-foreground text-lg">
          Defina como será a cobrança por fotos extras
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Block - Sale Mode */}
        <div className="space-y-4">
          <Label className="text-base font-medium">Configurar venda de fotos?</Label>
          <RadioGroup
            value={saleMode}
            onValueChange={(v) => {
              onSaleModeTouched?.();
              setSaleMode(v as SaleMode);
            }}
            className="flex flex-col gap-4"
          >
            {/* No Sale */}
            <div>
              <RadioGroupItem value="no_sale" id="sale-no" className="peer sr-only" />
              <Label
                htmlFor="sale-no"
                className={cn(
                  'flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all',
                  'hover:border-primary/50 hover:bg-muted/50',
                  saleMode === 'no_sale' ? 'border-primary bg-primary/5' : 'border-border'
                )}
              >
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                    saleMode === 'no_sale' ? 'bg-primary/20' : 'bg-muted'
                  )}
                >
                  <Ban
                    className={cn(
                      'h-5 w-5',
                      saleMode === 'no_sale' ? 'text-primary' : 'text-muted-foreground'
                    )}
                  />
                </div>
                <div>
                  <p className="font-medium">Não, sem venda</p>
                  <p className="text-xs text-muted-foreground">
                    O cliente não será informado sobre os preços das fotos
                  </p>
                </div>
              </Label>
            </div>

            {/* Sale with Payment */}
            <div>
              <RadioGroupItem value="sale_with_payment" id="sale-payment" className="peer sr-only" />
              <Label
                htmlFor="sale-payment"
                className={cn(
                  'flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all',
                  'hover:border-primary/50 hover:bg-muted/50',
                  saleMode === 'sale_with_payment' ? 'border-primary bg-primary/5' : 'border-border'
                )}
              >
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                    saleMode === 'sale_with_payment' ? 'bg-primary/20' : 'bg-muted'
                  )}
                >
                  <CreditCard
                    className={cn(
                      'h-5 w-5',
                      saleMode === 'sale_with_payment' ? 'text-primary' : 'text-muted-foreground'
                    )}
                  />
                </div>
                <div>
                  <p className="font-medium">Sim, COM pagamento</p>
                  <p className="text-xs text-muted-foreground">
                    O cliente será cobrado ao finalizar a seleção
                  </p>
                </div>
              </Label>
            </div>

            {/* Sale without Payment */}
            <div>
              <RadioGroupItem
                value="sale_without_payment"
                id="sale-no-payment"
                className="peer sr-only"
              />
              <Label
                htmlFor="sale-no-payment"
                className={cn(
                  'flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all',
                  'hover:border-primary/50 hover:bg-muted/50',
                  saleMode === 'sale_without_payment'
                    ? 'border-primary bg-primary/5'
                    : 'border-border'
                )}
              >
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                    saleMode === 'sale_without_payment' ? 'bg-primary/20' : 'bg-muted'
                  )}
                >
                  <Receipt
                    className={cn(
                      'h-5 w-5',
                      saleMode === 'sale_without_payment' ? 'text-primary' : 'text-muted-foreground'
                    )}
                  />
                </div>
                <div>
                  <p className="font-medium">Sim, SEM pagamento</p>
                  <p className="text-xs text-muted-foreground">
                    O cliente será apenas informado sobre os preços
                  </p>
                </div>
              </Label>
            </div>
          </RadioGroup>

          {/* Payment Method Selection - Only when sale_with_payment */}
          {saleMode === 'sale_with_payment' && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <PaymentMethodSelector
                integrations={paymentData?.allActiveIntegrations || []}
                selectedMethod={selectedPaymentMethod}
                onSelect={(method) => {
                  onPaymentMethodTouched?.();
                  setSelectedPaymentMethod(method as PaymentMethod);
                }}
              />
            </div>
          )}
        </div>

        {/* Right Block - Pricing Configuration */}
        {saleMode !== 'no_sale' && (
          <div className="space-y-6">
            {regrasCongeladas && !overridePricing ? (
              <div className="space-y-4">
                {isLoadingRegras ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                ) : (
                  <>
                    <div className="p-4 rounded-lg bg-accent/20 border border-accent/50">
                      <div className="flex items-center gap-2 text-accent-foreground">
                        <Link2 className="h-5 w-5" />
                        <span className="font-medium">Preços sincronizados do Lunari Studio</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Os preços de fotos extras estão configurados na sessão original.
                      </p>
                    </div>

                    <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
                      <h4 className="font-medium">Configuração de Preços</h4>

                      <div className="flex items-center gap-2 text-sm">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        <span>
                          Modelo:{' '}
                          {getModeloDisplayName(
                            regrasCongeladas.precificacaoFotoExtra?.modelo || 'fixo'
                          )}
                        </span>
                      </div>

                      {regrasCongeladas.precificacaoFotoExtra?.modelo !== 'fixo' &&
                        getFaixasFromRegras(regrasCongeladas).length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-border/50">
                            <Label className="text-xs text-muted-foreground">
                              Faixas de desconto:
                            </Label>
                            <div className="grid gap-1">
                              {getFaixasFromRegras(regrasCongeladas).map((faixa, idx) => (
                                <div
                                  key={idx}
                                  className="flex justify-between text-sm py-1 px-2 rounded bg-background/50"
                                >
                                  <span className="text-muted-foreground">
                                    {formatFaixaDisplay(faixa)}
                                  </span>
                                  <span className="font-medium">R$ {faixa.valor.toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                      {(regrasCongeladas.precificacaoFotoExtra?.modelo === 'fixo' ||
                        getFaixasFromRegras(regrasCongeladas).length === 0) && (
                        <div className="flex justify-between text-sm pt-2 border-t border-border/50">
                          <span className="text-muted-foreground">Preço por foto extra:</span>
                          <span className="font-medium">
                            R$ {(regrasCongeladas.pacote?.valorFotoExtra || 0).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                {regrasCongeladas && overridePricing && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                    <div className="flex items-center gap-2">
                      <Pencil className="h-4 w-4 text-destructive" />
                      <span className="text-sm font-medium text-destructive">
                        Modo personalizado ativo
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setOverridePricing(false)}
                      className="text-muted-foreground h-7"
                    >
                      Reverter para Lunari Studio
                    </Button>
                  </div>
                )}

                <div className="space-y-4">
                  <Label className="text-base font-medium">Qual formato de preço?</Label>
                  <RadioGroup
                    value={pricingModel}
                    onValueChange={(v) => {
                      onPricingModelTouched?.();
                      setPricingModel(v as PricingModel);
                    }}
                    className="flex flex-col gap-3"
                  >
                    <div>
                      <RadioGroupItem value="fixed" id="pricing-fixed" className="peer sr-only" />
                      <Label
                        htmlFor="pricing-fixed"
                        className={cn(
                          'flex flex-col gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
                          'hover:border-primary/50 hover:bg-muted/50',
                          pricingModel === 'fixed' ? 'border-primary bg-primary/5' : 'border-border'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'w-8 h-8 rounded-full flex items-center justify-center',
                              pricingModel === 'fixed' ? 'bg-primary/20' : 'bg-muted'
                            )}
                          >
                            <Tag
                              className={cn(
                                'h-4 w-4',
                                pricingModel === 'fixed' ? 'text-primary' : 'text-muted-foreground'
                              )}
                            />
                          </div>
                          <div>
                            <p className="font-medium">Preço único por foto</p>
                            <p className="text-xs text-muted-foreground">
                              Defina um valor fixo para cada foto
                            </p>
                          </div>
                        </div>

                        {pricingModel === 'fixed' && (
                          <div className="pt-3 border-t border-border/50">
                            <Label htmlFor="fixedPrice" className="text-sm">
                              Valor por foto (R$)
                            </Label>
                            <Input
                              id="fixedPrice"
                              type="number"
                              min={0}
                              max={999.99}
                              step={0.01}
                              value={fixedPrice || ''}
                              onChange={(e) =>
                                setFixedPrice(
                                  e.target.value === '' ? 0 : parseFloat(e.target.value) || 0
                                )
                              }
                              onBlur={(e) => {
                                const sanitized = sanitizeExtraPrice(e.target.value);
                                if (sanitized !== fixedPrice) setFixedPrice(sanitized);
                              }}
                              className="mt-2"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        )}
                      </Label>
                    </div>

                    <div>
                      <RadioGroupItem
                        value="packages"
                        id="pricing-packages"
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor="pricing-packages"
                        className={cn(
                          'flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all relative',
                          'hover:border-primary/50 hover:bg-muted/50',
                          pricingModel === 'packages'
                            ? 'border-primary bg-primary/5'
                            : 'border-border'
                        )}
                      >
                        <div
                          className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center',
                            pricingModel === 'packages' ? 'bg-primary/20' : 'bg-muted'
                          )}
                        >
                          <Package
                            className={cn(
                              'h-4 w-4',
                              pricingModel === 'packages' ? 'text-primary' : 'text-muted-foreground'
                            )}
                          />
                        </div>
                        <div>
                          <p className="font-medium">Pacotes com descontos</p>
                          <p className="text-xs text-muted-foreground">
                            Descontos progressivos por quantidade
                          </p>
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </>
            )}

            {/* Discount Packages Configuration */}
            {pricingModel === 'packages' &&
              (!isAssistedMode || !regrasCongeladas || overridePricing) && (
                <Step2DiscountPackages
                  discountPackages={discountPackages}
                  setDiscountPackages={setDiscountPackages}
                  addDiscountPackage={addDiscountPackage}
                  updateDiscountPackage={updateDiscountPackage}
                  removeDiscountPackage={removeDiscountPackage}
                  settings={settings}
                  createDiscountPreset={createDiscountPreset}
                  updateDiscountPreset={updateDiscountPreset}
                  deleteDiscountPreset={deleteDiscountPreset}
                />
              )}

            {/* Charge Type */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Tipo de cobrança</Label>
              <Select
                value={chargeType}
                onValueChange={(v) => {
                  onChargeTypeTouched?.();
                  setChargeType(v as ChargeType);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="only_extras">Cobrar apenas as fotos extras</SelectItem>
                  <SelectItem value="all_selected">Cobrar todas as fotos selecionadas</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {chargeType === 'only_extras'
                  ? `Fotos até o limite do pacote (${includedPhotos}) são gratuitas.`
                  : `Todas as fotos selecionadas serão cobradas.`}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
