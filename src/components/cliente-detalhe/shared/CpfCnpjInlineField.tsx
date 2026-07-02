import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, X, Pencil, IdCard, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { maskCpfCnpj, unmaskDigits, validateCpfCnpj } from "@/lib/validateCpfCnpj";

interface Props {
  value: string;
  /** onSave recebe dígitos puros (ou string vazia para limpar). */
  onSave: (digits: string) => Promise<void> | void;
  className?: string;
}

/**
 * CpfCnpjInlineField — edição inline de CPF/CNPJ com máscara dinâmica e DV.
 * Persiste sempre em dígitos puros.
 */
export function CpfCnpjInlineField({ value, onSave, className }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value ? maskCpfCnpj(value) : "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) setDraft(value ? maskCpfCnpj(value) : "");
  }, [value, isEditing]);

  const digits = unmaskDigits(draft);
  const isEmpty = digits.length === 0;
  const isValid = isEmpty || validateCpfCnpj(digits);
  const showError = !isEmpty && !isValid;

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      await onSave(digits);
      setIsEditing(false);
      if (!isEmpty) toast.success("Documento salvo");
    } catch {
      toast.error("Erro ao salvar documento");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft(value ? maskCpfCnpj(value) : "");
    setIsEditing(false);
  };

  const displayValue = value ? maskCpfCnpj(value) : "";

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className={cn(
          "w-full flex items-center gap-2 rounded-md border border-transparent hover:border-border hover:bg-muted/50 px-3 py-2 text-left transition-colors group",
          className,
        )}
      >
        <IdCard className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className={cn("flex-1 text-sm truncate", !displayValue && "text-muted-foreground italic")}>
          {displayValue || "Clique para adicionar CPF/CNPJ"}
        </span>
        <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center gap-2">
        <IdCard className="h-4 w-4 text-muted-foreground shrink-0" />
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(maskCpfCnpj(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && isValid) handleSave();
            if (e.key === "Escape") handleCancel();
          }}
          placeholder="000.000.000-00"
          inputMode="numeric"
          className={cn("h-9 flex-1", showError && "border-destructive")}
        />
        <Button size="icon" variant="ghost" onClick={handleSave} disabled={!isValid || saving} className="h-8 w-8">
          <Check className="h-4 w-4 text-emerald-600" />
        </Button>
        <Button size="icon" variant="ghost" onClick={handleCancel} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>
      {showError && (
        <p className="text-[11px] text-destructive flex items-center gap-1 pl-6">
          <AlertCircle className="h-3 w-3" />
          CPF/CNPJ inválido
        </p>
      )}
      {!isEmpty && isValid && (
        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 pl-6">
          <CheckCircle2 className="h-3 w-3" />
          Documento válido
        </p>
      )}
    </div>
  );
}
