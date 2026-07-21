import { useEffect, useRef, useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useCurrencyInput } from "@/hooks/useCurrencyInput";
import { cn } from "@/lib/utils";

interface Props {
  value: number;
  disabled?: boolean;
  onCommit: (v: number) => void;
  formatCurrency: (v: number) => string;
}

/** Display "R$ X,XX" + pencil; click abre input inline com máscara BRL. */
export function ProdutoPriceEditor({ value, disabled, onCommit, formatCurrency }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  const currency = useCurrencyInput({
    value: draft,
    onChange: setDraft,
  });

  useEffect(() => {
    if (editing) setDraft(value);
  }, [editing, value]);

  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [editing]);

  if (disabled) {
    return (
      <div className="text-[13px] text-muted-foreground italic">
        R$ 0,00 <span className="text-[10px]">(incluso)</span>
      </div>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="group inline-flex items-center gap-1.5 text-[14px] font-medium text-foreground hover:text-primary transition-colors"
        aria-label="Editar preço unitário"
      >
        <span className="tabular-nums">{formatCurrency(value)}</span>
        <Pencil className="h-3 w-3 text-muted-foreground/70 group-hover:text-primary" />
      </button>
    );
  }

  const commit = () => {
    onCommit(Math.max(0, draft));
    setEditing(false);
  };
  const cancel = () => setEditing(false);

  return (
    <div className="inline-flex items-center gap-1">
      <span className="text-[11px] text-muted-foreground">R$</span>
      <Input
        {...currency.inputProps}
        ref={inputRef}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") { e.preventDefault(); cancel(); }
        }}
        className={cn("h-7 w-24 text-[13px] px-1.5")}
        placeholder="0,00"
      />
      <button
        type="button"
        onClick={commit}
        className="h-6 w-6 flex items-center justify-center rounded hover:bg-emerald-500/10 text-emerald-600"
        aria-label="Confirmar preço"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={cancel}
        className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
        aria-label="Cancelar edição"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
