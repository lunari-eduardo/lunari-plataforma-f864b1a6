import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { FileUploadZone } from '@/components/shared/FileUploadZone';
import { useFileUpload, UploadedFile } from '@/hooks/useFileUpload';
import { TemplateFile, TEMPLATE_CATEGORIES } from '@/types/templates';
import { FileText, Eye, EyeOff, Download, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function DocumentosPDF() {
  const { files, deleteFile } = useFileUpload();
  const [templates, setTemplates] = useState<TemplateFile[]>([]);

  // Carregar templates do localStorage
  useEffect(() => {
    const saved = localStorage.getItem('pdf_templates');
    if (saved) {
      try {
        setTemplates(JSON.parse(saved));
      } catch (error) {
        console.error('Erro ao carregar templates:', error);
      }
    }
  }, []);

  // Salvar templates no localStorage
  const saveTemplates = (newTemplates: TemplateFile[]) => {
    localStorage.setItem('pdf_templates', JSON.stringify(newTemplates));
    setTemplates(newTemplates);
  };

  // Converter arquivo uploaded para template
  const handleFileUploaded = (file: UploadedFile) => {
    if (!file.tipo.includes('pdf')) {
      toast.error('Apenas arquivos PDF são permitidos nesta seção');
      return;
    }

    const template: TemplateFile = {
      ...file,
      categoria: 'outros',
      isTemplate: true,
      visivel: true
    };

    const newTemplates = [...templates, template];
    saveTemplates(newTemplates);
    toast.success('PDF adicionado aos templates!');
  };

  // Atualizar categoria do template
  const updateCategoria = (templateId: string, categoria: TemplateFile['categoria']) => {
    const updated = templates.map(t => 
      t.id === templateId ? { ...t, categoria } : t
    );
    saveTemplates(updated);
  };

  // Toggle visibilidade
  const toggleVisibilidade = (templateId: string) => {
    const updated = templates.map(t => 
      t.id === templateId ? { ...t, visivel: !t.visivel } : t
    );
    saveTemplates(updated);
  };

  // Remover template
  const removeTemplate = (templateId: string) => {
    const updated = templates.filter(t => t.id !== templateId);
    saveTemplates(updated);
    deleteFile(templateId);
    toast.success('Template removido');
  };

  // Download do arquivo
  const handleDownload = (template: TemplateFile) => {
    const link = document.createElement('a');
    link.href = template.url;
    link.download = template.nome;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Upload de Documentos PDF
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FileUploadZone
            showExisting={false}
            onFileUploaded={handleFileUploaded}
            description="template-pdf"
          />
        </CardContent>
      </Card>

      {templates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Templates de PDF</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between p-4 border rounded-lg bg-muted/30"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <FileText className="h-8 w-8 text-red-500" />
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{template.nome}</h4>
                        <Badge 
                          variant="outline"
                          style={{ 
                            borderColor: TEMPLATE_CATEGORIES[template.categoria].color,
                            color: TEMPLATE_CATEGORIES[template.categoria].color 
                          }}
                        >
                          {TEMPLATE_CATEGORIES[template.categoria].label}
                        </Badge>
                        {template.visivel ? (
                          <Eye className="h-4 w-4 text-green-600" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{formatFileSize(template.tamanho)}</span>
                        <span>{new Date(template.uploadDate).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Seletor de Categoria */}
                    <Select
                      value={template.categoria}
                      onValueChange={(value) => updateCategoria(template.id, value as TemplateFile['categoria'])}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TEMPLATE_CATEGORIES).map(([key, category]) => (
                          <SelectItem key={key} value={key}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Toggle Visibilidade */}
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={template.visivel}
                        onCheckedChange={() => toggleVisibilidade(template.id)}
                      />
                      <Label className="text-xs">Visível</Label>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(template)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTemplate(template.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}