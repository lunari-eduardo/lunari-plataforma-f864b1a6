import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ORIGENS_PADRAO } from '@/utils/defaultOrigens';
import { getOriginDisplayName } from '@/utils/originUtils';

interface ContactInfoFormProps {
  formData: {
    telefone: string;
    email: string;
    endereco: string;
    origem: string;
  };
  isEditing: boolean;
  onUpdate: (field: string, value: string) => void;
}

export function ContactInfoForm({ formData, isEditing, onUpdate }: ContactInfoFormProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">Contatos e Endereço</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="telefone">Telefone *</Label>
          <Input 
            id="telefone" 
            value={formData.telefone} 
            onChange={e => onUpdate('telefone', e.target.value)} 
            disabled={!isEditing} 
            placeholder="+55 (DDD) 00000-0000" 
          />
        </div>
        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input 
            id="email" 
            type="email" 
            value={formData.email} 
            onChange={e => onUpdate('email', e.target.value)} 
            disabled={!isEditing} 
            placeholder="email@exemplo.com" 
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="endereco">Endereço</Label>
          <Input 
            id="endereco" 
            value={formData.endereco} 
            onChange={e => onUpdate('endereco', e.target.value)} 
            disabled={!isEditing} 
            placeholder="Endereço completo" 
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="origem">Como conheceu?</Label>
          {isEditing ? (
            <Select value={formData.origem} onValueChange={(value) => onUpdate('origem', value)}>
              <SelectTrigger id="origem">
                <SelectValue placeholder="Selecione a origem" />
              </SelectTrigger>
              <SelectContent>
                {ORIGENS_PADRAO.map(origem => (
                  <SelectItem key={origem.id} value={origem.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: origem.cor }} />
                      {origem.nome}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input 
              id="origem" 
              value={getOriginDisplayName(formData.origem)} 
              disabled 
              placeholder="Origem não informada" 
            />
          )}
        </div>
      </div>
    </div>
  );
}