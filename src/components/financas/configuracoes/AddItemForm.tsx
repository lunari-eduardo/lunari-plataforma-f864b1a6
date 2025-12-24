import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card className="bg-gradient-to-r from-lunar-accent/10 via-lunar-accent/5 to-transparent border-2 border-lunar-accent/40 shadow-md rounded-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Plus className="h-5 w-5" />
          Adicionar Novo Item Financeiro
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="nome-item">Nome do Item</Label>
            <Input 
              id="nome-item" 
              placeholder="Ex: Adobe, Combustível, etc." 
              value={novoItemNome} 
              onChange={e => onNomeChange(e.target.value)} 
              onKeyPress={handleKeyPress}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="grupo-item">Grupo Principal</Label>
            <Select value={novoItemGrupo} onValueChange={value => onGrupoChange(value as GrupoPrincipal)}>
              <SelectTrigger>
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
          </div>
          
          <div className="flex items-end">
            <Button onClick={onSubmit} className="w-1/2">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}