import { AlertCircle } from 'lucide-react';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { PublicThemeWrapper } from '@/components/shared/PublicThemeWrapper';

interface PublicCheckoutErrorProps {
  error?: string | null;
}

export function PublicCheckoutError({ error }: PublicCheckoutErrorProps) {
  return (
    <PublicThemeWrapper>
      <div className="min-h-screen flex items-center justify-center p-4">
        <Sonner />
        <div className="max-w-sm w-full text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-xl font-semibold text-neutral-900">Pagamento indisponível</h1>
          <p className="text-neutral-600">{error || 'Cobrança não encontrada'}</p>
        </div>
      </div>
    </PublicThemeWrapper>
  );
}
