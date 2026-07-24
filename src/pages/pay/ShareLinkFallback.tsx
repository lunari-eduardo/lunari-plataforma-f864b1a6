/**
 * ShareLinkFallback — rota SPA de defesa em profundidade para `/l/:cobrancaId`.
 *
 * Em produção o rewrite da Vercel encaminha `/l/:cobrancaId` para a edge
 * function `payment-link-preview`, que devolve HTML branded para crawlers e
 * redireciona humanos para `/pay/ip/:id` (InfinitePay) ou `/checkout/:id`
 * (Asaas/MP/PIX). Se o rewrite falhar (cache antigo, deploy quebrado, dev
 * local), esta rota React resolve o provedor e navega para o checkout
 * correto — sem quebrar UX.
 */
import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export default function ShareLinkFallback() {
  const { cobrancaId } = useParams<{ cobrancaId: string }>();
  const [target, setTarget] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!cobrancaId) {
      setNotFound(true);
      return;
    }
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('cobrancas')
        .select('id, provedor')
        .eq('id', cobrancaId)
        .maybeSingle();
      if (!alive) return;
      if (!data) {
        setNotFound(true);
        return;
      }
      setTarget(
        data.provedor === 'infinitepay'
          ? `/pay/ip/${data.id}`
          : `/checkout/${data.id}`,
      );
    })();
    return () => {
      alive = false;
    };
  }, [cobrancaId]);

  if (notFound) return <Navigate to="/" replace />;
  if (target) return <Navigate to={target} replace />;
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin mr-2" />
      Redirecionando…
    </div>
  );
}
