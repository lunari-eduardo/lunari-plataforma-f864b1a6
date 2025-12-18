import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useIntegracoes } from '@/hooks/useIntegracoes';
import { toast } from 'sonner';

export default function IntegracoesCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleOAuthCallback, connecting } = useIntegracoes();

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error) {
      console.error('[IntegracoesCallback] OAuth error:', error, errorDescription);
      toast.error(errorDescription || 'Erro ao conectar conta');
      navigate('/integracoes', { replace: true });
      return;
    }

    if (code) {
      console.log('[IntegracoesCallback] Processing OAuth code');
      handleOAuthCallback(code).then((success) => {
        navigate('/integracoes', { replace: true });
      });
    } else {
      // No code, redirect back
      navigate('/integracoes', { replace: true });
    }
  }, [searchParams, navigate, handleOAuthCallback]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-muted-foreground">Conectando sua conta Mercado Pago...</p>
    </div>
  );
}
