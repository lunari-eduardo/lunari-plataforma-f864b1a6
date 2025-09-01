import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit3, Save } from "lucide-react";
import { PersonalInfoForm } from '../forms/PersonalInfoForm';
import { ContactInfoForm } from '../forms/ContactInfoForm';
import { RelationshipForm } from '../forms/RelationshipForm';
import { useClientForm } from '../hooks/useClientForm';

interface Cliente {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  endereco?: string;
  observacoes?: string;
  origem?: string;
  dataNascimento?: string;
}

interface ContactoTabProps {
  cliente: Cliente;
  onUpdate: (id: string, data: any) => void;
}

export function ContactoTab({ cliente, onUpdate }: ContactoTabProps) {
  const {
    formData,
    isEditing,
    setIsEditing,
    handleSave,
    handleCancel,
    addFilho,
    removeFilho,
    updateFormData,
    updateConjuge,
    updateFilho
  } = useClientForm(cliente, onUpdate);

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
        {/* Seção: Informações Pessoais */}
        <PersonalInfoForm 
          formData={{
            nome: formData.nome,
            dataNascimento: formData.dataNascimento
          }}
          isEditing={isEditing}
          onUpdate={updateFormData}
        />

        {/* Seção: Contatos e Endereço */}
        <ContactInfoForm 
          formData={{
            telefone: formData.telefone,
            email: formData.email,
            endereco: formData.endereco,
            origem: formData.origem
          }}
          isEditing={isEditing}
          onUpdate={updateFormData}
        />

        {/* Seção: Relacionamentos e Observações */}
        <RelationshipForm 
          formData={{
            observacoes: formData.observacoes,
            conjuge: formData.conjuge,
            filhos: formData.filhos
          }}
          isEditing={isEditing}
          onUpdate={updateFormData}
          onUpdateConjuge={updateConjuge}
          onUpdateFilho={updateFilho}
          onAddFilho={addFilho}
          onRemoveFilho={removeFilho}
        />
      </CardContent>
    </Card>
  );
}