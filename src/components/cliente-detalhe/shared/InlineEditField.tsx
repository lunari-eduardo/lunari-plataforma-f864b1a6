import { useState, useEffect, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Check, X, Pencil } from "lucide-react";
import { toast } from 'sonner';
import { cn } from "@/lib/utils";

interface InlineEditFieldProps {
  value: string;
  onSave: (value: string) => Promise<void>;
  type?: 'text' | 'email' | 'date' | 'textarea';
  placeholder?: string;
  icon?: React.ReactNode;
  label?: string;
  className?: string;
  displayClassName?: string;
  emptyText?: string;
}

export function InlineEditField({
  value,
  onSave,
  type = 'text',
  placeholder = 'Clique para editar',
  icon,
  label,
  className,
  displayClassName,
  emptyText = 'Não informado'
}: InlineEditFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Sync localValue quando value muda externamente (apenas fora de edição)
  useEffect(() => {
    if (!isEditing) {
      setLocalValue(value);
    }
  }, [value, isEditing]);

  // Focus input quando entra em modo edição
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (localValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(localValue);
      setIsEditing(false);
      // Sem toast de sucesso — feedback visual já é o fechamento do input
    } catch (error) {
      toast.error('Erro ao salvar');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setLocalValue(value);
    setIsEditing(false);
  };

  const handleChange = (newValue: string) => {
    // Apenas atualiza estado local — sem auto-save
    setLocalValue(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'textarea') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  const formatDisplayValue = (val: string) => {
    if (!val) return emptyText;
    
    if (type === 'date' && val) {
      try {
        const date = new Date(val + 'T00:00:00');
        return date.toLocaleDateString('pt-BR');
      } catch {
        return val;
      }
    }
    
    return val;
  };

  if (!isEditing) {
    return (
      <div 
        onClick={() => setIsEditing(true)}
        className={cn(
          "group flex items-center gap-2 cursor-pointer rounded-lg px-3 py-2 -mx-3 transition-all duration-200",
          "hover:bg-muted/50",
          displayClassName
        )}
      >
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <span className={cn(
          "flex-1",
          !value && "text-muted-foreground italic"
        )}>
          {formatDisplayValue(value)}
        </span>
        <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    );
  }

  const inputProps = {
    ref: inputRef as any,
    value: localValue,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleChange(e.target.value),
    onKeyDown: handleKeyDown,
    placeholder,
    disabled: isSaving,
    className: cn(
      "transition-all duration-200",
      isSaving && "opacity-50",
      className
    )
  };

  return (
    <div className="flex items-center gap-2">
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <div className="flex-1 flex items-center gap-2">
        {type === 'textarea' ? (
          <Textarea {...inputProps} rows={3} />
        ) : (
          <Input {...inputProps} type={type} />
        )}
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleSave}
            disabled={isSaving}
            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleCancel}
            disabled={isSaving}
            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
