import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { formatCpfCnpj } from '@/utils/userUtils';
import { UserProfile } from '@/services/ProfileService';

interface PersonalInfoFormProps {
  formData: Partial<UserProfile>;
  onChange: (field: keyof UserProfile, value: string) => void;
  errors?: Record<string, string>;
  userEmail?: string;
}

export function PersonalInfoForm({ formData, onChange, errors, userEmail }: PersonalInfoFormProps) {
  const handleCpfCnpjChange = (value: string) => {
    const formatted = formatCpfCnpj(value);
    onChange('cpf_cnpj', formatted);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome Completo *</Label>
          <Input 
            id="nome" 
            value={formData.nome || ''} 
            onChange={e => onChange('nome', e.target.value)} 
            placeholder="Seu nome completo"
            className={errors?.nome ? 'border-destructive' : ''}
          />
          {errors?.nome && (
            <p className="text-sm text-destructive">{errors.nome}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="empresa">Nome da Empresa (Fantasia)</Label>
          <Input 
            id="empresa" 
            value={formData.empresa || ''} 
            onChange={e => onChange('empresa', e.target.value)} 
            placeholder="Nome fantasia da empresa" 
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cpf_cnpj">CPF/CNPJ</Label>
        <Input 
          id="cpf_cnpj" 
          value={formData.cpf_cnpj || ''} 
          onChange={e => handleCpfCnpjChange(e.target.value)} 
          placeholder="000.000.000-00 ou 00.000.000/0000-00" 
          maxLength={18}
          className={errors?.cpf_cnpj ? 'border-destructive' : ''}
        />
        {errors?.cpf_cnpj && (
          <p className="text-sm text-destructive">{errors.cpf_cnpj}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input 
          id="email" 
          type="email" 
          value={userEmail || formData.email || ''} 
          disabled
          className="bg-muted/50 cursor-not-allowed"
        />
        <p className="text-xs text-muted-foreground">
          Este é o email usado para login e não pode ser alterado
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="endereco_comercial">Endereço Comercial</Label>
        <Textarea 
          id="endereco_comercial" 
          value={formData.endereco_comercial || ''} 
          onChange={e => onChange('endereco_comercial', e.target.value)} 
          placeholder="Endereço completo do estúdio/escritório" 
          rows={3} 
        />
      </div>
    </div>
  );
}