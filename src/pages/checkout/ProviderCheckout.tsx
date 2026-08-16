/**
 * ProviderCheckout — painel de pagamento dos provedores que não são Asaas
 * (Mercado Pago, InfinitePay e PIX manual), dentro da mesma casca branded.
 *
 * Regra comum: os dados faltantes do pagador são coletados pelo `PayerGate`
 * e gravados no CRM. Quando o cliente clica em "Continuar", para links externos
 * (InfinitePay / Mercado Pago) a transição e redirecionamento são imediatos.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { AlertCircle, CheckCircle, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import PayerGate, { PayerValue, payerMissingFields, savePayerToCrm } from './PayerGate';
import { unmaskDigits } from '@/lib/validateCpfCnpj';

const SUPABASE_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID || 'tlnjspsywycbudhewsfv'}.supabase.co`;
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const POLL_INTERVAL = 15_000;
const POLL_MAX = 10 * 60 * 1000;

export type Provedor = 'mercadopago' | 'pix_manual' | 'infinitepay';

const REQUIRED_BY_PROVIDER: Record<Provedor, Array<keyof PayerValue>> = {
  mercadopago: ['nome', 'email', 'telefone'],
  pix_manual: ['nome'],
  infinitepay: ['nome', 'telefone', 'cpfCnpj', 'email'],
};

export interface ProviderBlock {
  initPoint?: string | null;
  pixCopiaECola?: string | null;
  pixQrCodeBase64?: string | null;
  checkoutUrl?: string | null;
}

interface Props {
  provedor: Provedor;
  cobrancaId: string;
  provider: ProviderBlock;
  payer: PayerValue;
  onPayerChange: (v: PayerValue) => void;
  onPaid: () => void;
}

export default function ProviderCheckout({
  provedor,
  cobrancaId,
  provider,
  payer,
  onPayerChange,
  onPaid,
}: Props) {
  const required = REQUIRED_BY_PROVIDER[provedor];
  const missing = payerMissingFields(required, payer);
  const [gateDone, setGateDone] = useState(missing.length === 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef(0);

  const pixPayload = provider.pixCopiaECola || null;

  // QR do PIX (manual ou MP) — gerado localmente a partir do copia-e-cola.
  useEffect(() => {
    if (provider.pixQrCodeBase64) {
      setQrDataUrl(`data:image/png;base64,${provider.pixQrCodeBase64}`);
      return;
    }
    if (!pixPayload) return;
    QRCode.toDataURL(pixPayload, { width: 320, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [pixPayload, provider.pixQrCodeBase64]);

  // Polling de confirmação enquanto o PIX está na tela.
  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollStartRef.current = Date.now();
    pollRef.current = setInterval(async () => {
      if (Date.now() - pollStartRef.current > POLL_MAX) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        return;
      }
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/check-payment-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cobrancaId, forceUpdate: false }),
        });
        const json = await res.json();
        if (json.status === 'pago' || json.updated) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          onPaid();
        }
      } catch {
        /* retry */
      }
    }, POLL_INTERVAL);
  }, [cobrancaId, onPaid]);

  useEffect(() => {
    if (gateDone && pixPayload) startPolling();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [gateDone, pixPayload, startPolling]);

  const handleCopy = async () => {
    if (!pixPayload) return;
    try {
      await navigator.clipboard.writeText(pixPayload);
      setCopied(true);
      toast.success('Código PIX copiado!');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const goMercadoPago = async (currentPayer: PayerValue = payer) => {
    if (!provider.initPoint) {
      setError('Link do Mercado Pago indisponível. Peça um novo link ao fotógrafo.');
      return;
    }
    setBusy(true);
    await savePayerToCrm(cobrancaId, currentPayer);
    window.location.href = provider.initPoint;
  };

  const goInfinitePay = async (currentPayer: PayerValue = payer) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/pay-infinitepay-finalize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(PUBLISHABLE_KEY
            ? { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${PUBLISHABLE_KEY}` }
            : {}),
        },
        body: JSON.stringify({
          cobrancaId,
          payerPatch: {
            nome: currentPayer.nome.trim() || undefined,
            email: currentPayer.email.trim() || undefined,
            telefone: unmaskDigits(currentPayer.telefone) || undefined,
            cpfCnpj: unmaskDigits(currentPayer.cpfCnpj) || undefined,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success || !json.checkoutUrl) {
        throw new Error(json.error || 'Não foi possível abrir o checkout.');
      }
      window.location.href = json.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar');
      setBusy(false);
      setGateDone(false);
    }
  };

  const handleGateDone = async () => {
    if (provedor === 'infinitepay') {
      await goInfinitePay(payer);
    } else if (provedor === 'mercadopago' && !pixPayload) {
      await goMercadoPago(payer);
    } else {
      setGateDone(true);
    }
  };

  if (!gateDone) {
    return (
      <div className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/5 border border-destructive/20 rounded-md p-3">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <PayerGate
          cobrancaId={cobrancaId}
          value={payer}
          onChange={onPayerChange}
          required={required}
          onDone={handleGateDone}
          ctaLabel={provedor === 'infinitepay' ? 'Ir para o pagamento seguro' : 'Continuar'}
          loading={busy}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/5 border border-destructive/20 rounded-md p-3">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* PIX (manual ou Mercado Pago com copia-e-cola) */}
      {pixPayload ? (
        <div className="space-y-4">
          {qrDataUrl && (
            <div className="flex justify-center">
              <img
                src={qrDataUrl}
                alt="QR Code PIX"
                className="w-56 h-56 rounded-lg border border-neutral-200 bg-white p-2"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-xs text-neutral-700">Código PIX Copia e Cola</Label>
            <div className="flex gap-2">
              <Input
                value={pixPayload}
                readOnly
                className="font-mono text-xs bg-white border-neutral-200"
              />
              <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
                {copied ? (
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <p className="text-xs text-neutral-600 text-center flex items-center justify-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            {provedor === 'pix_manual'
              ? 'Após pagar, o fotógrafo confirmará o recebimento.'
              : 'Aguardando confirmação do pagamento...'}
          </p>
        </div>
      ) : provedor === 'mercadopago' ? (
        <Button className="w-full h-12 gap-2 text-base font-medium" onClick={() => goMercadoPago()} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
          Pagar com Mercado Pago
        </Button>
      ) : provedor === 'infinitepay' ? (
        <Button className="w-full h-12 gap-2 text-base font-medium" onClick={() => goInfinitePay()} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
          Ir para o pagamento seguro
        </Button>
      ) : (
        <div className="flex items-start gap-2 text-sm text-neutral-700 bg-neutral-100 rounded-md p-3">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          Este link de pagamento está indisponível. Peça um novo link ao fotógrafo.
        </div>
      )}
    </div>
  );
}
