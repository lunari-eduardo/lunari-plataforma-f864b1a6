import * as React from 'react';
import { Input } from '@/components/ui/input';
import { useCurrencyInput } from '@/hooks/useCurrencyInput';
import { cn } from '@/lib/utils';

interface CurrencyInputProps
  extends Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> {
  value: number;
  onChange: (value: number) => void;
  /** Prefixo "R$" visível dentro do campo. Padrão: true. */
  showPrefix?: boolean;
}

/**
 * Campo monetário BRL com máscara automática (padrão Silent Luxury).
 * Encapsula `useCurrencyInput` para poder ser usado dentro de listas
 * (onde não é possível chamar o hook em loop).
 */
export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, showPrefix = true, className, ...rest }, ref) => {
    const { inputProps } = useCurrencyInput({ value, onChange });

    return (
      <div className="relative w-full">
        {showPrefix && (
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
            R$
          </span>
        )}
        <Input
          ref={ref}
          {...inputProps}
          {...rest}
          placeholder={rest.placeholder ?? '0,00'}
          className={cn(
            'text-right tabular-nums',
            showPrefix && 'pl-7',
            className,
          )}
        />
      </div>
    );
  },
);

CurrencyInput.displayName = 'CurrencyInput';
