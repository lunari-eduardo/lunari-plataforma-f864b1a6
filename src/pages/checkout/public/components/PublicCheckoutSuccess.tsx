import { CheckCircle } from 'lucide-react';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { PublicThemeWrapper } from '@/components/shared/PublicThemeWrapper';

interface PublicCheckoutSuccessProps {
  primaryColor?: string;
}

export function PublicCheckoutSuccess({ primaryColor }: PublicCheckoutSuccessProps) {
  return (
    <PublicThemeWrapper primaryColor={primaryColor}>
      <div className="min-h-screen flex items-center justify-center p-4">
        <Sonner />
        <div className="max-w-sm w-full text-center space-y-6 animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center bg-emerald-100 shadow-sm">
            <CheckCircle className="h-10 w-10 text-emerald-600" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-neutral-900">Pagamento confirmado!</h1>
            <p className="text-neutral-600">Obrigado! Seu pagamento foi processado com sucesso.</p>
          </div>
        </div>
      </div>
    </PublicThemeWrapper>
  );
}
