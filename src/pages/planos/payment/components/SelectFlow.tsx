import { useState } from 'react';
import { Smartphone, CreditCard } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { SelectPayment, formatCurrency } from '../types';
import { OrderSummary } from './OrderSummary';
import { SelectPixForm } from './SelectPixForm';
import { SelectCardForm } from './SelectCardForm';

interface SelectFlowProps {
  pkg: SelectPayment;
}

export function SelectFlow({ pkg }: SelectFlowProps) {
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card'>('pix');
  const isMobile = useIsMobile();
  const formattedPrice = formatCurrency(pkg.priceCents);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Finalizar Compra</h1>
          <p className="text-sm text-muted-foreground">Escolha a forma de pagamento</p>
        </div>

        {/* Payment method toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setPaymentMethod('pix')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all',
              paymentMethod === 'pix'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            )}
          >
            <Smartphone className="h-4 w-4" />
            PIX
          </button>
          <button
            onClick={() => setPaymentMethod('card')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all',
              paymentMethod === 'card'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            )}
          >
            <CreditCard className="h-4 w-4" />
            Cartão de Crédito
          </button>
        </div>

        {paymentMethod === 'pix' ? (
          <SelectPixForm pkg={pkg} formattedPrice={formattedPrice} />
        ) : (
          <SelectCardForm pkg={pkg} formattedPrice={formattedPrice} />
        )}
      </div>

      {/* Order summary */}
      <div className={cn(isMobile ? 'order-first' : 'order-last')}>
        <OrderSummary
          pkg={pkg}
          installments={1}
          couponDiscount={null}
          couponCode={null}
          couponDiscountType={null}
          couponDiscountValue={null}
        />
      </div>
    </div>
  );
}
