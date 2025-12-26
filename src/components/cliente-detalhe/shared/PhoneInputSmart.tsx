import { useState, useEffect, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, X, Pencil, Phone, MessageCircle } from "lucide-react";
import { toast } from 'sonner';
import { cn } from "@/lib/utils";

interface PhoneInputSmartProps {
  value: string;
  onSave: (value: string) => Promise<void>;
  placeholder?: string;
  className?: string;
}

// Formata telefone brasileiro
const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0,2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    // Fixo: (XX) XXXX-XXXX
    return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
  }
  // Celular: (XX) XXXXX-XXXX
  return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7,11)}`;
};

// Remove formatação para armazenar
const unformatPhone = (value: string): string => {
  return value.replace(/\D/g, '');
};

// Verifica se é celular (9º dígito = 9)
const isCelular = (digits: string): boolean => {
  if (digits.length < 3) return false;
  return digits.charAt(2) === '9';
};

// Extrai DDD
const getDDD = (digits: string): string => {
  return digits.slice(0, 2);
};

export function PhoneInputSmart({
  value,
  onSave,
  placeholder = '(51) 99999-9999',
  className
}: PhoneInputSmartProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(formatPhone(value));
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const digits = unformatPhone(value);
  const hasPhone = digits.length >= 10;
  const celular = isCelular(digits);

  // Sync localValue quando value muda externamente
  useEffect(() => {
    if (!isEditing) {
      setLocalValue(formatPhone(value));
    }
  }, [value, isEditing]);

  // Focus input quando entra em modo edição
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const cleanValue = unformatPhone(localValue);
    if (cleanValue === unformatPhone(value)) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(cleanValue);
      toast.success('Salvo', { duration: 1500 });
      setIsEditing(false);
    } catch (error) {
      toast.error('Erro ao salvar');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    setLocalValue(formatPhone(value));
    setIsEditing(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setLocalValue(formatted);
    
    // Auto-save com debounce de 800ms
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    const cleanValue = unformatPhone(formatted);
    debounceRef.current = setTimeout(async () => {
      if (cleanValue !== unformatPhone(value) && cleanValue.length >= 10) {
        setIsSaving(true);
        try {
          await onSave(cleanValue);
          toast.success('Salvo', { duration: 1500 });
        } catch (error) {
          toast.error('Erro ao salvar');
        } finally {
          setIsSaving(false);
        }
      }
    }, 800);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleCall = () => {
    if (hasPhone) {
      window.open(`tel:+55${digits}`, '_blank');
    }
  };

  const handleWhatsApp = () => {
    if (hasPhone) {
      window.open(`https://wa.me/55${digits}`, '_blank');
    }
  };

  if (!isEditing) {
    return (
      <div className="space-y-2">
        <div 
          onClick={() => setIsEditing(true)}
          className={cn(
            "group flex items-center gap-2 cursor-pointer rounded-lg px-3 py-2 -mx-3 transition-all duration-200",
            "hover:bg-muted/50",
            className
          )}
        >
          <Phone className="h-4 w-4 text-muted-foreground" />
          <span className={cn(
            "flex-1",
            !value && "text-muted-foreground italic"
          )}>
            {hasPhone ? formatPhone(value) : 'Não informado'}
          </span>
          {hasPhone && (
            <span className={cn(
              "text-xs px-2 py-0.5 rounded-full",
              celular 
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
            )}>
              {celular ? 'Celular' : 'Fixo'}
            </span>
          )}
          <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        
        {/* Botões de ação rápida */}
        {hasPhone && (
          <div className="flex gap-2 pl-6">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCall}
              className="h-8 text-xs gap-1.5"
            >
              <Phone className="h-3 w-3" />
              Ligar
            </Button>
            {celular && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleWhatsApp}
                className="h-8 text-xs gap-1.5 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
              >
                <MessageCircle className="h-3 w-3" />
                WhatsApp
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Phone className="h-4 w-4 text-muted-foreground" />
      <div className="flex-1 flex items-center gap-2">
        <Input
          ref={inputRef}
          value={localValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isSaving}
          maxLength={16}
          className={cn(
            "transition-all duration-200",
            isSaving && "opacity-50"
          )}
        />
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
