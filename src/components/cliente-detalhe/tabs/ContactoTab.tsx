import { memo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit3, Save, Plus, Trash } from 'lucide-react';
import { Cliente } from '@/types/orcamentos';
import { useClientForm } from '../hooks/useClientForm';
import { ORIGENS_PADRAO } from '@/utils/defaultOrigens';
import { getOriginDisplayName } from '@/utils/originUtils';

interface ContactoTabProps {
  cliente: Cliente;
}

export const ContactoTab = memo(({ cliente }: ContactoTabProps) => {
  const {
    formData,
    isEditing,
    setIsEditing,
    handleSave,
    handleCancel,
    addFilho,
    removeFilho,
    updateFormData,
    updateFilho,
    updateConjuge
  } = useClientForm(cliente);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Informações de Contacto</CardTitle>
          <CardDescription>
            Gerencie os dados básicos do cliente
          </CardDescription>
        </div>
        {!isEditing ? (
          <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
            <Edit3 className="h-4 w-4 mr-2" />
            Editar
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button onClick={handleSave} size="sm">
              <Save className="h-4 w-4 mr-2" />
              Salvar
            </Button>
            <Button onClick={handleCancel} variant="outline" size="sm">
              Cancelar
            </Button>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Personal Information Section */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Informações Pessoais
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-1">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => updateFormData({ nome: e.target.value })}
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
                onChange={(e) => updateFormData({ dataNascimento: e.target.value })}
                disabled={!isEditing}
              />
            </div>
          </div>
        </div>

        {/* Contact and Address Section */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Contatos e Endereço
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="telefone">Telefone *</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) => updateFormData({ telefone: e.target.value })}
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
                onChange={(e) => updateFormData({ email: e.target.value })}
                disabled={!isEditing}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="endereco">Endereço</Label>
              <Input
                id="endereco"
                value={formData.endereco}
                onChange={(e) => updateFormData({ endereco: e.target.value })}
                disabled={!isEditing}
                placeholder="Endereço completo"
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="origem">Como conheceu?</Label>
              {isEditing ? (
                <Select 
                  value={formData.origem} 
                  onValueChange={(value) => updateFormData({ origem: value })}
                >
                  <SelectTrigger id="origem">
                    <SelectValue placeholder="Selecione a origem" />
                  </SelectTrigger>
                  <SelectContent>
                    {ORIGENS_PADRAO.map(origem => (
                      <SelectItem key={origem.id} value={origem.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: origem.cor }} 
                          />
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

        {/* Observations Section */}
        <div className="space-y-2">
          <Label htmlFor="observacoes">Observações</Label>
          <Textarea
            id="observacoes"
            value={formData.observacoes}
            onChange={(e) => updateFormData({ observacoes: e.target.value })}
            disabled={!isEditing}
            placeholder="Observações sobre o cliente..."
            rows={4}
          />
        </div>

        {/* Relationships Section */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Relacionamentos
          </h3>
          
          {/* Spouse */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="conjugeNome">Cônjuge - Nome</Label>
              <Input
                id="conjugeNome"
                value={formData.conjuge?.nome || ''}
                onChange={(e) => updateConjuge({ nome: e.target.value })}
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
                onChange={(e) => updateConjuge({ dataNascimento: e.target.value })}
                disabled={!isEditing}
              />
            </div>
          </div>

          {/* Children */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Filhos</h4>
              {isEditing && (
                <Button type="button" variant="outline" size="sm" onClick={addFilho}>
                  <Plus className="h-4 w-4 mr-1" /> 
                  Adicionar filho
                </Button>
              )}
            </div>
            <div className="space-y-3">
              {(formData.filhos || []).length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhum filho cadastrado
                </p>
              )}
              {(formData.filhos || []).map((filho) => (
                <div key={filho.id} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                  <div className="md:col-span-2">
                    <Label>Nome</Label>
                    <Input
                      value={filho.nome || ''}
                      onChange={(e) => updateFilho(filho.id, { nome: e.target.value })}
                      disabled={!isEditing}
                      placeholder="Nome do filho"
                    />
                  </div>
                  <div>
                    <Label>Data de Nascimento</Label>
                    <Input
                      type="date"
                      value={filho.dataNascimento || ''}
                      onChange={(e) => updateFilho(filho.id, { dataNascimento: e.target.value })}
                      disabled={!isEditing}
                    />
                  </div>
                  {isEditing && (
                    <div className="md:col-span-2 flex justify-end">
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => removeFilho(filho.id)}
                      >
                        <Trash className="h-4 w-4 mr-1" /> 
                        Remover
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

ContactoTab.displayName = 'ContactoTab';