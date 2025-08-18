import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Edit, Plus, Eye, Copy } from 'lucide-react';
import { useTaskTemplates, type TaskTemplate } from '@/hooks/useTaskTemplates';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface TemplateManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CATEGORY_LABELS = {
  photography: 'Fotografia',
  client: 'Cliente', 
  production: 'Produção',
  marketing: 'Marketing',
  general: 'Geral'
};

const CATEGORY_COLORS = {
  photography: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  client: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  production: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  marketing: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  general: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
};

const PRIORITY_LABELS = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta'
};

export default function TemplateManagerModal({ open, onOpenChange }: TemplateManagerModalProps) {
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useTaskTemplates();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('list');
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);
  const [viewingTemplate, setViewingTemplate] = useState<TaskTemplate | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<Partial<TaskTemplate>>({
    name: '',
    description: '',
    category: 'general',
    icon: '📝',
    template: {
      title: '',
      description: '',
      priority: 'medium',
      tags: [],
      estimatedHours: 1
    }
  });

  const handleCreateTemplate = () => {
    if (!formData.name?.trim() || !formData.template?.title?.trim()) {
      toast({
        title: "Erro",
        description: "Nome e título são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    addTemplate(formData as Omit<TaskTemplate, 'id' | 'createdAt'>);
    resetForm();
    setActiveTab('list');
    toast({
      title: "Template criado",
      description: "Template adicionado com sucesso"
    });
  };

  const handleUpdateTemplate = () => {
    if (!editingTemplate || !formData.name?.trim() || !formData.template?.title?.trim()) {
      toast({
        title: "Erro", 
        description: "Nome e título são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    updateTemplate(editingTemplate.id, formData as Partial<TaskTemplate>);
    resetForm();
    setEditingTemplate(null);
    setActiveTab('list');
    toast({
      title: "Template atualizado",
      description: "Alterações salvas com sucesso"
    });
  };

  const handleDeleteTemplate = (template: TaskTemplate) => {
    if (confirm(`Tem certeza que deseja excluir o template "${template.name}"?`)) {
      deleteTemplate(template.id);
      toast({
        title: "Template excluído",
        description: "Template removido com sucesso"
      });
    }
  };

  const handleDuplicateTemplate = (template: TaskTemplate) => {
    const duplicated = {
      ...template,
      name: `${template.name} (Cópia)`,
      id: undefined,
      createdAt: undefined
    };
    delete duplicated.id;
    delete duplicated.createdAt;
    
    addTemplate(duplicated);
    toast({
      title: "Template duplicado",
      description: "Nova cópia criada com sucesso"
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: 'general',
      icon: '📝',
      template: {
        title: '',
        description: '',
        priority: 'medium',
        tags: [],
        estimatedHours: 1
      }
    });
  };

  const startEdit = (template: TaskTemplate) => {
    setFormData(template);
    setEditingTemplate(template);
    setActiveTab('form');
  };

  const startCreate = () => {
    resetForm();
    setEditingTemplate(null);
    setActiveTab('form');
  };

  const handleTagsChange = (value: string) => {
    const tags = value.split(',').map(t => t.trim()).filter(Boolean);
    setFormData(prev => ({
      ...prev,
      template: {
        ...prev.template!,
        tags
      }
    }));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Gerenciar Templates</DialogTitle>
          </DialogHeader>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="list">Templates</TabsTrigger>
              <TabsTrigger value="form">
                {editingTemplate ? 'Editar' : 'Novo'} Template
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="list" className="flex-1 overflow-y-auto space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  {templates.length} template{templates.length !== 1 ? 's' : ''} encontrado{templates.length !== 1 ? 's' : ''}
                </p>
                <Button onClick={startCreate} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Template
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {templates.map(template => (
                  <Card key={template.id} className="relative">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{template.icon}</span>
                          <div>
                            <CardTitle className="text-sm">{template.name}</CardTitle>
                            <Badge 
                              variant="secondary" 
                              className={cn("text-xs mt-1", CATEGORY_COLORS[template.category])}
                            >
                              {CATEGORY_LABELS[template.category]}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewingTemplate(template)}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDuplicateTemplate(template)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEdit(template)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTemplate(template)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      
                      {template.description && (
                        <CardDescription className="text-xs">
                          {template.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground mb-2">
                        {template.template.title}
                      </p>
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Prioridade: {PRIORITY_LABELS[template.template.priority]}</span>
                        {template.template.estimatedHours && (
                          <span>{template.template.estimatedHours}h</span>
                        )}
                        {template.template.tags && template.template.tags.length > 0 && (
                          <span>{template.template.tags.length} tag{template.template.tags.length !== 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              {templates.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">Nenhum template encontrado</p>
                  <Button onClick={startCreate} variant="outline" className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Criar primeiro template
                  </Button>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="form" className="flex-1 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome do Template *</Label>
                    <Input
                      value={formData.name || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: Contato com Cliente"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Textarea
                      value={formData.description || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Descreva quando usar este template"
                      rows={2}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Categoria</Label>
                      <Select
                        value={formData.category}
                        onValueChange={(value: any) => setFormData(prev => ({ ...prev, category: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Ícone</Label>
                      <Input
                        value={formData.icon || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                        placeholder="📝"
                        className="text-center"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Título da Tarefa *</Label>
                    <Input
                      value={formData.template?.title || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        template: { ...prev.template!, title: e.target.value }
                      }))}
                      placeholder="Use {variável} para campos dinâmicos"
                    />
                    <p className="text-xs text-muted-foreground">
                      Use {"{cliente}"}, {"{sessao}"}, {"{tema}"} etc. para criar campos dinâmicos
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Descrição da Tarefa</Label>
                    <Textarea
                      value={formData.template?.description || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        template: { ...prev.template!, description: e.target.value }
                      }))}
                      placeholder="Descreva a tarefa..."
                      rows={2}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Prioridade</Label>
                      <Select
                        value={formData.template?.priority}
                        onValueChange={(value: any) => setFormData(prev => ({
                          ...prev,
                          template: { ...prev.template!, priority: value }
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Horas Estimadas</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.5"
                        value={formData.template?.estimatedHours || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          template: { ...prev.template!, estimatedHours: parseFloat(e.target.value) || undefined }
                        }))}
                        placeholder="1"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Tags (separadas por vírgula)</Label>
                    <Input
                      value={formData.template?.tags?.join(', ') || ''}
                      onChange={(e) => handleTagsChange(e.target.value)}
                      placeholder="cliente, contato, importante"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setActiveTab('list')}>
                  Cancelar
                </Button>
                <Button onClick={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}>
                  {editingTemplate ? 'Salvar Alterações' : 'Criar Template'}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
      
      {/* Template Preview Modal */}
      {viewingTemplate && (
        <Dialog open={!!viewingTemplate} onOpenChange={() => setViewingTemplate(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span>{viewingTemplate.icon}</span>
                {viewingTemplate.name}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Badge className={cn(CATEGORY_COLORS[viewingTemplate.category])}>
                  {CATEGORY_LABELS[viewingTemplate.category]}
                </Badge>
                {viewingTemplate.description && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {viewingTemplate.description}
                  </p>
                )}
              </div>
              
              <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">TÍTULO</Label>
                  <p className="text-sm font-medium">{viewingTemplate.template.title}</p>
                </div>
                
                {viewingTemplate.template.description && (
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">DESCRIÇÃO</Label>
                    <p className="text-sm">{viewingTemplate.template.description}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">PRIORIDADE</Label>
                    <p className="text-sm">{PRIORITY_LABELS[viewingTemplate.template.priority]}</p>
                  </div>
                  
                  {viewingTemplate.template.estimatedHours && (
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground">DURAÇÃO</Label>
                      <p className="text-sm">{viewingTemplate.template.estimatedHours}h</p>
                    </div>
                  )}
                </div>
                
                {viewingTemplate.template.tags && viewingTemplate.template.tags.length > 0 && (
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">TAGS</Label>
                    <div className="flex gap-1 flex-wrap mt-1">
                      {viewingTemplate.template.tags.map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {viewingTemplate.template.attachments && (
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">ANEXOS</Label>
                    <p className="text-sm">{viewingTemplate.template.attachments.length} anexo{viewingTemplate.template.attachments.length !== 1 ? 's' : ''}</p>
                  </div>
                )}
                
                {viewingTemplate.template.captions && (
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">LEGENDAS</Label>
                    <p className="text-sm">{viewingTemplate.template.captions.length} legenda{viewingTemplate.template.captions.length !== 1 ? 's' : ''}</p>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}