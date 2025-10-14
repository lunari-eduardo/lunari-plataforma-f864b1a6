import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ORIGENS_PADRAO } from '@/utils/defaultOrigens';
import { getOriginDisplayName } from '@/utils/originUtils';
import { Phone, Mail, MapPin, Users } from "lucide-react";

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
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string) => {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/\D/g, ''));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Telefone */}
        <div className="space-y-2">
          <Label htmlFor="telefone" className="flex items-center gap-2">
            <Phone className="h-3 w-3" />
            Telefone
          </Label>
          <Input 
            id="telefone" 
            value={formData.telefone} 
            onChange={e => onUpdate('telefone', e.target.value)} 
            disabled={!isEditing} 
            placeholder="+55 (11) 99999-9999"
            className={`transition-all duration-200 ${
              isEditing ? 'focus:ring-2 focus:ring-lunar-primary/20' : 'bg-lunar-surface/50'
            } ${
              isEditing && formData.telefone && !validatePhone(formData.telefone) 
                ? 'border-red-300 focus:border-red-500' 
                : ''
            }`}
          />
          {isEditing && formData.telefone && !validatePhone(formData.telefone) && (
            <p className="text-xs text-red-500">Formato de telefone inválido</p>
          )}
        </div>

        {/* E-mail */}
        <div className="space-y-2">
          <Label htmlFor="email" className="flex items-center gap-2">
            <Mail className="h-3 w-3" />
            E-mail
          </Label>
          <Input 
            id="email" 
            type="email" 
            value={formData.email} 
            onChange={e => onUpdate('email', e.target.value)} 
            disabled={!isEditing} 
            placeholder="cliente@exemplo.com"
            className={`transition-all duration-200 ${
              isEditing ? 'focus:ring-2 focus:ring-lunar-primary/20' : 'bg-lunar-surface/50'
            } ${
              isEditing && formData.email && !validateEmail(formData.email) 
                ? 'border-red-300 focus:border-red-500' 
                : ''
            }`}
          />
          {isEditing && formData.email && !validateEmail(formData.email) && (
            <p className="text-xs text-red-500">Formato de e-mail inválido</p>
          )}
        </div>
      </div>

      {/* Endereço */}
      <div className="space-y-2">
        <Label htmlFor="endereco" className="flex items-center gap-2">
          <MapPin className="h-3 w-3" />
          Endereço
        </Label>
        <Input 
          id="endereco" 
          value={formData.endereco} 
          onChange={e => onUpdate('endereco', e.target.value)} 
          disabled={!isEditing} 
          placeholder="Rua, número, bairro, cidade - CEP"
          className={`transition-all duration-200 ${
            isEditing ? 'focus:ring-2 focus:ring-lunar-primary/20' : 'bg-lunar-surface/50'
          }`}
        />
      </div>

      {/* Origem */}
      <div className="space-y-2">
        <Label htmlFor="origem" className="flex items-center gap-2">
          <Users className="h-3 w-3" />
          Como conheceu?
        </Label>
        {isEditing ? (
          <Select value={formData.origem} onValueChange={(value) => onUpdate('origem', value)}>
            <SelectTrigger id="origem" className="focus:ring-2 focus:ring-lunar-primary/20">
              <SelectValue placeholder="Selecione como o cliente conheceu você" />
            </SelectTrigger>
            <SelectContent className="bg-lunar-surface border-lunar-border">
              {ORIGENS_PADRAO.map(origem => (
                <SelectItem key={origem.id} value={origem.id} className="hover:bg-lunar-surface/80">
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
            value={getOriginDisplayName(formData.origem) || 'Origem não informada'} 
            disabled 
            className="bg-lunar-surface/50"
          />
        )}
      </div>
    </div>
  );
}