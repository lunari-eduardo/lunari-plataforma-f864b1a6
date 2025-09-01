import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PersonalInfoFormProps {
  formData: {
    nome: string;
    dataNascimento: string;
  };
  isEditing: boolean;
  onUpdate: (field: string, value: string) => void;
}

export function PersonalInfoForm({ formData, isEditing, onUpdate }: PersonalInfoFormProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">Informações Pessoais</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-1">
          <Label htmlFor="nome">Nome *</Label>
          <Input 
            id="nome" 
            value={formData.nome} 
            onChange={e => onUpdate('nome', e.target.value)} 
            disabled={!isEditing} 
            placeholder="Nome completo" 
          />
        </div>
        <div>
          <Label htmlFor="dataNascimento">Data de Nascimento</Label>
          <Input 
            id="dataNascimento" 
            type="date" 
            value={formData.dataNascimento} 
            onChange={e => onUpdate('dataNascimento', e.target.value)} 
            disabled={!isEditing} 
          />
        </div>
      </div>
    </div>
  );
}