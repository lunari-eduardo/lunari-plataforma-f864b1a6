import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash, MessageSquare, Heart, Calendar, Baby } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

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
  const [isRelationshipOpen, setIsRelationshipOpen] = useState(true);
  const hasConjuge = formData.conjuge?.nome || formData.conjuge?.dataNascimento;
  const hasFilhos = formData.filhos && formData.filhos.length > 0;

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
    <div className="space-y-6">
      {/* Seção: Observações */}
      <div className="space-y-3">
        <Label htmlFor="observacoes" className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Observações
        </Label>
        <Textarea 
          id="observacoes" 
          value={formData.observacoes} 
          onChange={e => onUpdate('observacoes', e.target.value)} 
          disabled={!isEditing} 
          placeholder="Anotações importantes sobre o cliente, preferências, histórico..."
          rows={4} 
          className={`transition-all duration-200 resize-none ${
            isEditing ? 'focus:ring-2 focus:ring-lunar-primary/20' : 'bg-lunar-surface/50'
          }`}
        />
        {isEditing && (
          <p className="text-xs text-lunar-textSecondary">
            {formData.observacoes.length}/500 caracteres
          </p>
        )}
      </div>

      {/* Seção: Relacionamentos */}
      <Collapsible open={isRelationshipOpen} onOpenChange={setIsRelationshipOpen}>
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            className="w-full justify-between p-0 h-auto hover:bg-transparent"
          >
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-lunar-primary" />
              <span className="font-medium">Família</span>
              {(hasConjuge || hasFilhos) && (
                <div className="w-2 h-2 bg-lunar-primary rounded-full"></div>
              )}
            </div>
            <div className={`transition-transform duration-200 ${isRelationshipOpen ? 'rotate-180' : ''}`}>
              ▼
            </div>
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="space-y-4 pt-4">
          {/* Cônjuge */}
          <div className="space-y-3 p-4 bg-lunar-surface/30 rounded-lg border border-lunar-border/20">
            <div className="flex items-center gap-2 mb-3">
              <Heart className="h-3 w-3 text-lunar-primary" />
              <h4 className="text-sm font-medium">Cônjuge</h4>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="conjugeNome">Nome</Label>
                <Input 
                  id="conjugeNome" 
                  value={formData.conjuge?.nome || ''} 
                  onChange={e => onUpdateConjuge('nome', e.target.value)} 
                  disabled={!isEditing} 
                  placeholder="Nome do cônjuge"
                  className={`transition-all duration-200 ${
                    isEditing ? 'focus:ring-2 focus:ring-lunar-primary/20' : 'bg-lunar-surface/50'
                  }`}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="conjugeNascimento" className="flex items-center gap-2">
                  <Calendar className="h-3 w-3" />
                  Data de Nascimento
                </Label>
                <Input 
                  id="conjugeNascimento" 
                  type="date" 
                  value={formData.conjuge?.dataNascimento || ''} 
                  onChange={e => onUpdateConjuge('dataNascimento', e.target.value)} 
                  disabled={!isEditing}
                  className={`transition-all duration-200 ${
                    isEditing ? 'focus:ring-2 focus:ring-lunar-primary/20' : 'bg-lunar-surface/50'
                  }`}
                />
                {formData.conjuge?.dataNascimento && (
                  <p className="text-xs text-lunar-textSecondary">
                    {formatAge(formData.conjuge.dataNascimento)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Filhos */}
          <div className="space-y-3 p-4 bg-lunar-surface/30 rounded-lg border border-lunar-border/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Baby className="h-3 w-3 text-lunar-primary" />
                <h4 className="text-sm font-medium">Filhos</h4>
                {formData.filhos && formData.filhos.length > 0 && (
                  <span className="text-xs bg-lunar-primary/10 text-lunar-primary px-2 py-1 rounded-full">
                    {formData.filhos.length}
                  </span>
                )}
              </div>
              {isEditing && (
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={onAddFilho}
                  className="h-8 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" /> 
                  <span className="hidden sm:inline">Adicionar</span>
                </Button>
              )}
            </div>
            
            <div className="space-y-3">
              {(!formData.filhos || formData.filhos.length === 0) && (
                <p className="text-xs text-lunar-textSecondary italic py-2">
                  Nenhum filho cadastrado
                </p>
              )}
              {(formData.filhos || []).map((filho, index) => (
                <div 
                  key={filho.id} 
                  className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end p-3 bg-lunar-surface/50 rounded-lg border border-lunar-border/10"
                >
                  <div className="lg:col-span-5 space-y-2">
                    <Label className="text-xs">Nome do {index + 1}º filho</Label>
                    <Input 
                      value={filho.nome || ''} 
                      onChange={e => onUpdateFilho(filho.id, 'nome', e.target.value)} 
                      disabled={!isEditing} 
                      placeholder="Nome do filho"
                      className={`transition-all duration-200 ${
                        isEditing ? 'focus:ring-2 focus:ring-lunar-primary/20' : 'bg-lunar-surface/50'
                      }`}
                    />
                  </div>
                  <div className="lg:col-span-4 space-y-2">
                    <Label className="text-xs flex items-center gap-1">
                      <Calendar className="h-2 w-2" />
                      Data de Nascimento
                    </Label>
                    <Input 
                      type="date" 
                      value={filho.dataNascimento || ''} 
                      onChange={e => onUpdateFilho(filho.id, 'dataNascimento', e.target.value)} 
                      disabled={!isEditing}
                      className={`transition-all duration-200 ${
                        isEditing ? 'focus:ring-2 focus:ring-lunar-primary/20' : 'bg-lunar-surface/50'
                      }`}
                    />
                    {filho.dataNascimento && (
                      <p className="text-xs text-lunar-textSecondary">
                        {formatAge(filho.dataNascimento)}
                      </p>
                    )}
                  </div>
                  {isEditing && (
                    <div className="lg:col-span-3 flex justify-end">
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => onRemoveFilho(filho.id)}
                        className="h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash className="h-3 w-3 mr-1" /> 
                        <span className="hidden sm:inline">Remover</span>
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}