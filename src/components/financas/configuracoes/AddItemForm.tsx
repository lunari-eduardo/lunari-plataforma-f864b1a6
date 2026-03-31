import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { GrupoPrincipal } from '@/types/financas';
import { FINANCIAL_GROUPS } from '@/constants/financialConstants';

interface AddItemFormProps {
  novoItemNome: string;
  novoItemGrupo: GrupoPrincipal;
  onNomeChange: (nome: string) => void;
  onGrupoChange: (grupo: GrupoPrincipal) => void;
  onSubmit: () => void;
}

export function AddItemForm({
  novoItemNome,
  novoItemGrupo,
  onNomeChange,
  onGrupoChange,
  onSubmit
}: AddItemFormProps) {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSubmit();
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-3 bg-muted/30 border border-border/50 rounded-lg">
      <Input
        placeholder="Digite um novo item financeiro..."
        value={novoItemNome}
        onChange={e => onNomeChange(e.target.value)}
        onKeyPress={handleKeyPress}
        className="flex-1 bg-background border-border/50 h-9 text-sm"
      />
      
      <Select value={novoItemGrupo} onValueChange={value => onGrupoChange(value as GrupoPrincipal)}>
        <SelectTrigger className="w-full sm:w-[200px] h-9 text-sm bg-background border-border/50">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FINANCIAL_GROUPS.map(grupo => (
            <SelectItem key={grupo} value={grupo}>
              {grupo}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <Button 
        onClick={onSubmit} 
        disabled={!novoItemNome.trim()}
        size="sm"
        className="h-9 px-4 shrink-0"
      >
        <Plus className="h-4 w-4 mr-1.5" />
        Adicionar
      </Button>
    </div>
  );
}
