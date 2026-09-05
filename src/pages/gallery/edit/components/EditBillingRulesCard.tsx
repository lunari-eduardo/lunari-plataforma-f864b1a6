import { DollarSign, Lock, Sparkles, Tag, ChevronDown, Package } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { PricingModelEditor } from '@/components/gallery/PricingModelEditor';
import { cn } from '@/lib/utils';
import { DiscountPackage } from '@/types/gallery';
import { BillingMode } from '../types';

export interface EditBillingRulesCardProps {
  isBillingLocked: boolean;
  isLunariLinked: boolean;
  billingMode: BillingMode;
  handleBillingModeChange: (mode: BillingMode) => void;
  fotosIncluidas: number;
  setFotosIncluidas: (n: number) => void;
  valorFotoExtra: number;
  setValorFotoExtra: (v: number) => void;
  setPricingDirty: (dirty: boolean) => void;
  fotosIncluidasAbaixoDoMinimo: boolean;
  minFotosIncluidasPermitido: number;
  discountPackages: DiscountPackage[];
  setDiscountPackages: (pkgs: DiscountPackage[]) => void;
  regrasOverride: boolean;
  setRestoreDialogOpen: (open: boolean) => void;
}

export function EditBillingRulesCard({
  isBillingLocked,
  isLunariLinked,
  billingMode,
  handleBillingModeChange,
  fotosIncluidas,
  setFotosIncluidas,
  valorFotoExtra,
  setValorFotoExtra,
  setPricingDirty,
  fotosIncluidasAbaixoDoMinimo,
  minFotosIncluidasPermitido,
  discountPackages,
  setDiscountPackages,
  regrasOverride,
  setRestoreDialogOpen,
}: EditBillingRulesCardProps) {
  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Regras de Cobrança
        </CardTitle>
        <CardDescription>
          Como esta galeria calcula fotos incluídas e extras
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isBillingLocked && (
          <div className="glass rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex gap-3">
            <Lock className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm">
              <p className="font-medium text-foreground">Galeria concluída</p>
              <p className="text-muted-foreground">
                Os parâmetros de cobrança estão bloqueados para preservar o histórico de pagamentos.
                Para alterá-los,{' '}
                <span className="font-medium text-foreground">reative a seleção</span> pelo botão
                "Reativar".
              </p>
            </div>
          </div>
        )}

        {/* Modo Studio (recomendado) */}
        {isLunariLinked && (
          <button
            type="button"
            onClick={() => handleBillingModeChange('studio')}
            disabled={isBillingLocked || billingMode === 'studio'}
            className={cn(
              'w-full text-left rounded-xl border-2 p-4 transition-all',
              'hover:border-primary/50',
              billingMode === 'studio'
                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                : 'border-primary/30 bg-primary/[0.03]',
              isBillingLocked && 'opacity-60 pointer-events-none'
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
                  billingMode === 'studio' ? 'bg-primary/20' : 'bg-primary/10'
                )}
              >
                <Sparkles
                  className={cn(
                    'h-4 w-4',
                    billingMode === 'studio' ? 'text-primary' : 'text-primary/70'
                  )}
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">Usar regras do Lunari Studio</p>
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                    Recomendado
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Esta galeria utiliza automaticamente as regras da sessão original: fotos
                  incluídas, valor extra e tabela progressiva. Se você criar regras personalizadas
                  abaixo, elas passarão a valer apenas nesta galeria — a sessão do cliente no Lunari
                  Studio não é alterada. Você pode voltar ao modo sincronizado a qualquer momento.
                </p>
              </div>
            </div>
          </button>
        )}

        {/* Modo: Preço único (colapsável) */}
        <Collapsible open={billingMode === 'fixed'}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              onClick={() => handleBillingModeChange('fixed')}
              disabled={isBillingLocked}
              className={cn(
                'w-full text-left rounded-xl border-2 p-4 transition-all group',
                'hover:border-primary/50',
                billingMode === 'fixed'
                  ? 'border-primary bg-primary/[0.04]'
                  : 'border-border bg-card',
                isBillingLocked && 'opacity-60 pointer-events-none'
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
                    billingMode === 'fixed' ? 'bg-primary/20' : 'bg-muted'
                  )}
                >
                  <Tag
                    className={cn(
                      'h-4 w-4',
                      billingMode === 'fixed' ? 'text-primary' : 'text-muted-foreground'
                    )}
                  />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Preço único por foto</p>
                  <p className="text-xs text-muted-foreground">Um valor fixo por foto extra</p>
                </div>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 text-muted-foreground transition-transform',
                    billingMode === 'fixed' && 'rotate-180'
                  )}
                />
              </div>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 pl-1 pr-1">
            <div className="grid gap-4 md:grid-cols-2 rounded-lg border border-border/50 bg-muted/20 p-4">
              <div className="space-y-2">
                <Label htmlFor="fotosIncluidasFixed">Fotos Incluídas</Label>
                <Input
                  id="fotosIncluidasFixed"
                  type="number"
                  min="0"
                  value={fotosIncluidas || ''}
                  onChange={(e) => {
                    setFotosIncluidas(
                      e.target.value === '' ? 0 : parseInt(e.target.value) || 0
                    );
                    setPricingDirty(true);
                  }}
                  disabled={isBillingLocked}
                  aria-invalid={fotosIncluidasAbaixoDoMinimo}
                />
                {fotosIncluidasAbaixoDoMinimo && (
                  <p className="text-xs text-destructive">
                    Mínimo permitido: <span className="font-medium">{minFotosIncluidasPermitido}</span>{' '}
                    — existem fotos extras já pagas.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="valorFotoExtraFixed">Valor por foto (R$)</Label>
                <Input
                  id="valorFotoExtraFixed"
                  type="number"
                  min="0"
                  step="0.01"
                  value={valorFotoExtra || ''}
                  onChange={(e) => {
                    setValorFotoExtra(
                      e.target.value === '' ? 0 : parseFloat(e.target.value) || 0
                    );
                    setPricingDirty(true);
                  }}
                  disabled={isBillingLocked}
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Modo: Pacotes com descontos (colapsável) */}
        <Collapsible open={billingMode === 'packages'}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              onClick={() => handleBillingModeChange('packages')}
              disabled={isBillingLocked}
              className={cn(
                'w-full text-left rounded-xl border-2 p-4 transition-all',
                'hover:border-primary/50',
                billingMode === 'packages'
                  ? 'border-primary bg-primary/[0.04]'
                  : 'border-border bg-card',
                isBillingLocked && 'opacity-60 pointer-events-none'
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
                    billingMode === 'packages' ? 'bg-primary/20' : 'bg-muted'
                  )}
                >
                  <Package
                    className={cn(
                      'h-4 w-4',
                      billingMode === 'packages' ? 'text-primary' : 'text-muted-foreground'
                    )}
                  />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Desconto progressivo personalizado</p>
                  <p className="text-xs text-muted-foreground">
                    Preço diferente por faixa de quantidade
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 text-muted-foreground transition-transform',
                    billingMode === 'packages' && 'rotate-180'
                  )}
                />
              </div>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 pl-1 pr-1 space-y-4">
            <div className="grid gap-4 md:grid-cols-2 rounded-lg border border-border/50 bg-muted/20 p-4">
              <div className="space-y-2">
                <Label htmlFor="fotosIncluidasPkg">Fotos Incluídas</Label>
                <Input
                  id="fotosIncluidasPkg"
                  type="number"
                  min="0"
                  value={fotosIncluidas || ''}
                  onChange={(e) => {
                    setFotosIncluidas(
                      e.target.value === '' ? 0 : parseInt(e.target.value) || 0
                    );
                    setPricingDirty(true);
                  }}
                  disabled={isBillingLocked}
                  aria-invalid={fotosIncluidasAbaixoDoMinimo}
                />
                {fotosIncluidasAbaixoDoMinimo && (
                  <p className="text-xs text-destructive">
                    Mínimo permitido: <span className="font-medium">{minFotosIncluidasPermitido}</span>.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="valorFotoExtraPkg">Valor base da foto extra (R$)</Label>
                <Input
                  id="valorFotoExtraPkg"
                  type="number"
                  min="0"
                  step="0.01"
                  value={valorFotoExtra || ''}
                  onChange={(e) => {
                    setValorFotoExtra(
                      e.target.value === '' ? 0 : parseFloat(e.target.value) || 0
                    );
                    setPricingDirty(true);
                  }}
                  disabled={isBillingLocked}
                />
              </div>
            </div>

            <PricingModelEditor
              pricingModel="packages"
              onPricingModelChange={() => {}}
              fixedPrice={valorFotoExtra}
              onFixedPriceChange={(v) => {
                setValorFotoExtra(v);
                setPricingDirty(true);
              }}
              discountPackages={discountPackages}
              onDiscountPackagesChange={(pkgs) => {
                setDiscountPackages(pkgs);
                setPricingDirty(true);
              }}
              disabled={isBillingLocked}
              hideModeSelector
            />
          </CollapsibleContent>
        </Collapsible>

        {/* Aviso de override ativo */}
        {isLunariLinked && !isBillingLocked && billingMode !== 'studio' && regrasOverride && (
          <p className="text-xs text-muted-foreground pl-1">
            Regras personalizadas ativas para esta galeria.{' '}
            <button
              type="button"
              className="underline hover:text-foreground"
              onClick={() => setRestoreDialogOpen(true)}
            >
              Voltar ao modo sincronizado
            </button>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
