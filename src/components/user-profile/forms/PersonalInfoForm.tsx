import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { formatCpfCnpj } from '@/utils/userUtils';
import { UserProfile } from '@/types/userProfile';

interface PersonalInfoFormProps {
  formData: Partial<UserProfile>;
  onChange: (field: keyof UserProfile, value: string) => void;
  errors?: Record<string, string>;
}

export function PersonalInfoForm({ formData, onChange, errors }: PersonalInfoFormProps) {
  const handleCpfCnpjChange = (value: string) => {
    const formatted = formatCpfCnpj(value);
    onChange('cpfCnpj', formatted);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nomeCompleto">Nome Completo *</Label>
          <Input 
            id="nomeCompleto" 
            value={formData.nomeCompleto || ''} 
            onChange={e => onChange('nomeCompleto', e.target.value)} 
            placeholder="Seu nome completo"
            className={errors?.nomeCompleto ? 'border-destructive' : ''}
          />
          {errors?.nomeCompleto && (
            <p className="text-sm text-destructive">{errors.nomeCompleto}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="nomeEmpresa">Nome da Empresa (Fantasia)</Label>
          <Input 
            id="nomeEmpresa" 
            value={formData.nomeEmpresa || ''} 
            onChange={e => onChange('nomeEmpresa', e.target.value)} 
            placeholder="Nome fantasia da empresa" 
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cpfCnpj">CPF/CNPJ</Label>
        <Input 
          id="cpfCnpj" 
          value={formData.cpfCnpj || ''} 
          onChange={e => handleCpfCnpjChange(e.target.value)} 
          placeholder="000.000.000-00 ou 00.000.000/0000-00" 
          maxLength={18}
          className={errors?.cpfCnpj ? 'border-destructive' : ''}
        />
        {errors?.cpfCnpj && (
          <p className="text-sm text-destructive">{errors.cpfCnpj}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="emailPrincipal">E-mail Principal de Contato</Label>
        <Input 
          id="emailPrincipal" 
          type="email" 
          value={formData.emailPrincipal || ''} 
          onChange={e => onChange('emailPrincipal', e.target.value)} 
          placeholder="seu@email.com"
          className={errors?.emailPrincipal ? 'border-destructive' : ''}
        />
        {errors?.emailPrincipal && (
          <p className="text-sm text-destructive">{errors.emailPrincipal}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="enderecoComercial">Endereço Comercial</Label>
        <Textarea 
          id="enderecoComercial" 
          value={formData.enderecoComercial || ''} 
          onChange={e => onChange('enderecoComercial', e.target.value)} 
          placeholder="Endereço completo do estúdio/escritório" 
          rows={3} 
        />
      </div>
    </div>
  );
}