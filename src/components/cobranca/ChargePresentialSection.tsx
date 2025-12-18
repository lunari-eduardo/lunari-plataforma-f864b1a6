import { Button } from '@/components/ui/button';
import { Smartphone, ExternalLink } from 'lucide-react';
import { formatCurrency } from '@/utils/financialUtils';

interface ChargePresentialSectionProps {
  valor: number;
}

export function ChargePresentialSection({ valor }: ChargePresentialSectionProps) {
  const handleOpenMercadoPago = () => {
    // Deep link to Mercado Pago app (Point tap functionality)
    // On mobile, this will try to open the MP app
    // On desktop, it will open the MP website
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile) {
      // Try to open the MP app
      window.location.href = 'mercadopago://';
      
      // Fallback to app store after a delay if app doesn't open
      setTimeout(() => {
        const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (isIOS) {
          window.open('https://apps.apple.com/app/mercado-pago/id925436649', '_blank');
        } else {
          window.open('https://play.google.com/store/apps/details?id=com.mercadopago.wallet', '_blank');
        }
      }, 2000);
    } else {
      window.open('https://www.mercadopago.com.br/point', '_blank');
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center py-4">
        <Smartphone className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
        <p className="text-sm text-muted-foreground">
          Cobrança presencial de <strong>{formatCurrency(valor)}</strong>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Use o app Mercado Pago para cobrar na hora
        </p>
      </div>
      
      <Button
        type="button"
        onClick={handleOpenMercadoPago}
        className="w-full gap-2 bg-[#009ee3] hover:bg-[#0088cc]"
        size="lg"
      >
        <ExternalLink className="h-5 w-5" />
        Abrir App Mercado Pago
      </Button>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
        <p className="text-sm text-amber-700">
          O pagamento será registrado automaticamente após a confirmação
        </p>
      </div>

      <div className="text-xs text-muted-foreground text-center space-y-1">
        <p>Você pode usar:</p>
        <ul className="list-disc list-inside">
          <li>Maquininha Point</li>
          <li>Tap no celular (NFC)</li>
          <li>QR Code presencial</li>
        </ul>
      </div>
    </div>
  );
}
