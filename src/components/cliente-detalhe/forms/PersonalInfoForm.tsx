import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, User } from "lucide-react";

interface PersonalInfoFormProps {
  formData: {
    nome: string;
    dataNascimento: string;
  };
  isEditing: boolean;
  onUpdate: (field: string, value: string) => void;
}

export function PersonalInfoForm({ formData, isEditing, onUpdate }: PersonalInfoFormProps) {
  const getClientInitials = (nome: string) => {
    return nome
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatAge = (birthDate: string) => {
    if (!birthDate) return '';
    const today = new Date();
    const birth = new Date(birthDate);
    const age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      return `${age - 1} anos`;
    }
    return `${age} anos`;
  };

  return (
    <div className="space-y-4">
      {/* Client Avatar Section */}
      <div className="flex items-center gap-4 p-4 bg-lunar-surface/50 rounded-lg border border-lunar-border/30">
        <div className="w-16 h-16 rounded-full bg-lunar-primary/10 flex items-center justify-center text-xl font-semibold text-lunar-primary">
          {formData.nome ? getClientInitials(formData.nome) : <User className="h-6 w-6" />}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-lunar-text truncate">
            {formData.nome || 'Nome não informado'}
          </h4>
          {formData.dataNascimento && (
            <p className="text-sm text-lunar-textSecondary">
              {formatAge(formData.dataNascimento)}
            </p>
          )}
        </div>
      </div>

      {/* Form Fields */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nome" className="flex items-center gap-2">
            <User className="h-3 w-3" />
            Nome *
          </Label>
          <Input 
            id="nome" 
            value={formData.nome} 
            onChange={e => onUpdate('nome', e.target.value)} 
            disabled={!isEditing} 
            placeholder="Nome completo do cliente"
            className={`transition-all duration-200 ${
              isEditing ? 'focus:ring-2 focus:ring-lunar-primary/20' : 'bg-lunar-surface/50'
            }`}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dataNascimento" className="flex items-center gap-2">
            <Calendar className="h-3 w-3" />
            Data de Nascimento
          </Label>
          <Input 
            id="dataNascimento" 
            type="date" 
            value={formData.dataNascimento} 
            onChange={e => onUpdate('dataNascimento', e.target.value)} 
            disabled={!isEditing}
            className={`transition-all duration-200 ${
              isEditing ? 'focus:ring-2 focus:ring-lunar-primary/20' : 'bg-lunar-surface/50'
            }`}
          />
        </div>
      </div>
    </div>
  );
}