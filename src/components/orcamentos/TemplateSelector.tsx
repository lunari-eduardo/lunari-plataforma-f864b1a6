
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Save, Edit, Trash2, Settings } from 'lucide-react';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { useToast } from '@/hooks/use-toast';
import { Template } from '@/types/orcamentos';

interface TemplateSelectorProps {
  value: string;
  onChange: (value: string) => void;
  onSelectTemplate: (template: any) => void;
}

export default function TemplateSelector({ value, onChange, onSelectTemplate }: TemplateSelectorProps) {
  const { templates, adicionarTemplate, atualizarTemplate, excluirTemplate, categorias } = useOrcamentos();
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    nome: '',
    categoria: '',
    conteudo: value
  });
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  const salvarTemplate = () => {
    if (!templateForm.nome.trim()) {
      toast({
        title: "Erro",
        description: "Nome do template é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (editingTemplate) {
      atualizarTemplate(editingTemplate.id, {
        nome: templateForm.nome,
        categoria: templateForm.categoria || undefined,
        conteudo: templateForm.conteudo
      });
      toast({
        title: "Sucesso",
        description: "Template atualizado com sucesso!",
      });
    } else {
      adicionarTemplate({
        nome: templateForm.nome,
        categoria: templateForm.categoria || undefined,
        conteudo: templateForm.conteudo,
        isPadrao: false
      });
      toast({
        title: "Sucesso",
        description: "Template salvo com sucesso!",
      });
    }

    setShowModal(false);
    setEditingTemplate(null);
    setTemplateForm({ nome: '', categoria: '', conteudo: value });
  };

  const editarTemplate = (template: Template) => {
    setEditingTemplate(template);
    setTemplateForm({
      nome: template.nome,
      categoria: template.categoria || '',
      conteudo: template.conteudo
    });
    setShowModal(true);
    setShowManagerModal(false);
  };

  const excluirTemplateConfirmar = (templateId: string) => {
    excluirTemplate(templateId);
    toast({
      title: "Sucesso",
      description: "Template excluído com sucesso!",
    });
  };

  const abrirNovoTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({ nome: '', categoria: '', conteudo: value });
    setShowModal(true);
    setShowManagerModal(false);
  };

  return (
    <div className="flex gap-2 items-center">
      <Select onValueChange={(templateId) => {
        const template = templates.find(t => t.id === templateId);
        if (template) {
          onSelectTemplate(template);
        }
      }}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="Selecionar template..." />
        </SelectTrigger>
        <SelectContent>
          {templates.map(template => (
            <SelectItem key={template.id} value={template.id}>
              {template.nome} {template.categoria && `(${template.categoria})`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" onClick={() => abrirNovoTemplate()}>
            <Save className="h-3 w-3" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Editar Template' : 'Salvar como Template'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Nome do template"
              value={templateForm.nome}
              onChange={(e) => setTemplateForm(prev => ({ ...prev, nome: e.target.value }))}
            />
            <Select
              value={templateForm.categoria}
              onValueChange={(value) => setTemplateForm(prev => ({ ...prev, categoria: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {categorias.map(categoria => (
                  <SelectItem key={categoria} value={categoria}>
                    {categoria}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              placeholder="Conteúdo do template"
              value={templateForm.conteudo}
              onChange={(e) => setTemplateForm(prev => ({ ...prev, conteudo: e.target.value }))}
              rows={6}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button onClick={salvarTemplate}>
                {editingTemplate ? 'Atualizar Template' : 'Salvar Template'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showManagerModal} onOpenChange={setShowManagerModal}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            <Settings className="h-3 w-3" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Gerenciar Templates</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto scrollbar-elegant">
            {templates.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum template encontrado</p>
            ) : (
              templates.map(template => (
                <div key={template.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium">{template.nome}</h4>
                      {template.categoria && (
                        <span className="text-sm text-muted-foreground">Categoria: {template.categoria}</span>
                      )}
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{template.conteudo}</p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => editarTemplate(template)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir Template</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir o template "{template.nome}"? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => excluirTemplateConfirmar(template.id)}>
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={() => abrirNovoTemplate()}>
              Novo Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
