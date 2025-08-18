import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Clock, Tag } from 'lucide-react';
import { useTaskTemplates, type TaskTemplate } from '@/hooks/useTaskTemplates';
import { cn } from '@/lib/utils';

interface TemplateSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (template: TaskTemplate, variables: Record<string, string>) => void;
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

export default function TemplateSelector({ open, onOpenChange, onSelectTemplate }: TemplateSelectorProps) {
  const { templates } = useTaskTemplates();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TaskTemplate['category'] | 'all'>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const extractVariables = (template: TaskTemplate): string[] => {
    const variables = new Set<string>();
    const regex = /\{(\w+)\}/g;
    
    // Extract from title
    let match;
    while ((match = regex.exec(template.template.title)) !== null) {
      variables.add(match[1]);
    }
    
    // Extract from description
    if (template.template.description) {
      regex.lastIndex = 0;
      while ((match = regex.exec(template.template.description)) !== null) {
        variables.add(match[1]);
      }
    }
    
    return Array.from(variables);
  };

  const handleTemplateSelect = (template: TaskTemplate) => {
    const templateVariables = extractVariables(template);
    
    if (templateVariables.length > 0) {
      setSelectedTemplate(template);
      setVariables(Object.fromEntries(templateVariables.map(v => [v, ''])));
    } else {
      onSelectTemplate(template, {});
      onOpenChange(false);
    }
  };

  const handleApplyTemplate = () => {
    if (selectedTemplate) {
      onSelectTemplate(selectedTemplate, variables);
      onOpenChange(false);
      setSelectedTemplate(null);
      setVariables({});
    }
  };

  const categories = Object.keys(CATEGORY_LABELS) as TaskTemplate['category'][];

  if (selectedTemplate) {
    const templateVariables = extractVariables(selectedTemplate);
    
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{selectedTemplate.icon}</span>
              {selectedTemplate.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {selectedTemplate.description}
            </p>
            
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Preencha as informações:</h4>
              {templateVariables.map(variable => (
                <div key={variable} className="space-y-1">
                  <label className="text-sm font-medium capitalize">
                    {variable.replace(/([A-Z])/g, ' $1').toLowerCase()}
                  </label>
                  <Input
                    value={variables[variable] || ''}
                    onChange={(e) => setVariables(prev => ({
                      ...prev,
                      [variable]: e.target.value
                    }))}
                    placeholder={`Digite ${variable.toLowerCase()}`}
                  />
                </div>
              ))}
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
                Voltar
              </Button>
              <Button 
                onClick={handleApplyTemplate}
                disabled={templateVariables.some(v => !variables[v]?.trim())}
              >
                Aplicar Template
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Escolher Template</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Search and Filters */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={selectedCategory === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('all')}
              >
                Todos
              </Button>
              {categories.map(category => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                >
                  {CATEGORY_LABELS[category]}
                </Button>
              ))}
            </div>
          </div>
          
          {/* Templates Grid */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredTemplates.map(template => (
                <Card 
                  key={template.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleTemplateSelect(template)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{template.icon}</span>
                        <CardTitle className="text-sm">{template.name}</CardTitle>
                      </div>
                      <Badge 
                        variant="secondary" 
                        className={cn("text-xs", CATEGORY_COLORS[template.category])}
                      >
                        {CATEGORY_LABELS[template.category]}
                      </Badge>
                    </div>
                    {template.description && (
                      <CardDescription className="text-xs">
                        {template.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">
                        {template.template.title}
                      </p>
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {template.template.estimatedHours && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {template.template.estimatedHours}h
                          </div>
                        )}
                        
                        {template.template.tags && template.template.tags.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Tag className="h-3 w-3" />
                            {template.template.tags.length} tags
                          </div>
                        )}
                      </div>
                      
                      {template.template.tags && (
                        <div className="flex gap-1 flex-wrap">
                          {template.template.tags.slice(0, 3).map(tag => (
                            <Badge key={tag} variant="outline" className="text-2xs py-0">
                              {tag}
                            </Badge>
                          ))}
                          {template.template.tags.length > 3 && (
                            <Badge variant="outline" className="text-2xs py-0">
                              +{template.template.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {filteredTemplates.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">Nenhum template encontrado</p>
                <p className="text-xs">Tente ajustar os filtros ou termo de busca</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}