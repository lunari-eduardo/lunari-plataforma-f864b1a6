/**
 * Utilitário para carregar o SDK do Mercado Pago assincronamente (apenas quando necessário).
 */
export async function loadMercadoPagoSdk(): Promise<void> {
  if (typeof window !== 'undefined' && window.MercadoPago) {
    return; // Já está carregado
  }

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[src="https://sdk.mercadopago.com/js/v2"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', (e) => reject(e));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://sdk.mercadopago.com/js/v2';
    script.async = true;

    script.onload = () => resolve();
    script.onerror = (error) => {
      console.error('Falha ao carregar SDK do Mercado Pago', error);
      reject(error);
    };

    document.head.appendChild(script);
  });
}
