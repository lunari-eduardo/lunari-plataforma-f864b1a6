/**
 * TextField / TextAreaField — inputs discretos para descrição, observações, favorecido.
 */
import { memo } from 'react';
import { cn } from '@/lib/utils';

interface BaseProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
  /** Tipo nativo do input (default: "text"). Use "number" para inteiros simples. */
  type?: string;
  /** inputMode para teclados mobile (ex.: "numeric", "decimal"). */
  inputMode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
  min?: number;
  max?: number;
}

export const TextField = memo(function TextField({
  value,
  onChange,
  placeholder,
  disabled,
  maxLength,
  type = 'text',
  inputMode,
  min,
  max,
}: BaseProps) {
  return (
    <input
      type={type}
      inputMode={inputMode}
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      maxLength={maxLength}
      autoComplete="off"
      className={cn(
        'w-full rounded-md border-0 bg-transparent px-2 py-1.5 text-[13px] text-foreground outline-none',
        'hover:bg-muted/40 focus:bg-muted/40 transition-colors',
        'placeholder:text-muted-foreground/40',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    />
  );
});

export const TextAreaField = memo(function TextAreaField({
  value,
  onChange,
  placeholder,
  disabled,
  maxLength,
  rows = 3,
}: BaseProps & { rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      maxLength={maxLength}
      rows={rows}
      className={cn(
        'w-full resize-none rounded-md border-0 bg-transparent px-2 py-1.5 text-[13px] leading-relaxed text-foreground outline-none',
        'hover:bg-muted/40 focus:bg-muted/40 transition-colors',
        'placeholder:text-muted-foreground/40',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    />
  );
});
