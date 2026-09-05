import { useNavigate } from 'react-router-dom';
import { CreditCard, ChevronRight, ArrowLeft, Lock, Loader2, Info, Tag, X, Badge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge as UiBadge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { SubscriptionPayment, formatCurrency, formatCardNumber } from '../types';
import { StepIndicator } from './StepIndicator';
import { OrderSummary } from './OrderSummary';
import { useSubscriptionWizard } from '../hooks/useSubscriptionWizard';

interface SubscriptionWizardProps {
  pkg: SubscriptionPayment;
}

export function SubscriptionWizard({ pkg }: SubscriptionWizardProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const w = useSubscriptionWizard(pkg);

  // Processing / Success / Error states
  if (w.wizardState === 'processing') {
    return (
      <div className="max-w-lg mx-auto rounded-xl border p-12 text-center bg-card space-y-4 shadow-sm">
        <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
        <p className="font-medium text-foreground">Processando pagamento...</p>
        <p className="text-sm text-muted-foreground">Não feche esta página.</p>
      </div>
    );
  }

  if (w.wizardState === 'success') {
    return (
      <div className="max-w-lg mx-auto rounded-xl border p-8 text-center bg-card space-y-3 shadow-sm">
        <div className="text-4xl">🎉</div>
        <h3 className="text-lg font-semibold text-primary">Pagamento Confirmado!</h3>
        <p className="text-xs text-muted-foreground">Redirecionando...</p>
      </div>
    );
  }

  if (w.wizardState === 'error') {
    return (
      <div className="max-w-lg mx-auto rounded-xl border p-8 text-center bg-card space-y-4 shadow-sm">
        <div className="text-5xl">❌</div>
        <h3 className="text-lg font-semibold text-destructive">Erro no pagamento</h3>
        <p className="text-sm text-muted-foreground">{w.errorMessage}</p>
        <div className="flex gap-2 justify-center">
          <Button
            variant="outline"
            onClick={() => {
              w.setWizardState('form');
              w.setCurrentStep(1);
            }}
          >
            Revisar dados do cartão
          </Button>
          <Button variant="outline" onClick={() => navigate('/credits/checkout')}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  const summaryComponent = (
    <OrderSummary
      pkg={pkg}
      installments={w.installments}
      couponDiscount={
        w.coupon.valid && (w.coupon as any).calculateDiscount
          ? (w.coupon as any).calculateDiscount(w.installmentBaseCents)
          : null
      }
      couponCode={w.coupon.valid ? w.coupon.code : null}
      couponDiscountType={w.coupon.valid ? w.coupon.discountType : null}
      couponDiscountValue={w.coupon.valid ? w.coupon.discountValue : null}
    />
  );

  return (
    <div>
      <StepIndicator currentStep={w.currentStep} completedSteps={w.completedSteps} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
        {/* Left: Form area */}
        <div className="space-y-6">
          {/* STEP 1: Personal Data */}
          {w.currentStep === 0 && (
            <div className="rounded-xl border bg-card p-6 space-y-5 shadow-sm">
              <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                  1
                </div>
                Dados Pessoais
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="name">Nome completo</Label>
                <Input
                  id="name"
                  placeholder="Seu nome"
                  value={w.name}
                  onChange={(e) => w.setName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cpfCnpj">CPF ou CNPJ</Label>
                <Input
                  id="cpfCnpj"
                  placeholder="000.000.000-00"
                  value={w.cpfCnpj}
                  onChange={(e) => w.setCpfCnpj(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input value={w.user?.email || ''} disabled className="bg-muted/50" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    placeholder="(00) 00000-0000"
                    value={w.phone}
                    onChange={(e) => w.setPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="postalCode">CEP</Label>
                  <Input
                    id="postalCode"
                    placeholder="00000-000"
                    value={w.postalCode}
                    onChange={(e) => w.setPostalCode(e.target.value)}
                  />
                </div>
              </div>

              <Button className="w-full" size="lg" onClick={w.goNext}>
                Próximo: Pagamento
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}

          {/* STEP 2: Payment */}
          {w.currentStep === 1 && (
            <div className="space-y-5">
              {/* Installment selector for yearly */}
              {w.isYearly && w.installmentOptions.length > 0 && (
                <div className="rounded-xl border bg-card p-5 space-y-4 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <CreditCard className="h-4 w-4 text-primary" />
                    Forma de Pagamento
                  </div>

                  <button
                    type="button"
                    onClick={() => w.setInstallments(1)}
                    className={cn(
                      'w-full flex items-center justify-between rounded-lg border-2 p-4 text-left transition-all',
                      w.installments === 1
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/30'
                    )}
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">À vista</p>
                      <p className="text-sm text-primary font-medium">
                        {formatCurrency(w.finalChargeCents)}
                      </p>
                    </div>
                    <UiBadge variant="secondary" className="text-[10px] shrink-0">
                      Renovação automática
                    </UiBadge>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (w.installments <= 1) w.setInstallments(2);
                    }}
                    className={cn(
                      'w-full flex flex-col rounded-lg border-2 p-4 text-left transition-all',
                      w.installments > 1
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/30'
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Parcelado</p>
                        <p className="text-sm text-primary font-medium">até 12x sem juros</p>
                      </div>
                      <UiBadge variant="outline" className="text-[10px] shrink-0">
                        Renovação manual
                      </UiBadge>
                    </div>
                  </button>

                  {w.installments > 1 && (
                    <div className="pl-1 space-y-2">
                      <Label className="text-xs text-muted-foreground">Número de parcelas</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={w.installments}
                        onChange={(e) => w.setInstallments(Number(e.target.value))}
                      >
                        {w.installmentOptions
                          .filter((opt) => opt.value >= 2)
                          .map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                    <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                    <span>
                      {w.installments === 1
                        ? 'Sua assinatura será renovada automaticamente a cada 12 meses.'
                        : 'Este plano terá renovação manual. Você será notificado antes do vencimento para renovar.'}
                    </span>
                  </div>
                </div>
              )}

              {/* Card data */}
              <div className="rounded-xl border bg-card p-6 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                  <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                    2
                  </div>
                  Dados do Cartão
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cardNumber">Número do cartão</Label>
                  <Input
                    id="cardNumber"
                    placeholder="0000 0000 0000 0000"
                    value={w.cardNumber}
                    onChange={(e) => w.setCardNumber(formatCardNumber(e.target.value))}
                    maxLength={19}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cardHolderName">Nome no cartão</Label>
                  <Input
                    id="cardHolderName"
                    placeholder="NOME COMO NO CARTÃO"
                    value={w.cardHolderName}
                    onChange={(e) => w.setCardHolderName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="expiryMonth">Mês</Label>
                    <Input
                      id="expiryMonth"
                      placeholder="MM"
                      maxLength={2}
                      value={w.expiryMonth}
                      onChange={(e) => w.setExpiryMonth(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="expiryYear">Ano</Label>
                    <Input
                      id="expiryYear"
                      placeholder="AAAA"
                      maxLength={4}
                      value={w.expiryYear}
                      onChange={(e) => w.setExpiryYear(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ccv">CVV</Label>
                    <Input
                      id="ccv"
                      placeholder="000"
                      maxLength={4}
                      type="password"
                      value={w.ccv}
                      onChange={(e) => w.setCcv(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={w.goBack}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Voltar
                </Button>
                <Button className="flex-1" size="lg" onClick={w.goNext}>
                  Próximo: Revisão
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Review + Coupon */}
          {w.currentStep === 2 && (
            <div className="space-y-5">
              <div className="rounded-xl border bg-card p-6 space-y-5 shadow-sm">
                <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                  <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                    3
                  </div>
                  Revisão e Confirmação
                </div>

                {/* Personal data summary */}
                <div className="rounded-lg bg-muted/30 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Dados Pessoais
                    </span>
                    <button onClick={() => w.setCurrentStep(0)} className="text-xs text-primary hover:underline">
                      Editar
                    </button>
                  </div>
                  <p className="text-sm text-foreground">{w.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {w.cpfCnpj} • {w.phone}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {w.user?.email} • CEP {w.postalCode}
                  </p>
                </div>

                {/* Card summary */}
                <div className="rounded-lg bg-muted/30 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Pagamento
                    </span>
                    <button onClick={() => w.setCurrentStep(1)} className="text-xs text-primary hover:underline">
                      Editar
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-foreground">
                      •••• {w.cardNumber.replace(/\s/g, '').slice(-4)}
                    </p>
                  </div>
                  {w.isYearly && (
                    <p className="text-sm text-muted-foreground">
                      {w.installments === 1
                        ? 'À vista (renovação automática)'
                        : `${w.installments}x sem juros (renovação manual)`}
                    </p>
                  )}
                </div>

                {/* Coupon */}
                <div className="border-t pt-4 space-y-3">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Cupom de Desconto
                  </span>
                  {w.coupon.valid ? (
                    <div className="flex items-center gap-2">
                      <div className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2">
                        <Tag className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium text-primary">{w.coupon.code}</span>
                        <span className="text-xs text-muted-foreground">
                          (
                          {w.coupon.discountType === 'percentage'
                            ? `${w.coupon.discountValue}% off`
                            : `${formatCurrency(w.coupon.discountValue)} off`}
                          )
                        </span>
                        <button
                          onClick={() => {
                            w.clearCoupon();
                            w.setCouponInput('');
                          }}
                          className="ml-1 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Cupom de desconto"
                        value={w.couponInput}
                        onChange={(e) => w.setCouponInput(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === 'Enter' && w.validateCoupon(w.couponInput, pkg.planType)}
                        className="h-9 text-sm max-w-xs"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => w.validateCoupon(w.couponInput, pkg.planType)}
                        disabled={w.isValidatingCoupon || !w.couponInput.trim()}
                        className="gap-1.5 shrink-0"
                      >
                        {w.isValidatingCoupon ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Tag className="h-3.5 w-3.5" />
                        )}
                        Aplicar
                      </Button>
                      {w.coupon.error && <p className="text-xs text-destructive">{w.coupon.error}</p>}
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <Button variant="outline" onClick={w.goBack}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Voltar
                </Button>
                <Button className="flex-1" size="lg" onClick={w.handleFinalSubmit} disabled={w.isProcessing}>
                  {w.isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      {w.isUpgrade
                        ? `Confirmar upgrade ${formatCurrency(w.finalChargeCents)}`
                        : w.isYearly && w.installments > 1
                          ? `Assinar ${w.installments}x de ${formatCurrency(Math.round(w.finalChargeCents / w.installments))}`
                          : `Confirmar ${formatCurrency(w.finalChargeCents)}`}
                    </>
                  )}
                </Button>
              </div>

              <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
                <Lock className="h-3 w-3" />
                Pagamento seguro via Asaas (PCI DSS)
              </p>
            </div>
          )}
        </div>

        {/* Right: Order summary (desktop) / bottom (mobile) */}
        <div className={cn(isMobile ? 'order-first' : 'order-last')}>{summaryComponent}</div>
      </div>
    </div>
  );
}
