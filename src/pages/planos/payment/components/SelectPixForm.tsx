import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Smartphone, Lock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { PixPaymentDisplay } from '@/components/credits/PixPaymentDisplay';
import { useAuth } from '@/contexts/AuthContext';
import { useCreditPackages } from '@/hooks/useCreditPackages';
import { SelectPayment } from '../types';

interface SelectPixFormProps {
  pkg: SelectPayment;
  formattedPrice: string;
}

export function SelectPixForm({ pkg, formattedPrice }: SelectPixFormProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createPayment, checkPayment, isCreatingPayment } = useCreditPackages();

  const [email, setEmail] = useState(user?.email || '');
  const [pixData, setPixData] = useState<{
    qrCodeBase64: string;
    pixCopiaECola: string;
    expiration: string;
    purchaseId: string;
  } | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const handlePixPayment = async () => {
    if (!email) {
      toast.error('Informe seu e-mail');
      return;
    }
    try {
      const result = await createPayment({
        packageId: pkg.packageId,
        paymentMethod: 'pix',
        payerEmail: email,
      });
      if (result.pix) {
        setPixData({
          qrCodeBase64: result.pix.qr_code_base64,
          pixCopiaECola: result.pix.qr_code,
          expiration: result.pix.expiration,
          purchaseId: result.purchase_id,
        });
      }
    } catch (error) {
      console.error('Erro ao criar PIX:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao criar pagamento PIX');
    }
  };

  const handleCheckStatus = async () => {
    if (!pixData?.purchaseId) return { status: 'pending' };
    return await checkPayment(pixData.purchaseId);
  };

  const handlePixSuccess = () => {
    setPaymentSuccess(true);
    setTimeout(() => navigate('/app/minha-conta?tab=planos'), 2000);
  };

  if (paymentSuccess) {
    return (
      <div className="rounded-lg border p-8 text-center bg-card">
        <div className="text-4xl mb-3">🎉</div>
        <h3 className="text-lg font-semibold text-primary">Pagamento Confirmado!</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {pkg.credits.toLocaleString('pt-BR')} créditos adicionados
        </p>
        <p className="text-xs text-muted-foreground mt-3">Redirecionando...</p>
      </div>
    );
  }

  if (pixData) {
    return (
      <div className="rounded-lg border p-6 bg-card space-y-4">
        <PixPaymentDisplay
          qrCodeBase64={pixData.qrCodeBase64}
          pixCopiaECola={pixData.pixCopiaECola}
          expiration={pixData.expiration}
          onCheckStatus={handleCheckStatus}
          onSuccess={handlePixSuccess}
        />
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-6 bg-card space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-sm">
          E-mail para recibo
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="p-4 bg-muted/50 rounded-lg text-center">
        <Smartphone className="h-6 w-6 mx-auto mb-2 text-primary" />
        <p className="text-sm text-muted-foreground">Pague instantaneamente com PIX</p>
      </div>
      <Button
        className="w-full"
        size="lg"
        onClick={handlePixPayment}
        disabled={isCreatingPayment || !email}
      >
        {isCreatingPayment ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Gerando PIX...
          </>
        ) : (
          `Gerar PIX de ${formattedPrice}`
        )}
      </Button>
      <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
        <Lock className="h-3 w-3" />
        Pagamento seguro via Mercado Pago
      </p>
    </div>
  );
}
