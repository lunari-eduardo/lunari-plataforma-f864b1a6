import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Plus, X } from 'lucide-react';
import { useArrayField } from '@/hooks/user-profile/useArrayField';
import { formatPhone } from '@/utils/userUtils';

interface ContactInfoSectionProps {
  telefones: string[];
  siteRedesSociais: string[];
  onTelefonesChange: (telefones: string[]) => void;
  onSitesChange: (sites: string[]) => void;
}

export function ContactInfoSection({ 
  telefones, 
  siteRedesSociais, 
  onTelefonesChange, 
  onSitesChange 
}: ContactInfoSectionProps) {
  const {
    items: telefonesItems,
    addItem: addTelefone,
    updateItem: updateTelefone,
    removeItem: removeTelefone
  } = useArrayField(telefones, onTelefonesChange);

  const {
    items: sitesItems,
    addItem: addSite,
    updateItem: updateSite,
    removeItem: removeSite
  } = useArrayField(siteRedesSociais, onSitesChange);

  return (
    <>
      <Separator />

      {/* Telefones */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>WhatsApp</Label>
          <Button type="button" variant="outline" size="sm" onClick={addTelefone}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>
        
        {telefonesItems.map((telefone, index) => (
          <div key={index} className="flex gap-2">
            <Input 
              value={telefone} 
              onChange={e => updateTelefone(index, formatPhone(e.target.value))} 
              placeholder="(00) 00000-0000" 
              maxLength={15} 
            />
            <Button 
              type="button" 
              variant="outline" 
              size="icon" 
              onClick={() => removeTelefone(index)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        
        {telefonesItems.length === 0 && (
          <p className="text-sm text-lunar-textSecondary">Nenhum telefone adicionado</p>
        )}
      </div>

      <Separator />

      {/* Site e Redes Sociais */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Site / Redes Sociais</Label>
          <Button type="button" variant="outline" size="sm" onClick={addSite}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>
        
        {sitesItems.map((site, index) => (
          <div key={index} className="flex gap-2">
            <Input 
              value={site} 
              onChange={e => updateSite(index, e.target.value)} 
              placeholder="https://www.exemplo.com ou @usuario" 
            />
            <Button 
              type="button" 
              variant="outline" 
              size="icon" 
              onClick={() => removeSite(index)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        
        {sitesItems.length === 0 && (
          <p className="text-sm text-lunar-textSecondary">Nenhum link adicionado</p>
        )}
      </div>
    </>
  );
}