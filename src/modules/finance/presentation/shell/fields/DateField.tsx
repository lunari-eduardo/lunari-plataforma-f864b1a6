/**
 * DateField — input de data nativo com estilo Silent Luxury.
 * Usa <input type="date"> para máxima compatibilidade mobile.
 */
import { memo } from 'react';
import { cn } from '@/lib/utils';

interface DateFieldProps {
  value: string | null; // ISO yyyy-mm-dd
  onChange: (value: string | null) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  placeholder?: string;
}

export const DateField = memo(function DateField({
  value,
  onChange,
  min,
  max,
  disabled,
  placeholder,
}: DateFieldProps) {
  return (
    <input
      type="date"
      value={value ?? ''}
      min={min}
      max={max}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value || null)}
      placeholder={placeholder}
      className={cn(
        'w-full rounded-md border-0 bg-transparent px-2 py-1.5 text-[13px] text-foreground outline-none',
        'hover:bg-muted/40 focus:bg-muted/40 transition-colors',
        'placeholder:text-muted-foreground/50',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    />
  );
});

export default DateField;
