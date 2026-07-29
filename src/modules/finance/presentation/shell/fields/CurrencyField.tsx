/**
 * CurrencyField — protagonista visual do drawer de lançamentos.
 * Tipografia grande (Silent Luxury), prefixo "R$" discreto,
 * cor dourada quando preenchido.
 */
import { memo, forwardRef } from 'react';
import { useCurrencyInput } from '@/hooks/useCurrencyInput';
import { cn } from '@/lib/utils';

interface CurrencyFieldProps {
  value: number;
  onChange: (value: number) => void;
  autoFocus?: boolean;
  placeholder?: string;
  disabled?: boolean;
  size?: 'lg' | 'md';
}

export const CurrencyField = memo(
  forwardRef<HTMLInputElement, CurrencyFieldProps>(function CurrencyField(
    { value, onChange, autoFocus, placeholder = '0,00', disabled, size = 'lg' },
    ref,
  ) {
    const { inputProps } = useCurrencyInput({ value, onChange });
    const filled = value > 0;

    const sizes = {
      lg: {
        wrapper: 'gap-2 py-4',
        prefix: 'text-[15px] font-medium',
        input: 'text-[34px] font-heading font-semibold tracking-tight leading-none',
      },
      md: {
        wrapper: 'gap-1.5 py-2',
        prefix: 'text-[12px]',
        input: 'text-[18px] font-medium',
      },
    }[size];

    return (
      <div
        className={cn(
          'flex items-baseline border-b transition-colors',
          sizes.wrapper,
          filled ? 'border-accent-gold/60' : 'border-border/60',
          disabled && 'opacity-50',
        )}
      >
        <span
          className={cn(
            'shrink-0 transition-colors',
            sizes.prefix,
            filled ? 'text-accent-gold' : 'text-muted-foreground',
          )}
        >
          R$
        </span>
        <input
          {...inputProps}
          ref={ref}
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder={placeholder}
          className={cn(
            'flex-1 min-w-0 border-0 bg-transparent p-0 outline-none placeholder:text-muted-foreground/40',
            sizes.input,
            filled ? 'text-accent-gold' : 'text-foreground',
          )}
        />
      </div>
    );
  }),
);

export default CurrencyField;
