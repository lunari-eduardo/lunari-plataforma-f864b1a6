import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_URL } from '../types';

interface UsePaymentDetectionProps {
  identifier?: string;
  galleryId: string | null | undefined;
  sessionId: string | null | undefined;
  visitorId: string | null;
  onPaymentSuccess: () => void;
  refetchGallery: () => Promise<any>;
}

export function usePaymentDetection({
  identifier,
  galleryId,
  sessionId,
  visitorId,
  onPaymentSuccess,
  refetchGallery,
}: UsePaymentDetectionProps) {
  const [isProcessingPaymentReturn, setIsProcessingPaymentReturn] = useState(false);
  const paymentRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    
    // Capture ALL InfinitePay redirect parameters
    const orderNsu = params.get('order_nsu');
    const transactionNsu = params.get('transaction_nsu');
    const slug = params.get('slug');
    const receiptUrl = params.get('receipt_url');
    const captureMethod = params.get('capture_method');
    
    if (paymentStatus === 'success' && galleryId && !isProcessingPaymentReturn) {
      setIsProcessingPaymentReturn(true);
      
      // Clean URL params immediately (no blocking UI)
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      
      const confirmPaymentReturn = async () => {
        try {
          console.log('🔄 Verificação silenciosa de pagamento em background:', {
            orderNsu, transactionNsu, slug, captureMethod,
          });
          
          const response = await fetch(`${SUPABASE_URL}/functions/v1/check-payment-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              galleryId: galleryId,
              galleryToken: identifier,
              sessionId: sessionId,
              visitorId: visitorId || undefined,
              orderNsu, transactionNsu, slug, receiptUrl,
              forceUpdate: true,
            }),
          });
          
          const result = await response.json();
          console.log('✅ Resultado verificação silenciosa:', result);
          
          if (result.status === 'pago' || result.updated) {
            onPaymentSuccess();
            refetchGallery();
          } else {
            // Not yet confirmed — start Realtime subscription + fallback polling
            const channel = supabase
              .channel(`payment-return-${sessionId || galleryId}`)
              .on(
                'postgres_changes',
                {
                  event: 'UPDATE',
                  schema: 'public',
                  table: 'cobrancas',
                  ...(sessionId ? { filter: `session_id=eq.${sessionId}` } : {}),
                },
                (payload) => {
                  if ((payload.new as any).status === 'pago') {
                    console.log('✅ Realtime: pagamento confirmado');
                    if (paymentRetryRef.current) clearTimeout(paymentRetryRef.current);
                    supabase.removeChannel(channel);
                    onPaymentSuccess();
                    refetchGallery();
                  }
                }
              )
              .subscribe();

            // Polling adaptativo: 3s nos primeiros 30s, depois 60s (safety net)
            const startTime = Date.now();
            const tick = async () => {
              if (Date.now() - startTime > 10 * 60 * 1000) {
                if (paymentRetryRef.current) clearTimeout(paymentRetryRef.current);
                supabase.removeChannel(channel);
                return;
              }
              try {
                const retryResponse = await fetch(`${SUPABASE_URL}/functions/v1/check-payment-status`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ sessionId, visitorId: visitorId || undefined, orderNsu, forceUpdate: false }),
                });
                const retryResult = await retryResponse.json();
                if (retryResult.status === 'pago' || retryResult.updated) {
                  if (paymentRetryRef.current) clearTimeout(paymentRetryRef.current);
                  supabase.removeChannel(channel);
                  onPaymentSuccess();
                  refetchGallery();
                  return;
                }
              } catch (e) {
                console.error('[Auto-retry] Error:', e);
              }
              const elapsed = Date.now() - startTime;
              const nextDelay = elapsed < 30_000 ? 3_000 : 60_000;
              paymentRetryRef.current = setTimeout(tick, nextDelay);
            };
            paymentRetryRef.current = setTimeout(tick, 3_000);
          }
        } catch (error) {
          console.error('❌ Erro ao verificar pagamento:', error);
          refetchGallery();
        }
      };
      
      confirmPaymentReturn();
    }
    
    return () => {
      if (paymentRetryRef.current) {
        clearTimeout(paymentRetryRef.current);
        paymentRetryRef.current = null;
      }
    };
  }, [galleryId, sessionId, isProcessingPaymentReturn, identifier, visitorId, onPaymentSuccess, refetchGallery]);

  return {
    isProcessingPaymentReturn,
  };
}
