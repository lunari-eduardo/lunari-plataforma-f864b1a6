import { Tag, Info } from 'lucide-react';
import { PaymentState, SubscriptionPayment, formatCurrency } from '../types';
import { cn } from '@/lib/utils';

interface OrderSummaryProps {
  pkg: PaymentState;
  installments: number;
  couponDiscount: number | null;
  couponCode: string | null;
  couponDiscountType: string | null;
  couponDiscountValue: number | null;
}

export function OrderSummary({
  pkg,
  installments,
  couponDiscount,
  couponCode,
  couponDiscountType,
  couponDiscountValue,
}: OrderSummaryProps) {
  const isUpgrade = pkg.type === 'subscription' && pkg.isUpgrade;
  const isRenewal = pkg.type === 'subscription' && (pkg as any).isRenewal;
  const isYearly = pkg.type === 'subscription' && pkg.billingCycle === 'YEARLY';

  // Base amount for calculation
  const baseCents =
    isUpgrade && !isRenewal && pkg.type === 'subscription' && (pkg as any).prorataValueCents != null
      ? (pkg as any).prorataValueCents
      : pkg.priceCents;

  const finalCents = couponDiscount != null ? couponDiscount : baseCents;
  const hasDiscount = couponDiscount != null && couponDiscount < baseCents;

  const prorataFormatted =
    isUpgrade && !isRenewal && pkg.type === 'subscription' && pkg.prorataValueCents != null
      ? formatCurrency(pkg.prorataValueCents)
      : null;

  return (
    <div className="rounded-xl border bg-card p-6 space-y-4 lg:sticky lg:top-20 shadow-sm">
      <h2 className="font-semibold text-foreground text-base">Resumo do Pedido</h2>

      <div className="border-t pt-4 space-y-1">
        <p className="font-medium text-foreground">
          {pkg.type === 'select' ? pkg.packageName : pkg.planName}
        </p>
        <p className="text-sm text-muted-foreground">
          {pkg.type === 'select'
            ? `${pkg.credits.toLocaleString('pt-BR')} créditos`
            : isRenewal
              ? 'Renovação antecipada'
              : isUpgrade
                ? `Upgrade de ${(pkg as SubscriptionPayment).currentPlanName || 'plano atual'}`
                : isYearly
                  ? installments === 1
                    ? 'Assinatura anual'
                    : 'Compra parcelada'
                  : 'Assinatura mensal'}
        </p>
      </div>

      <div className="border-t pt-4 space-y-2">
        {isUpgrade && prorataFormatted ? (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valor do novo plano</span>
              <span className="text-foreground">
                {formatCurrency(pkg.priceCents)}/
                {(pkg as SubscriptionPayment).billingCycle === 'MONTHLY' ? 'mês' : 'ano'}
              </span>
            </div>
            {pkg.type === 'subscription' &&
              pkg.prorataValueCents != null &&
              pkg.prorataValueCents < pkg.priceCents && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Crédito de planos ativos</span>
                  <span className="text-primary font-medium">
                    -{formatCurrency(pkg.priceCents - pkg.prorataValueCents)}
                  </span>
                </div>
              )}
            {hasDiscount && couponCode && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Cupom {couponCode}
                </span>
                <span className="text-primary font-medium">
                  -{formatCurrency(baseCents - finalCents)}
                </span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-base border-t pt-2">
              <span className="text-foreground">Pagar agora</span>
              <span className="text-primary">{formatCurrency(finalCents)}</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className={cn('text-foreground', hasDiscount && 'line-through text-muted-foreground')}>
                {formatCurrency(baseCents)}
              </span>
            </div>
            {hasDiscount && couponCode && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Cupom {couponCode}
                </span>
                <span className="text-primary font-medium">
                  {couponDiscountType === 'percentage'
                    ? `-${couponDiscountValue}%`
                    : `-${formatCurrency(baseCents - finalCents)}`}
                </span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-base border-t pt-2">
              <span className="text-foreground">Total</span>
              <span className="text-primary">{formatCurrency(finalCents)}</span>
            </div>
          </>
        )}
        {isYearly && installments > 1 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Parcelas</span>
            <span className="text-foreground font-medium">
              {installments}x de {formatCurrency(Math.round(finalCents / installments))} sem juros
            </span>
          </div>
        )}
      </div>

      {/* Renewal info */}
      {isYearly && (
        <div className="border-t pt-4">
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
            <span>
              {isRenewal
                ? 'Sua assinatura atual será encerrada e um novo ciclo de 12 meses iniciará.'
                : installments === 1
                  ? 'Renovação automática a cada 12 meses.'
                  : 'Renovação manual após 12 meses. Você será notificado antes do vencimento.'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
