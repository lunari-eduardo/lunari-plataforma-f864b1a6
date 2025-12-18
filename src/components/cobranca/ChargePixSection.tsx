import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check, QrCode, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { ChargeStatusDisplay, ChargeLoadingStatus } from './ChargeStatusDisplay';
import { formatCurrency } from '@/utils/financialUtils';

interface ChargePixSectionProps {
  valor: number;
  qrCode?: string;
  qrCodeBase64?: string;
  pixCopiaCola?: string;
  status?: 'pendente' | 'pago' | 'cancelado' | 'expirado';
  loading?: boolean;
  onGenerate: () => void;
}

export function ChargePixSection({
  valor,
  qrCode,
  qrCodeBase64,
  pixCopiaCola,
  status,
  loading,
  onGenerate,
}: ChargePixSectionProps) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(true);

  const handleCopyPix = async () => {
    if (!pixCopiaCola) return;
    
    try {
      await navigator.clipboard.writeText(pixCopiaCola);
      setCopied(true);
      toast.success('Código Pix copiado!');
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      toast.error('Erro ao copiar');
    }
  };

  // If already generated, show the Pix data
  if (qrCodeBase64 || pixCopiaCola) {
    return (
      <div className="space-y-4">
        {/* Status */}
        {status && (
          <div className="flex justify-center">
            <ChargeStatusDisplay status={status} />
          </div>
        )}

        {/* Toggle buttons */}
        <div className="flex gap-2 justify-center">
          <Button
            type="button"
            variant={showQR ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowQR(true)}
            className="gap-2"
          >
            <QrCode className="h-4 w-4" />
            QR Code
          </Button>
          <Button
            type="button"
            variant={!showQR ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowQR(false)}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            Pix Copia e Cola
          </Button>
        </div>

        {/* QR Code */}
        {showQR && qrCodeBase64 && (
          <div className="flex flex-col items-center gap-4">
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <img 
                src={`data:image/png;base64,${qrCodeBase64}`} 
                alt="QR Code Pix"
                className="w-48 h-48 object-contain"
              />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Escaneie o QR Code com o app do seu banco
            </p>
          </div>
        )}

        {/* Pix Copia e Cola */}
        {!showQR && pixCopiaCola && (
          <div className="space-y-3">
            <div className="bg-muted/50 p-3 rounded-lg border">
              <p className="text-xs font-mono break-all text-muted-foreground">
                {pixCopiaCola.length > 100 
                  ? `${pixCopiaCola.substring(0, 100)}...` 
                  : pixCopiaCola
                }
              </p>
            </div>
            <Button
              type="button"
              onClick={handleCopyPix}
              className="w-full gap-2"
              variant="outline"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-green-600" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copiar código Pix
                </>
              )}
            </Button>
          </div>
        )}

        {/* Info */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
          <p className="text-sm text-green-700">
            ✓ Confirmação automática após pagamento
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
          <p className="text-sm text-muted-foreground">Gerando código Pix...</p>
        </div>
      ) : (
        <>
          <div className="text-center py-4">
            <QrCode className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-sm text-muted-foreground">
              Gere um código Pix de <strong>{formatCurrency(valor)}</strong>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              O cliente pode pagar pelo app do banco
            </p>
          </div>
          
          <Button
            type="button"
            onClick={onGenerate}
            className="w-full gap-2"
            size="lg"
          >
            <QrCode className="h-5 w-5" />
            Gerar Pix
          </Button>

          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
            <p className="text-sm text-green-700">
              ✓ Confirmação automática após pagamento
            </p>
          </div>
        </>
      )}
    </div>
  );
}
