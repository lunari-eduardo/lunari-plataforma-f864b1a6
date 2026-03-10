import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, CheckCircle, QrCode, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface AsaasPixModalProps {
  isOpen: boolean;
  onClose: () => void;
  valor: number;
  pixQrCode: string | null;
  pixCopiaECola: string | null;
  clienteWhatsapp?: string;
}

export function AsaasPixModal({
  isOpen,
  onClose,
  valor,
  pixQrCode,
  pixCopiaECola,
  clienteWhatsapp,
}: AsaasPixModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!pixCopiaECola) return;
    try {
      await navigator.clipboard.writeText(pixCopiaECola);
      setCopied(true);
      toast.success('Código PIX copiado!');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const handleSendWhatsApp = () => {
    if (!clienteWhatsapp || !pixCopiaECola) return;
    const phone = clienteWhatsapp.replace(/\D/g, '');
    const msg = encodeURIComponent(
      `💰 *Pagamento via PIX*\n\nValor: R$ ${valor.toFixed(2)}\n\nCódigo PIX Copia e Cola:\n${pixCopiaECola}`
    );
    window.open(`https://wa.me/55${phone}?text=${msg}`, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-sm z-[70]"
        overlayClassName="backdrop-blur-sm bg-black/60 z-[69]"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            PIX — R$ {valor.toFixed(2)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {pixQrCode && (
            <div className="flex justify-center">
              <img
                src={pixQrCode}
                alt="QR Code PIX"
                className="w-56 h-56 rounded-lg border"
              />
            </div>
          )}

          {pixCopiaECola && (
            <div className="space-y-2">
              <Label className="text-xs">Código PIX Copia e Cola</Label>
              <div className="flex gap-2">
                <Input value={pixCopiaECola} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={handleCopy}>
                  {copied ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {clienteWhatsapp && (
            <Button variant="outline" className="w-full gap-2" onClick={handleSendWhatsApp}>
              <ExternalLink className="h-4 w-4" />
              Enviar via WhatsApp
            </Button>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Aguardando confirmação do pagamento...
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
