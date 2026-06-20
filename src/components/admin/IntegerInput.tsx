import { useState, useEffect, useRef, ChangeEvent, FocusEvent } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * IntegerInput — campo inteiro sem o bug do "0" preso.
 * Mantém string local; permite vazio durante digitação; normaliza no blur.
 */
interface Props {
  value: number;
  onChange: (n: number) => void;
  className?: string;
  placeholder?: string;
  min?: number;
  disabled?: boolean;
}

export function IntegerInput({ value, onChange, className, placeholder = "0", min, disabled }: Props) {
  const [display, setDisplay] = useState<string>(() => (Number.isFinite(value) ? String(value) : ""));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setDisplay(Number.isFinite(value) ? String(value) : "");
  }, [value]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, "");
    setDisplay(raw);
    if (raw === "") return; // permite estado vazio durante digitação
    const n = parseInt(raw, 10);
    if (!Number.isNaN(n)) {
      const clamped = typeof min === "number" ? Math.max(min, n) : n;
      onChange(clamped);
    }
  };

  const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
    focusedRef.current = true;
    if (value === 0) setDisplay("");
    requestAnimationFrame(() => e.target.select());
  };

  const handleBlur = () => {
    focusedRef.current = false;
    const n = parseInt(display || "0", 10);
    const finalN = Number.isNaN(n) ? 0 : n;
    const clamped = typeof min === "number" ? Math.max(min, finalN) : finalN;
    onChange(clamped);
    setDisplay(String(clamped));
  };

  return (
    <Input
      type="text"
      inputMode="numeric"
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
