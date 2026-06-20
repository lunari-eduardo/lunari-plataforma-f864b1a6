import { useState, useEffect, useRef, ChangeEvent, FocusEvent } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * MoneyInputBRL
 * Input controlado para valores monetários em BRL armazenados como centavos.
 *
 * - Mantém string local enquanto o usuário digita (não derruba cursor).
 * - Aceita estados intermediários: "", "1", "14", "14,", "14,9", "14,90".
 * - Sincroniza com `valueCents` externo apenas quando NÃO está focado, ou
 *   quando o usuário sai do campo (onBlur) — daí normaliza a exibição.
 * - Emite `onChangeCents(cents)` a cada mudança parseável.
 */

function formatCentsToBRL(cents: number): string {
  if (!Number.isFinite(cents)) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

function parseBRLToCents(raw: string): number | null {
  if (!raw) return null;
  // Permite "1234,56" ou "1234.56" ou "1234,5" ou "1234,"
  const normalized = raw.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  // Aceitar estados parciais: número terminando em "." é válido como inteiro
  const trimmed = normalized.endsWith(".") ? normalized.slice(0, -1) : normalized;
  if (trimmed === "" || trimmed === "-") return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100);
}

function sanitizeKeystroke(raw: string): string {
  // Permite apenas dígitos e UMA vírgula. Remove tudo o mais.
  const stripped = raw.replace(/[^\d,]/g, "");
  const firstComma = stripped.indexOf(",");
  if (firstComma === -1) return stripped;
  const head = stripped.slice(0, firstComma + 1);
  const tail = stripped.slice(firstComma + 1).replace(/,/g, "");
  // Máximo 2 casas decimais durante digitação
  return head + tail.slice(0, 2);
}

interface Props {
  valueCents: number;
  onChangeCents: (cents: number) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function MoneyInputBRL({
  valueCents,
  onChangeCents,
  className,
  placeholder = "0,00",
  disabled,
}: Props) {
  const [display, setDisplay] = useState(() => formatCentsToBRL(valueCents));
  const focusedRef = useRef(false);

  // Sincroniza display quando valueCents muda externamente E o input não está focado
  useEffect(() => {
    if (!focusedRef.current) {
      setDisplay(formatCentsToBRL(valueCents));
    }
  }, [valueCents]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = sanitizeKeystroke(e.target.value);
    setDisplay(next);
    const cents = parseBRLToCents(next);
    if (cents !== null) onChangeCents(cents);
  };

  const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
    focusedRef.current = true;
    // Se for 0, limpa para facilitar digitação
    if (valueCents === 0) setDisplay("");
    requestAnimationFrame(() => e.target.select());
  };

  const handleBlur = () => {
    focusedRef.current = false;
    const cents = parseBRLToCents(display) ?? 0;
    onChangeCents(cents);
    setDisplay(formatCentsToBRL(cents));
  };

  return (
    <Input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={display}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(className)}
    />
  );
}
