import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MessageCircle, FileText, Phone } from 'lucide-react';
import { Lead } from '@/types/leads';
import { validarTelefoneWhatsApp } from '@/utils/leadWhatsappUtils';
import SeletorPDFModal from './SeletorPDFModal';
import { toast } from 'sonner';

interface AcoesLeadModalProps {
  lead: Lead;
  isOpen: boolean;
  onClose: () => void;
  onIniciarConversa: () => void;
  onEnviarPDF: () => void;
}

export default function AcoesLeadModal({
  lead,
  isOpen,
  onClose,
  onIniciarConversa,
  onEnviarPDF
}: AcoesLeadModalProps) {
  const [showPDFSelector, setShowPDFSelector] = useState(false);

  const handleIniciarConversa = () => {
    if (!validarTelefoneWhatsApp(lead.telefone, lead.whatsapp)) {
      toast.error('Número de telefone inválido para WhatsApp');
      return;
    }
    
    onIniciarConversa();
    onClose();
  };

  const handleMostrarSeletorPDF = () => {
    if (!validarTelefoneWhatsApp(lead.telefone, lead.whatsapp)) {
      toast.error('Número de telefone inválido para WhatsApp');
      return;
    }
    
    setShowPDFSelector(true);
  };

  const handlePDFSelecionado = () => {
    setShowPDFSelector(false);
    onEnviarPDF();
    onClose();
  };

  const telefoneDisplay = lead.whatsapp || lead.telefone;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Ações para {lead.nome}
            </DialogTitle>
            <DialogDescription>
              Escolha como você gostaria de entrar em contato via WhatsApp
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Info do contato */}
            <div className="rounded-lg bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>{telefoneDisplay}</span>
              </div>
              {lead.origem && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Origem: {lead.origem}
                </div>
              )}
            </div>

            {/* Opções de ação */}
            <div className="space-y-3">
              <Button
                onClick={handleIniciarConversa}
                className="w-full justify-start gap-3 h-auto py-4"
                variant="outline"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                  <MessageCircle className="h-5 w-5 text-green-600" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Iniciar Conversa</div>
                  <div className="text-sm text-muted-foreground">
                    Abrir WhatsApp com mensagem de apresentação
                  </div>
                </div>
              </Button>

              <Button
                onClick={handleMostrarSeletorPDF}
                className="w-full justify-start gap-3 h-auto py-4"
                variant="outline"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Enviar Proposta/PDF</div>
                  <div className="text-sm text-muted-foreground">
                    Escolher documento e enviar via WhatsApp
                  </div>
                </div>
              </Button>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="ghost" onClick={onClose} className="flex-1">
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SeletorPDFModal
        lead={lead}
        isOpen={showPDFSelector}
        onClose={() => setShowPDFSelector(false)}
        onPDFSelecionado={handlePDFSelecionado}
      />
    </>
  );
}