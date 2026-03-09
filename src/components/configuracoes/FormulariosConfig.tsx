import { useState } from 'react';
import { Plus, FileText, Copy, Pencil, Trash2, Crown, Clock, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import ConfigSectionHeader from './ConfigSectionHeader';
import FormularioTemplateEditor from './FormularioTemplateEditor';
import { useFormularioTemplates } from '@/hooks/useFormularioTemplates';
import { FormularioTemplate, CATEGORIA_LABELS } from '@/types/formulario';

export default function FormulariosConfig() {
  const {
    systemTemplates,
    customTemplates,
    isLoading,
    deleteTemplate,
    duplicateTemplate,
    isDeleting,
  } = useFormularioTemplates();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<FormularioTemplate | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<FormularioTemplate | null>(null);

  const handleEdit = (template: FormularioTemplate) => {
    setEditingTemplate(template);
    setEditorOpen(true);
  };

  const handleCreate = () => {
    setEditingTemplate(null);
    setEditorOpen(true);
  };

  const handleDuplicate = async (template: FormularioTemplate) => {
    await duplicateTemplate(template);
  };

  const handleDeleteClick = (template: FormularioTemplate) => {
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (templateToDelete) {
      await deleteTemplate(templateToDelete.id);
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    }
  };

  const handleEditorClose = () => {
    setEditorOpen(false);
    setEditingTemplate(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <ConfigSectionHeader
        title="Templates de Formulários"
        subtitle="Crie e gerencie templates de briefing para enviar aos seus clientes antes das sessões."
        action={
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Template
          </Button>
        }
      />

      {/* Templates do Sistema */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-primary" />
          <h4 className="font-medium text-foreground">Templates Prontos</h4>
          <Badge variant="secondary" className="text-xs">
            {systemTemplates.length} disponíveis
          </Badge>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2">
          {systemTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              isSystem
              onDuplicate={() => handleDuplicate(template)}
            />
          ))}
        </div>
      </div>

      {/* Templates Customizados */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-medium text-foreground">Meus Templates</h4>
          <Badge variant="outline" className="text-xs">
            {customTemplates.length}
          </Badge>
        </div>

        {customTemplates.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                Você ainda não criou nenhum template personalizado.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Duplique um template pronto ou crie do zero.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {customTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onEdit={() => handleEdit(template)}
                onDuplicate={() => handleDuplicate(template)}
                onDelete={() => handleDeleteClick(template)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Editor Modal */}
      <FormularioTemplateEditor
        open={editorOpen}
        onOpenChange={handleEditorClose}
        template={editingTemplate}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
            <AlertDialogDescription>
              O template "{templateToDelete?.nome}" será excluído permanentemente.
              Formulários já criados a partir deste template não serão afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface TemplateCardProps {
  template: FormularioTemplate;
  isSystem?: boolean;
  onEdit?: () => void;
  onDuplicate: () => void;
  onDelete?: () => void;
}

function TemplateCard({ template, isSystem, onEdit, onDuplicate, onDelete }: TemplateCardProps) {
  return (
    <Card className="group transition-colors hover:border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1 min-w-0">
            <CardTitle className="text-base font-medium truncate">
              {template.nome}
            </CardTitle>
            <CardDescription className="line-clamp-2 text-xs">
              {template.descricao || 'Sem descrição'}
            </CardDescription>
          </div>
          <Badge 
            variant={isSystem ? 'default' : 'outline'} 
            className="ml-2 shrink-0 text-xs"
          >
            {CATEGORIA_LABELS[template.categoria]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {template.campos.length} campos
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              ~{template.tempo_estimado} min
            </span>
          </div>
          
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {!isSystem && onEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onEdit}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onDuplicate}
              title={isSystem ? 'Usar como base' : 'Duplicar'}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            {!isSystem && onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
