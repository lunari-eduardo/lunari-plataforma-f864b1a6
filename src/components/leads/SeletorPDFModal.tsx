import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download, Calendar } from 'lucide-react';
import { Lead } from '@/types/leads';
import { TemplateFile, TEMPLATE_CATEGORIES } from '@/types/templates';
import { useLeadActions } from '@/hooks/useLeadActions';

interface SeletorPDFModalProps {
  lead: Lead;
  isOpen: boolean;
  onClose: () => void;
  onPDFSelecionado: () => void;
}

export default function SeletorPDFModal({
  lead,
  isOpen,
  onClose,
  onPDFSelecionado
}: SeletorPDFModalProps) {
  const [templates, setTemplates] = useState<TemplateFile[]>([]);
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todos');
  const [templateSelecionado, setTemplateSelecionado] = useState<TemplateFile | null>(null);
  const { enviarPDFPorWhatsApp, loading } = useLeadActions();

  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('pdf_templates');
      if (saved) {
        try {
          const allTemplates = JSON.parse(saved) as TemplateFile[];
          const visibleTemplates = allTemplates.filter(t => t.visivel);
          setTemplates(visibleTemplates);
        } catch (error) {
          console.error('Erro ao carregar templates:', error);
        }
      }
    }
  }, [isOpen]);

  const templatesFiltrados = templates.filter(template => 
    categoriaFiltro === 'todos' || template.categoria === categoriaFiltro
  );

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleEnviarPDF = async () => {
    if (!templateSelecionado) return;
    
    await enviarPDFPorWhatsApp(lead, templateSelecionado);
    onPDFSelecionado();
  };

  const handlePreview = (template: TemplateFile) => {
    if (template.url) {
      window.open(template.url, '_blank');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Selecionar Documento para {lead.nome}
          </DialogTitle>
          <DialogDescription>
            Escolha o documento que será enviado via WhatsApp
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-hidden">
          {/* Filtro por categoria */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Filtrar por categoria:</span>
            <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as categorias</SelectItem>
                {Object.entries(TEMPLATE_CATEGORIES).map(([key, category]) => (
                  <SelectItem key={key} value={key}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Lista de templates */}
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {templatesFiltrados.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum documento encontrado</p>
                <p className="text-sm">Adicione documentos em Configurações → Documentos PDF</p>
              </div>
            ) : (
              templatesFiltrados.map((template) => (
                <div
                  key={template.id}
                  className={`relative cursor-pointer rounded-lg border p-4 transition-colors hover:bg-muted/30 ${
                    templateSelecionado?.id === template.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border'
                  }`}
                  onClick={() => setTemplateSelecionado(template)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                      <FileText className="h-5 w-5 text-red-600" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium truncate">{template.nome}</h4>
                        <Badge 
                          variant="outline"
                          style={{ 
                            borderColor: TEMPLATE_CATEGORIES[template.categoria].color,
                            color: TEMPLATE_CATEGORIES[template.categoria].color 
                          }}
                        >
                          {TEMPLATE_CATEGORIES[template.categoria].label}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{formatFileSize(template.tamanho)}</span>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(template.uploadDate).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePreview(template);
                      }}
                      className="shrink-0"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>

                  {templateSelecionado?.id === template.id && (
                    <div className="absolute inset-0 rounded-lg ring-2 ring-primary ring-offset-2" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button
            onClick={handleEnviarPDF}
            disabled={!templateSelecionado || loading}
            className="flex-1"
          >
            {loading ? 'Enviando...' : 'Enviar via WhatsApp'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}