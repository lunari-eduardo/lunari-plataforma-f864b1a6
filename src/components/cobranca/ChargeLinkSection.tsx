import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check, Link2, ExternalLink, Send, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { ChargeStatusDisplay, ChargeLoadingStatus } from './ChargeStatusDisplay';
import { formatCurrency } from '@/utils/financialUtils';

interface ChargeLinkSectionProps {
  valor: number;
  paymentLink?: string;
  status?: 'pendente' | 'pago' | 'cancelado' | 'expirado';
  loading?: boolean;
  checkingStatus?: boolean;
  onGenerate: () => void;
  onCheckStatus?: () => void;
  clienteWhatsapp?: string;
}

export function ChargeLinkSection({
  valor,
  paymentLink,
  status,
  loading,
  checkingStatus,
  onGenerate,
  onCheckStatus,
  clienteWhatsapp,
}: ChargeLinkSectionProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    if (!paymentLink) return;
    
    try {
      await navigator.clipboard.writeText(paymentLink);
      setCopied(true);
      toast.success('Link copiado!');
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      toast.error('Erro ao copiar');
    }
  };

  const handleSendWhatsapp = () => {
    if (!paymentLink || !clienteWhatsapp) return;
    
    const phone = clienteWhatsapp.replace(/\D/g, '');
    const message = encodeURIComponent(`Olá! Segue o link para pagamento de ${formatCurrency(valor)}:\n\n${paymentLink}`);
    window.open(`https://wa.me/55${phone}?text=${message}`, '_blank');
  };

  const handleOpenLink = () => {
    if (!paymentLink) return;
    window.open(paymentLink, '_blank');
  };

  // If already generated, show the link
  if (paymentLink) {
    return (
      <div className="space-y-4">
        {/* Status */}
        {status && (
          <div className="flex justify-center">
            <ChargeStatusDisplay status={status} />
          </div>
        )}

        {/* Link display */}
        <div className="bg-muted/50 p-3 rounded-lg border">
          <p className="text-xs font-mono break-all text-muted-foreground">
            {paymentLink.length > 60 
              ? `${paymentLink.substring(0, 60)}...` 
              : paymentLink
            }
          </p>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            onClick={handleCopyLink}
            variant="outline"
            className="gap-2"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-green-600" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copiar
              </>
            )}
          </Button>
          
          <Button
            type="button"
            onClick={handleOpenLink}
            variant="outline"
            className="gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir
          </Button>
        </div>

        {/* Check Status button - only show for pending payments */}
        {status === 'pendente' && onCheckStatus && (
          <Button
            type="button"
            onClick={onCheckStatus}
            variant="outline"
            className="w-full gap-2"
            disabled={checkingStatus}
          >
            <RefreshCw className={`h-4 w-4 ${checkingStatus ? 'animate-spin' : ''}`} />
            {checkingStatus ? 'Verificando...' : 'Verificar Status'}
          </Button>
        )}

        {clienteWhatsapp && (
          <Button
            type="button"
            onClick={handleSendWhatsapp}
            className="w-full gap-2 bg-green-600 hover:bg-green-700"
          >
            <Send className="h-4 w-4" />
            Enviar via WhatsApp
          </Button>
        )}

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
          <p className="text-sm text-blue-700">
            O cliente pode pagar com cartão à vista ou parcelado
          </p>
        </div>
      </div>
    );
  }

  // Not generated yet
  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex flex-col items-center gap-4 py-8">
          <ChargeLoadingStatus />
          <p className="text-sm text-muted-foreground">Gerando link de pagamento...</p>
        </div>
      ) : (
        <>
          <div className="text-center py-4">
            <Link2 className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-sm text-muted-foreground">
              Gere um link de pagamento de <strong>{formatCurrency(valor)}</strong>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Envie para o cliente pagar quando quiser
            </p>
          </div>
          
          <Button
            type="button"
            onClick={onGenerate}
            className="w-full gap-2"
            size="lg"
          >
            <Link2 className="h-5 w-5" />
            Gerar Link
          </Button>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
            <p className="text-sm text-blue-700">
              Aceita cartão à vista ou parcelado
            </p>
          </div>
        </>
      )}
    </div>
  );
}
