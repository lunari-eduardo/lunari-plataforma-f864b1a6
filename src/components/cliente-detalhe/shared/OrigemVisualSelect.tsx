import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Check, Pencil, Instagram, Search, Users, Globe, History, Calendar, HelpCircle } from "lucide-react";
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { getOriginDisplayName } from '@/utils/originUtils';

interface OrigemVisualSelectProps {
  value: string;
  onSave: (value: string) => Promise<void>;
  className?: string;
}

const origens = [
  { id: 'instagram', nome: 'Instagram', icon: Instagram, cor: '#E1306C' },
  { id: 'google', nome: 'Google', icon: Search, cor: '#4285F4' },
  { id: 'facebook', nome: 'Facebook', icon: Globe, cor: '#1877F2' },
  { id: 'indicacao-cliente', nome: 'Indicação Cliente', icon: Users, cor: '#10B981' },
  { id: 'indicacao-parceiro', nome: 'Indicação Parceiro', icon: Users, cor: '#8B5CF6' },
  { id: 'website', nome: 'Website', icon: Globe, cor: '#F59E0B' },
  { id: 'cliente-antigo', nome: 'Cliente Antigo', icon: History, cor: '#06B6D4' },
  { id: 'evento-feira', nome: 'Evento/Feira', icon: Calendar, cor: '#84CC16' },
  { id: 'outro', nome: 'Outro', icon: HelpCircle, cor: '#6B7280' },
];

export function OrigemVisualSelect({
  value,
  onSave,
  className
}: OrigemVisualSelectProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const selectedOrigem = origens.find(o => o.id === value);
  const displayName = getOriginDisplayName(value) || 'Não informado';

  const handleSelect = async (origemId: string) => {
    if (origemId === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(origemId);
      toast.success('Salvo', { duration: 1500 });
      setIsEditing(false);
    } catch (error) {
      toast.error('Erro ao salvar');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isEditing) {
    return (
      <div 
        onClick={() => setIsEditing(true)}
        className={cn(
          "group flex items-center gap-2 cursor-pointer rounded-lg px-3 py-2 -mx-3 transition-all duration-200",
          "hover:bg-muted/50",
          className
        )}
      >
        {selectedOrigem ? (
          <>
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: selectedOrigem.cor }} 
            />
            <selectedOrigem.icon 
              className="h-4 w-4" 
              style={{ color: selectedOrigem.cor }} 
            />
            <span className="flex-1">{selectedOrigem.nome}</span>
          </>
        ) : (
          <>
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 text-muted-foreground italic">{displayName}</span>
          </>
        )}
        <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {origens.map(origem => {
          const Icon = origem.icon;
          const isSelected = value === origem.id;
          
          return (
            <button
              key={origem.id}
              onClick={() => handleSelect(origem.id)}
              disabled={isSaving}
              className={cn(
                "flex items-center gap-2 p-3 rounded-lg border transition-all text-left",
                isSelected 
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20" 
                  : "hover:bg-muted/50 border-border",
                isSaving && "opacity-50 cursor-not-allowed"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" style={{ color: origem.cor }} />
              <span className="text-sm truncate">{origem.nome}</span>
              {isSelected && (
                <Check className="h-3 w-3 text-primary ml-auto shrink-0" />
              )}
            </button>
          );
        })}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsEditing(false)}
        className="text-xs"
      >
        Cancelar
      </Button>
    </div>
  );
}
