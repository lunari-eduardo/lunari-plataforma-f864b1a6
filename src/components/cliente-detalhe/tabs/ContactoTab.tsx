import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit3, Save, User, Phone, Heart, MessageSquare } from "lucide-react";
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
export function ContactoTab({
  cliente,
  onUpdate
}: ContactoTabProps) {
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
  const ActionButtons = () => <div className="flex gap-2 flex-wrap">
      {!isEditing ? <Button onClick={() => setIsEditing(true)} variant="outline" size="sm" className="min-w-fit">
          <Edit3 className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Editar</span>
        </Button> : <>
          <Button onClick={handleSave} size="sm" className="min-w-fit">
            <Save className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Salvar</span>
          </Button>
          <Button onClick={handleCancel} variant="outline" size="sm" className="min-w-fit">
            <span className="hidden sm:inline">Cancelar</span>
            <span className="sm:hidden">✕</span>
          </Button>
        </>}
    </div>;
  return <div className="space-y-4 md:space-y-6">
      {/* Header Card */}
      <Card className="transition-all duration-200 hover:shadow-md">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-lunar-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-lunar-primary" />
            </div>
            <div>
              <CardTitle className="text-sm">Informações de Contacto</CardTitle>
              <CardDescription className="text-xs">
                Gerencie os dados básicos do cliente
              </CardDescription>
            </div>
          </div>
          <ActionButtons />
        </CardHeader>
      </Card>

      {/* Personal Info Card */}
      <Card className="transition-all duration-200 hover:shadow-md">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-lunar-primary" />
            <CardTitle className="text-sm">Informações Pessoais</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <PersonalInfoForm formData={{
          nome: formData.nome,
          dataNascimento: formData.dataNascimento
        }} isEditing={isEditing} onUpdate={updateFormData} />
        </CardContent>
      </Card>

      {/* Contact Info Card */}
      <Card className="transition-all duration-200 hover:shadow-md">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-lunar-primary" />
            <CardTitle className="text-base">Contatos e Endereço</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ContactInfoForm formData={{
          telefone: formData.telefone,
          email: formData.email,
          endereco: formData.endereco,
          origem: formData.origem
        }} isEditing={isEditing} onUpdate={updateFormData} />
        </CardContent>
      </Card>

      {/* Relationship Info Card */}
      <Card className="transition-all duration-200 hover:shadow-md">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-lunar-primary" />
            <CardTitle className="text-base">Relacionamentos</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <RelationshipForm formData={{
          observacoes: formData.observacoes,
          conjuge: formData.conjuge,
          filhos: formData.filhos
        }} isEditing={isEditing} onUpdate={updateFormData} onUpdateConjuge={updateConjuge} onUpdateFilho={updateFilho} onAddFilho={addFilho} onRemoveFilho={removeFilho} />
        </CardContent>
      </Card>
    </div>;
}