import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, Loader2, QrCode, Send, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'qrcode';

interface PixManualSectionProps {
  valor: number;
  pixPayload?: string;
  status?: string;
  loading: boolean;
  checkingStatus?: boolean;
  clienteWhatsapp?: string;
  chargeId?: string;
  onGenerate: () => void;
  onConfirmPayment?: (chargeId: string) => Promise<boolean>;
}

export function PixManualSection({
  valor,
  pixPayload,
  status,
  loading,
  checkingStatus,
  clienteWhatsapp,
  chargeId,
  onGenerate,
  onConfirmPayment,
}: PixManualSectionProps) {
  const [copied, setCopied] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [confirmingPayment, setConfirmingPayment] = useState(false);

  // Generate QR Code when pixPayload changes
  useEffect(() => {
    if (pixPayload) {
      QRCode.toDataURL(pixPayload, {
        width: 256,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      })
        .then(setQrCodeDataUrl)
        .catch((err) => {
          console.error('Error generating QR Code:', err);
          setQrCodeDataUrl(null);
        });
    } else {
      setQrCodeDataUrl(null);
    }
  }, [pixPayload]);

  const handleCopy = async () => {
    if (!pixPayload) return;
    
    try {
      await navigator.clipboard.writeText(pixPayload);
      setCopied(true);
      toast.success('Código PIX copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Erro ao copiar');
    }
  };

  const handleWhatsApp = () => {
    if (!clienteWhatsapp || !pixPayload) return;
    
    const cleanPhone = clienteWhatsapp.replace(/\D/g, '');
    const phone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    
    const message = encodeURIComponent(
      `💳 *Pagamento via PIX*\n\n` +
      `Valor: R$ ${valor.toFixed(2)}\n\n` +
      `Copie o código abaixo para pagar:\n\n` +
      `\`\`\`${pixPayload}\`\`\`\n\n` +
      `Ou escaneie o QR Code que enviarei em seguida.`
    );
    
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  };

  const handleConfirmPayment = async () => {
    if (!chargeId || !onConfirmPayment) return;
    
    setConfirmingPayment(true);
    try {
      await onConfirmPayment(chargeId);
    } finally {
      setConfirmingPayment(false);
    }
  };

  const isPaid = status === 'pago';

  // No PIX generated yet
  if (!pixPayload) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center p-6 bg-muted/30 rounded-lg border-2 border-dashed border-muted">
          <QrCode className="h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground text-center mb-4">
            Gere um código PIX para cobrança manual
          </p>
          <Button
            onClick={onGenerate}
            disabled={loading}
            className="gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <QrCode className="h-4 w-4" />
                Gerar PIX - R$ {valor.toFixed(2)}
              </>
            )}
          </Button>
        </div>

        <div className="flex items-start gap-2 p-3 bg-warning/10 rounded-lg border border-warning/20">
          <AlertCircle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
          <p className="text-xs text-warning">
            <strong>PIX Manual:</strong> O pagamento não é confirmado automaticamente. 
            Você precisará confirmar manualmente após receber.
          </p>
        </div>
      </div>
    );
  }

  // PIX generated - show QR Code and Copia e Cola
  return (
    <div className="space-y-4">
      {/* Status Badge */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">PIX Manual</span>
        <Badge variant={isPaid ? 'default' : 'secondary'} className="gap-1">
          {isPaid ? (
            <>
              <CheckCircle2 className="h-3 w-3" />
              Pago
            </>
          ) : (
            'Aguardando pagamento'
          )}
        </Badge>
      </div>

      {/* QR Code */}
      <div className="flex justify-center">
        {qrCodeDataUrl ? (
          <div className="p-3 bg-white rounded-lg shadow-sm">
            <img 
              src={qrCodeDataUrl} 
              alt="QR Code PIX" 
              className="w-48 h-48"
            />
          </div>
        ) : (
          <div className="w-48 h-48 bg-muted animate-pulse rounded-lg flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Valor */}
      <div className="text-center">
        <span className="text-2xl font-bold text-primary">
          R$ {valor.toFixed(2)}
        </span>
      </div>

      {/* Copia e Cola */}
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-wide text-muted-foreground">
          PIX Copia e Cola
        </label>
        <div className="flex gap-2">
          <Input
            value={pixPayload}
            readOnly
            className="text-xs font-mono bg-muted"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopy}
            className="flex-shrink-0"
          >
            {copied ? (
              <Check className="h-4 w-4 text-primary" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {clienteWhatsapp && (
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={handleWhatsApp}
          >
            <Send className="h-4 w-4" />
            Enviar via WhatsApp
          </Button>
        )}
        
        {!isPaid && onConfirmPayment && chargeId && (
          <Button
            variant="default"
            className="flex-1 gap-2"
            onClick={handleConfirmPayment}
            disabled={confirmingPayment}
          >
            {confirmingPayment ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Confirmando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Confirmar Pagamento
              </>
            )}
          </Button>
        )}
      </div>

      {/* Warning */}
      {!isPaid && (
        <div className="flex items-start gap-2 p-3 bg-warning/10 rounded-lg border border-warning/20">
          <AlertCircle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
          <p className="text-xs text-warning">
            Confirme o pagamento manualmente após receber a transferência.
          </p>
        </div>
      )}
    </div>
  );
}
