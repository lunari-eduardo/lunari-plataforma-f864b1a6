import { useState, useEffect, useCallback, ChangeEvent, FocusEvent } from 'react';

/**
 * Hook para máscara de moeda BRL em inputs de texto.
 * Formata em tempo real (ex: "1.234,56") e retorna valor numérico via onChange.
 */

function formatBRL(value: number): string {
  if (!value && value !== 0) return '';
  if (value === 0) return '';
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseBRL(formatted: string): number {
  if (!formatted) return 0;
  // Remove pontos de milhar, troca vírgula por ponto
  const cleaned = formatted.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function formatWhileTyping(raw: string): string {
  // Remove tudo que não é dígito ou vírgula
  let digits = raw.replace(/[^\d]/g, '');
  if (!digits) return '';
  
  // Converte para centavos e formata
  const centavos = parseInt(digits, 10);
  if (isNaN(centavos)) return '';
  
  const valor = centavos / 100;
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface UseCurrencyInputOptions {
  value: number;
  onChange: (value: number) => void;
}

export function useCurrencyInput({ value, onChange }: UseCurrencyInputOptions) {
  const [displayValue, setDisplayValue] = useState(() => formatBRL(value));
  const [isFocused, setIsFocused] = useState(false);

  // Sync display when value changes externally (and input is not focused)
  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatBRL(value));
    }
  }, [value, isFocused]);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const formatted = formatWhileTyping(raw);
    setDisplayValue(formatted);
    
    const numValue = parseBRL(formatted);
    onChange(numValue);
  }, [onChange]);

  const handleFocus = useCallback((e: FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    // Se valor é 0, limpa o campo
    if (value === 0) {
      setDisplayValue('');
    }
    // Seleciona todo o texto
    setTimeout(() => e.target.select(), 0);
  }, [value]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    // Normaliza a exibição
    const numValue = parseBRL(displayValue);
    setDisplayValue(formatBRL(numValue));
  }, [displayValue]);

  return {
    displayValue,
    handleChange,
    handleFocus,
    handleBlur,
    inputProps: {
      type: 'text' as const,
      inputMode: 'decimal' as const,
      value: displayValue,
      onChange: handleChange,
      onFocus: handleFocus,
      onBlur: handleBlur,
    },
  };
}
