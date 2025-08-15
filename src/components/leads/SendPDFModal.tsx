import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Send } from 'lucide-react';
import { useFileUpload, type UploadedFile } from '@/hooks/useFileUpload';
import { abrirWhatsAppComPDF, gerarMensagemOrcamento } from '@/utils/leadWhatsappUtils';
import { toast } from 'sonner';
import type { Lead } from '@/types/leads';

interface SendPDFModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
  onPDFSent: () => void;
}

export default function SendPDFModal({ open, onOpenChange, lead, onPDFSent }: SendPDFModalProps) {
  const [selectedPDF, setSelectedPDF] = useState<UploadedFile | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const { files, loadFiles } = useFileUpload();

  useEffect(() => {
    if (open) {
      loadFiles();
      setSelectedPDF(null);
      setCustomMessage('Caso tenha dúvidas, estarei à disposição! 🤝');
    }
  }, [open, loadFiles]);

  const pdfFiles = files.filter(file => file.tipo === 'application/pdf');

  const handleSendPDF = () => {
    if (!selectedPDF) {
      toast.error('Selecione um arquivo PDF');
      return;
    }

    try {
      abrirWhatsAppComPDF(lead, selectedPDF.nome, customMessage);
      toast.success('WhatsApp aberto com mensagem e arquivo');
      onPDFSent();
      onOpenChange(false);
    } catch (error) {
      toast.error('Erro ao abrir WhatsApp');
      console.error('Erro ao enviar PDF:', error);
    }
  };

  const previewMessage = selectedPDF 
    ? gerarMensagemOrcamento(lead, selectedPDF.nome, customMessage)
    : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar Orçamento - {lead.nome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Selecionar PDF</Label>
            <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
              {pdfFiles.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhum PDF encontrado</p>
                  <p className="text-xs">Faça upload de PDFs na seção Configurações</p>
                </div>
              ) : (
                pdfFiles.map(file => (
                  <Card 
                    key={file.id} 
                    className={`cursor-pointer transition-colors ${
                      selectedPDF?.id === file.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => setSelectedPDF(file)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-red-600" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.tamanho / 1024 / 1024).toFixed(1)} MB
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="message" className="text-sm font-medium">
              Mensagem Personalizada
            </Label>
            <Textarea
              id="message"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Digite sua mensagem personalizada..."
              className="mt-2"
              rows={3}
            />
          </div>

          {selectedPDF && (
            <div>
              <Label className="text-sm font-medium">Preview da Mensagem</Label>
              <div className="mt-2 p-3 bg-muted rounded-md">
                <pre className="text-xs whitespace-pre-wrap font-sans">
                  {previewMessage}
                </pre>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button 
              onClick={handleSendPDF} 
              disabled={!selectedPDF}
              className="flex-1 gap-2"
            >
              <Send className="h-4 w-4" />
              Enviar no WhatsApp
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}