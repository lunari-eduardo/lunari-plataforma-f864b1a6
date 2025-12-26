import { useState, useRef, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Check, X, Pencil, Trash, Heart, Baby, Calendar } from "lucide-react";
import { toast } from 'sonner';
import { cn } from "@/lib/utils";

interface FamilyMiniCardProps {
  id: string;
  nome: string;
  dataNascimento: string;
  tipo: 'conjuge' | 'filho';
  onSaveNome: (value: string) => Promise<void>;
  onSaveData: (value: string) => Promise<void>;
  onRemove?: () => Promise<void>;
  index?: number;
}

const formatAge = (birthDate: string) => {
  if (!birthDate) return '';
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  if (age < 1) {
    // Calcular meses para bebês
    let months = (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
    if (today.getDate() < birth.getDate()) months--;
    if (months <= 0) return 'Recém-nascido';
    return `${months} ${months === 1 ? 'mês' : 'meses'}`;
  }
  
  return `${age} ${age === 1 ? 'ano' : 'anos'}`;
};

export function FamilyMiniCard({
  id,
  nome,
  dataNascimento,
  tipo,
  onSaveNome,
  onSaveData,
  onRemove,
  index = 0
}: FamilyMiniCardProps) {
  const [editingField, setEditingField] = useState<'nome' | 'data' | null>(null);
  const [localNome, setLocalNome] = useState(nome);
  const [localData, setLocalData] = useState(dataNascimento);
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const Icon = tipo === 'conjuge' ? Heart : Baby;
  const bgColor = tipo === 'conjuge' 
    ? 'bg-rose-100 dark:bg-rose-900/30' 
    : 'bg-blue-100 dark:bg-blue-900/30';
  const iconColor = tipo === 'conjuge' ? 'text-rose-600' : 'text-blue-600';

  useEffect(() => {
    if (!editingField) {
      setLocalNome(nome);
      setLocalData(dataNascimento);
    }
  }, [nome, dataNascimento, editingField]);

  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingField]);

  const handleSaveNome = async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (localNome === nome) {
      setEditingField(null);
      return;
    }

    setIsSaving(true);
    try {
      await onSaveNome(localNome);
      toast.success('Salvo', { duration: 1500 });
      setEditingField(null);
    } catch (error) {
      toast.error('Erro ao salvar');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveData = async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (localData === dataNascimento) {
      setEditingField(null);
      return;
    }

    setIsSaving(true);
    try {
      await onSaveData(localData);
      toast.success('Salvo', { duration: 1500 });
      setEditingField(null);
    } catch (error) {
      toast.error('Erro ao salvar');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!onRemove) return;
    setIsRemoving(true);
    try {
      await onRemove();
      toast.success('Removido', { duration: 1500 });
    } catch (error) {
      toast.error('Erro ao remover');
      setIsRemoving(false);
    }
  };

  const handleNomeChange = (value: string) => {
    setLocalNome(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (value !== nome) {
        setIsSaving(true);
        try {
          await onSaveNome(value);
          toast.success('Salvo', { duration: 1500 });
        } catch (error) {
          toast.error('Erro ao salvar');
        } finally {
          setIsSaving(false);
        }
      }
    }, 800);
  };

  const handleDataChange = (value: string) => {
    setLocalData(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (value !== dataNascimento) {
        setIsSaving(true);
        try {
          await onSaveData(value);
          toast.success('Salvo', { duration: 1500 });
        } catch (error) {
          toast.error('Erro ao salvar');
        } finally {
          setIsSaving(false);
        }
      }
    }, 800);
  };

  const handleKeyDown = (e: React.KeyboardEvent, saveHandler: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveHandler();
    }
    if (e.key === 'Escape') {
      setLocalNome(nome);
      setLocalData(dataNascimento);
      setEditingField(null);
    }
  };

  const age = formatAge(dataNascimento);

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-xl border transition-all",
      "bg-gradient-to-r from-background to-muted/30",
      "hover:shadow-sm",
      isRemoving && "opacity-50"
    )}>
      <Avatar className={cn("h-10 w-10", bgColor)}>
        <AvatarFallback className={cn("bg-transparent", iconColor)}>
          <Icon className="h-5 w-5" />
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0 space-y-1">
        {/* Nome */}
        {editingField === 'nome' ? (
          <div className="flex items-center gap-1">
            <Input
              ref={inputRef}
              value={localNome}
              onChange={(e) => handleNomeChange(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, handleSaveNome)}
              placeholder={tipo === 'conjuge' ? 'Nome do cônjuge' : `Nome do ${index + 1}º filho`}
              disabled={isSaving}
              className="h-7 text-sm"
            />
            <Button size="icon" variant="ghost" onClick={handleSaveNome} disabled={isSaving} className="h-7 w-7">
              <Check className="h-3 w-3 text-green-600" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => { setLocalNome(nome); setEditingField(null); }} className="h-7 w-7">
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div 
            onClick={() => setEditingField('nome')}
            className="group flex items-center gap-1 cursor-pointer"
          >
            <span className={cn(
              "font-medium text-sm truncate",
              !nome && "text-muted-foreground italic"
            )}>
              {nome || (tipo === 'conjuge' ? 'Nome do cônjuge' : `Nome do ${index + 1}º filho`)}
            </span>
            <Pencil className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </div>
        )}

        {/* Data de nascimento */}
        {editingField === 'data' ? (
          <div className="flex items-center gap-1">
            <Input
              ref={inputRef}
              type="date"
              value={localData}
              onChange={(e) => handleDataChange(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, handleSaveData)}
              disabled={isSaving}
              className="h-7 text-xs"
            />
            <Button size="icon" variant="ghost" onClick={handleSaveData} disabled={isSaving} className="h-7 w-7">
              <Check className="h-3 w-3 text-green-600" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => { setLocalData(dataNascimento); setEditingField(null); }} className="h-7 w-7">
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div 
            onClick={() => setEditingField('data')}
            className="group flex items-center gap-1 cursor-pointer"
          >
            <Calendar className="h-3 w-3 text-muted-foreground" />
            <span className={cn(
              "text-xs",
              dataNascimento ? "text-muted-foreground" : "text-muted-foreground/60 italic"
            )}>
              {dataNascimento ? (
                <>
                  {new Date(dataNascimento + 'T00:00:00').toLocaleDateString('pt-BR')}
                  {age && <span className="ml-1">• {age}</span>}
                </>
              ) : (
                'Data de nascimento'
              )}
            </span>
            <Pencil className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </div>
        )}
      </div>

      {/* Botão remover (apenas para filhos) */}
      {onRemove && tipo === 'filho' && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRemove}
          disabled={isRemoving}
          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
        >
          <Trash className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
