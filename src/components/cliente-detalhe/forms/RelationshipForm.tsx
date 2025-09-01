import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash } from "lucide-react";

interface RelationshipFormProps {
  formData: {
    observacoes: string;
    conjuge: { nome?: string; dataNascimento?: string };
    filhos: { id: string; nome?: string; dataNascimento?: string }[];
  };
  isEditing: boolean;
  onUpdate: (field: string, value: string) => void;
  onUpdateConjuge: (field: string, value: string) => void;
  onUpdateFilho: (filhoId: string, field: string, value: string) => void;
  onAddFilho: () => void;
  onRemoveFilho: (id: string) => void;
}

export function RelationshipForm({ 
  formData, 
  isEditing, 
  onUpdate, 
  onUpdateConjuge, 
  onUpdateFilho, 
  onAddFilho, 
  onRemoveFilho 
}: RelationshipFormProps) {
  return (
    <div className="space-y-6">
      {/* Seção: Observações */}
      <div className="space-y-2">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea 
          id="observacoes" 
          value={formData.observacoes} 
          onChange={e => onUpdate('observacoes', e.target.value)} 
          disabled={!isEditing} 
          placeholder="Observações sobre o cliente..." 
          rows={4} 
        />
      </div>

      {/* Seção: Relacionamentos */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="conjugeNome">Cônjuge - Nome</Label>
            <Input 
              id="conjugeNome" 
              value={formData.conjuge?.nome || ''} 
              onChange={e => onUpdateConjuge('nome', e.target.value)} 
              disabled={!isEditing} 
              placeholder="Nome do cônjuge" 
            />
          </div>
          <div>
            <Label htmlFor="conjugeNascimento">Cônjuge - Data de Nascimento</Label>
            <Input 
              id="conjugeNascimento" 
              type="date" 
              value={formData.conjuge?.dataNascimento || ''} 
              onChange={e => onUpdateConjuge('dataNascimento', e.target.value)} 
              disabled={!isEditing} 
            />
          </div>
        </div>

        {/* Filhos */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Filhos</h4>
            {isEditing && (
              <Button type="button" variant="outline" size="sm" onClick={onAddFilho}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar filho
              </Button>
            )}
          </div>
          <div className="space-y-3">
            {(formData.filhos || []).length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum filho cadastrado</p>
            )}
            {(formData.filhos || []).map((filho) => (
              <div key={filho.id} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                <div className="md:col-span-2">
                  <Label>Nome</Label>
                  <Input 
                    value={filho.nome || ''} 
                    onChange={e => onUpdateFilho(filho.id, 'nome', e.target.value)} 
                    disabled={!isEditing} 
                    placeholder="Nome do filho" 
                  />
                </div>
                <div>
                  <Label>Data de Nascimento</Label>
                  <Input 
                    type="date" 
                    value={filho.dataNascimento || ''} 
                    onChange={e => onUpdateFilho(filho.id, 'dataNascimento', e.target.value)} 
                    disabled={!isEditing} 
                  />
                </div>
                {isEditing && (
                  <div className="md:col-span-2 flex justify-end">
                    <Button type="button" variant="ghost" size="sm" onClick={() => onRemoveFilho(filho.id)}>
                      <Trash className="h-4 w-4 mr-1" /> Remover
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}