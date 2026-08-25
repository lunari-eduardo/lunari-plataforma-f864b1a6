import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { CreditCard, QrCode, Copy, CheckCircle, Loader2, Lock, AlertCircle, ShieldCheck, User, Phone, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { calcularAntecipacao, calculateCreditFees, normalizeAsaasFees, NormalizedAsaasFees } from '@/lib/anticipationUtils';
import { cn } from '@/lib/utils';
import CheckoutShell, { CheckoutSkeleton } from './checkout/CheckoutShell';
import ProviderCheckout, { ProviderBlock, Provedor } from './checkout/ProviderCheckout';
import { PayerValue } from './checkout/PayerGate';
import { PublicThemeWrapper } from '@/components/shared/PublicThemeWrapper';
import { AsaasCheckout } from '@/components/AsaasCheckout';

const SUPABASE_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID || 'tlnjspsywycbudhewsfv'}.supabase.co`;
const POLL_INTERVAL = 15_000;
const POLL_MAX = 10 * 60 * 1000;

// ——— Masks ———
function maskCpfCnpj(v: string): string {
  const d = v.replace(/\D/g, '');
  if (d.length <= 11) {
    return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
}
function maskCardNumber(v: string): string {
  return v.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ').trim().slice(0, 19);
}
function maskExpiry(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 4);
  if (d.length >= 3) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return d;
}
function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length > 6) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length > 2) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  return d;
}
function maskCep(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8);
  if (d.length > 5) return `${d.slice(0,5)}-${d.slice(5)}`;
  return d;
}

// ——— Validation ———
function validateCpf(cpf: string): boolean {
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(d[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === parseInt(d[10]);
}
function validateCpfCnpj(val: string): boolean {
  const d = val.replace(/\D/g, '');
  if (d.length === 11) return validateCpf(val);
  if (d.length === 14) return true;
  return false;
}
function isAsciiEmail(v: string): boolean {
  const s = (v || '').trim();
  if (!s || /[^\x00-\x7F]/.test(s)) return false;
  return /^[\x21-\x7E]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(s);
}

interface AccountFees {
  creditCard: {
    operationValue: number;
    detachedMonthlyFeeValue: number;
    installmentMonthlyFeeValue: number;
    tiers: Array<{ min: number; max: number; percentageFee: number }>;
  };
  pix: { fixedFeeValue: number };
  discount?: {
    active: boolean;
    expiration?: string;
    tiers: Array<{ min: number; max: number; percentageFee: number }>;
  };
}

interface PayerHints {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  cpfCnpj: string | null;
}
interface PayerMissing {
  name: boolean;
  email: boolean;
  phone: boolean;
  cpfCnpj: boolean;
}

interface CheckoutData {
  provedor?: string;
  provider?: ProviderBlock;
  cobranca: { id: string; valor: number; descricao: string; status: string };
  photographer: { name: string | null; logoUrl: string | null; userId: string };
  settings: {
    habilitarPix: boolean;
    habilitarCartao: boolean;
    habilitarBoleto: boolean;
    maxParcelas: number;
    absorverTaxa: boolean;
    ireiAntecipar?: boolean;
    repassarTaxaAntecipacao?: boolean;
    incluirTaxaAntecipacao?: boolean;
  };
  accountFees: AccountFees | null;
  payerHints?: PayerHints;
  payerMissing?: PayerMissing;
  theme?: { primaryColor: string | null };
  galleryToken?: string | null;
  isPaid?: boolean;
}

type Tab = 'pix' | 'card';

export default function PublicCheckout() {
  const { cobrancaId } = useParams<{ cobrancaId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CheckoutData | null>(null);
  const [tab, setTab] = useState<Tab>('pix');

  // PIX state
  const [pixLoading, setPixLoading] = useState(false);
  const [pixQrCode, setPixQrCode] = useState<string | null>(null);
  const [pixCopiaECola, setPixCopiaECola] = useState<string | null>(null);
  const [pixCopied, setPixCopied] = useState(false);
  const [pixConfirmed, setPixConfirmed] = useState(false);
  const [pixError, setPixError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);
  const autoPixRef = useRef<boolean>(false);

  // Payer inline collection (PIX + shared)
  const [payerName, setPayerName] = useState('');
  const [payerEmail, setPayerEmail] = useState('');
  const [payerPhone, setPayerPhone] = useState('');
  const [payerCpf, setPayerCpf] = useState('');

  // Card state
  const [cardLoading, setCardLoading] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardCep, setCardCep] = useState('');
  const [cardInstallments, setCardInstallments] = useState('1');
  const [cardError, setCardError] = useState<string | null>(null);
  const [cardSuccess, setCardSuccess] = useState(false);

  // Fetch checkout data
  useEffect(() => {
    if (!cobrancaId) return;
    fetch(`${SUPABASE_URL}/functions/v1/checkout-get-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cobrancaId }),
    })
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          setData(result);
          const h: PayerHints | undefined = result.payerHints;
          if (h) {
            setPayerName(h.fullName || '');
            setPayerEmail(h.email || '');
            setPayerPhone(h.phone ? maskPhone(h.phone) : '');
            setPayerCpf(h.cpfCnpj ? maskCpfCnpj(h.cpfCnpj) : '');
          }
          setTab(result.settings?.habilitarPix ? 'pix' : 'card');
        } else if (result.code === 'INVALID_STATUS' && result.error?.includes('já foi paga')) {
          setCardSuccess(true);
        } else {
          setError(result.error || 'Cobrança não encontrada');
        }
      })
      .catch(() => setError('Erro ao carregar dados do pagamento'))
      .finally(() => setLoading(false));
  }, [cobrancaId]);

  // Cleanup polling
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const missing: PayerMissing = data?.payerMissing || { name: !payerName, email: !payerEmail, phone: !payerPhone, cpfCnpj: !payerCpf };

  // Recompute "missing" locally sempre que o usuário digitar (para esconder campos preenchidos).
  const stillMissing = {
    name: missing.name && !payerName.trim(),
    email: missing.email && !isAsciiEmail(payerEmail),
    phone: missing.phone && payerPhone.replace(/\D/g, '').length < 10,
    cpfCnpj: missing.cpfCnpj && !validateCpfCnpj(payerCpf),
  };
  const noMissingFields = !stillMissing.name && !stillMissing.email && !stillMissing.phone && !stillMissing.cpfCnpj;

  // PIX flow
  const generatePix = useCallback(async () => {
    if (!cobrancaId) return;
    setPixError(null);

    // Coleta inline: para PIX Asaas, CPF é obrigatório.
    if (!validateCpfCnpj(payerCpf)) {
      setPixError('Informe um CPF ou CNPJ válido para gerar o PIX.');
      return;
    }
    if (payerPhone && payerPhone.replace(/\D/g, '').length < 10) {
      setPixError('Telefone inválido.');
      return;
    }

    setPixLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/checkout-process-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cobrancaId,
          billingType: 'PIX',
          payerContact: {
            name: payerName.trim() || undefined,
            email: isAsciiEmail(payerEmail) ? payerEmail.trim() : undefined,
            phone: payerPhone ? payerPhone.replace(/\D/g, '') : undefined,
            cpfCnpj: payerCpf ? payerCpf.replace(/\D/g, '') : undefined,
          },
        }),
      });
      const result = await res.json();
      if (!result.success) {
        if (result.code === 'MISSING_CPF') {
          setPixError('CPF/CNPJ é obrigatório para gerar o PIX. Confirme os dados acima.');
          return;
        }
        throw new Error(result.error || 'Erro ao gerar PIX');
      }

      setPixQrCode(result.pixQrCode ? `data:image/png;base64,${result.pixQrCode}` : null);
      setPixCopiaECola(result.pixCopiaECola || null);

      pollStartRef.current = Date.now();
      pollRef.current = setInterval(async () => {
        if (Date.now() - pollStartRef.current > POLL_MAX) {
          if (pollRef.current) clearInterval(pollRef.current);
          return;
        }
        try {
          const pollRes = await fetch(`${SUPABASE_URL}/functions/v1/check-payment-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cobrancaId, forceUpdate: false }),
          });
          const pollData = await pollRes.json();
          if (pollData.status === 'pago' || pollData.updated) {
            if (pollRef.current) clearInterval(pollRef.current);
            setPixConfirmed(true);
          }
        } catch { /* retry */ }
      }, POLL_INTERVAL);
    } catch (err) {
      setPixError(err instanceof Error ? err.message : 'Erro ao gerar PIX');
    } finally {
      setPixLoading(false);
    }
  }, [cobrancaId, payerCpf, payerEmail, payerName, payerPhone]);

  // Auto-gerar PIX quando o CRM já enviou todos os dados necessários
  useEffect(() => {
    if (autoPixRef.current) return;
    if (!data || (data.provedor ?? 'asaas') !== 'asaas') return;
    if (tab !== 'pix' || !data.settings.habilitarPix) return;
    if (pixCopiaECola || pixLoading || pixError) return;
    if (!noMissingFields) return;
    if (!validateCpfCnpj(payerCpf)) return;
    autoPixRef.current = true;
    void generatePix();
  }, [data, tab, noMissingFields, payerCpf, pixCopiaECola, pixLoading, pixError, generatePix]);


  const handleCopyPix = async () => {
    if (!pixCopiaECola) return;
    try {
      await navigator.clipboard.writeText(pixCopiaECola);
      setPixCopied(true);
      toast.success('Código PIX copiado!');
      setTimeout(() => setPixCopied(false), 3000);
    } catch { toast.error('Erro ao copiar'); }
  };

  // Card flow
  const handleCardSubmit = async () => {
    if (!cobrancaId || !data) return;
    setCardError(null);

    if (!payerName.trim()) { setCardError('Informe o nome no cartão'); return; }
    if (!validateCpfCnpj(payerCpf)) { setCardError('CPF/CNPJ inválido'); return; }
    const rawCard = cardNumber.replace(/\s/g, '');
    if (rawCard.length < 13) { setCardError('Número do cartão inválido'); return; }
    const [expM, expY] = cardExpiry.split('/');
    if (!expM || !expY || parseInt(expM) < 1 || parseInt(expM) > 12) { setCardError('Validade inválida'); return; }
    if (cardCvv.length < 3) { setCardError('CVV inválido'); return; }
    if (!isAsciiEmail(payerEmail)) { setCardError('Informe um email válido'); return; }
    if (payerPhone.replace(/\D/g, '').length < 10) { setCardError('Telefone inválido'); return; }
    if (cardCep.replace(/\D/g, '').length < 8) { setCardError('CEP inválido'); return; }

    setCardLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/checkout-process-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cobrancaId,
          billingType: 'CREDIT_CARD',
          installmentCount: parseInt(cardInstallments),
          payerContact: {
            name: payerName.trim(),
            email: payerEmail.trim(),
            phone: payerPhone.replace(/\D/g, ''),
            cpfCnpj: payerCpf.replace(/\D/g, ''),
          },
          creditCard: {
            holderName: payerName.toUpperCase(),
            number: rawCard,
            expiryMonth: expM,
            expiryYear: `20${expY}`,
            ccv: cardCvv,
          },
          creditCardHolderInfo: {
            name: payerName,
            cpfCnpj: payerCpf.replace(/\D/g, ''),
            email: payerEmail,
            phone: payerPhone.replace(/\D/g, ''),
            postalCode: cardCep.replace(/\D/g, ''),
            addressNumber: 'S/N',
          },
        }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || 'Pagamento recusado');

      if (result.paid || result.creditCardStatus === 'CONFIRMED') {
        setCardSuccess(true);
        toast.success('Pagamento aprovado!');
        if (!result.paid) {
          pollStartRef.current = Date.now();
          pollRef.current = setInterval(async () => {
            if (Date.now() - pollStartRef.current > POLL_MAX) {
              if (pollRef.current) clearInterval(pollRef.current);
              return;
            }
            try {
              const pollRes = await fetch(`${SUPABASE_URL}/functions/v1/check-payment-status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cobrancaId, forceUpdate: true }),
              });
              const pollData = await pollRes.json();
              if (pollData.status === 'pago' || pollData.updated) {
                if (pollRef.current) clearInterval(pollRef.current);
              }
            } catch { /* retry */ }
          }, POLL_INTERVAL);
        }
      } else {
        throw new Error('Pagamento não aprovado. Tente outro cartão.');
      }
    } catch (err) {
      setCardError(err instanceof Error ? err.message : 'Erro no pagamento');
    } finally {
      setCardLoading(false);
    }
  };

  // Installment options
  const installmentOptions: Array<{ value: string; label: string; totalValue: number }> = [];
  if (data) {
    const valor = data.cobranca.valor;
    const ireiAntecipar = data.settings?.ireiAntecipar ?? false;
    const repassarAntecipacao = ireiAntecipar ? (data.settings?.repassarTaxaAntecipacao ?? false) : false;
    const repassarTaxas = !data.settings?.absorverTaxa;
    const maxParcelas = data.settings?.maxParcelas || 12;

    const normalizedFees = normalizeAsaasFees(data.accountFees);

    for (let i = 1; i <= maxParcelas; i++) {
      const calc = calculateCreditFees(valor, i, normalizedFees, repassarTaxas, repassarAntecipacao);
      const totalComTaxas = calc.totalValue;
      const installmentValue = calc.installmentValue;

      let label = `${i}x de R$ ${installmentValue.toFixed(2).replace('.', ',')}`;
      if (totalComTaxas > valor) {
        label += ` (total R$ ${totalComTaxas.toFixed(2).replace('.', ',')})`;
      }

      installmentOptions.push({ value: String(i), label, totalValue: totalComTaxas });
    }
  }

  const selectedOption = installmentOptions.find(o => o.value === cardInstallments);
  const valorComTaxas = selectedOption?.totalValue ?? data?.cobranca.valor ?? 0;

  // ═══════════════════ RENDER ═══════════════════
  if (loading) {
    return (
      <PublicThemeWrapper>
        <CheckoutSkeleton />
      </PublicThemeWrapper>
    );
  }

  if (error || !data) {
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

  if (pixConfirmed || cardSuccess || data?.isPaid || data?.cobranca?.status === 'pago') {
    return (
      <PublicThemeWrapper primaryColor={data?.theme?.primaryColor || undefined}>
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
          {data?.galleryToken && (
            <Button
              className="w-full h-11 text-sm font-medium"
              onClick={() => window.location.href = `/g/${data.galleryToken}`}
            >
              Voltar para a Galeria
            </Button>
          )}
          {data?.photographer?.name && (
            <p className="text-xs text-neutral-500 pt-4 border-t border-neutral-100">
              {data.photographer.name}
            </p>
          )}
          </div>
        </div>
      </PublicThemeWrapper>
    );
  }

  const provedorAtual = (data.provedor ?? 'asaas') as string;

  // ——— Provedores não-Asaas: mesma casca, painel próprio ———
  if (provedorAtual !== 'asaas') {
    const payerValue: PayerValue = {
      nome: payerName,
      email: payerEmail,
      telefone: payerPhone,
      cpfCnpj: payerCpf,
    };
    return (
      <PublicThemeWrapper primaryColor={data.theme?.primaryColor || undefined}>
        <CheckoutShell
          photographer={data.photographer}
          valor={data.cobranca.valor}
          descricao={data.cobranca.descricao}
        >
        <Sonner />
        <ProviderCheckout
          provedor={provedorAtual as Provedor}
          cobrancaId={data.cobranca.id}
          provider={data.provider || {}}
          payer={payerValue}
          onPayerChange={(v) => {
            setPayerName(v.nome);
            setPayerEmail(v.email);
            setPayerPhone(v.telefone);
            setPayerCpf(v.cpfCnpj);
          }}
          onPaid={() => setPixConfirmed(true)}
        />
      </CheckoutShell>
      </PublicThemeWrapper>
    );
  }

  const { cobranca, photographer, settings } = data;

  const handlePersistContact = async (contactData: { email?: string; phone?: string; nome?: string; cpfCnpj?: string }) => {
    if (!cobrancaId) return;
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/checkout-save-payer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cobrancaId,
          payer: {
            nome: contactData.nome,
            email: contactData.email,
            telefone: contactData.phone,
            cpfCnpj: contactData.cpfCnpj,
          }
        }),
      });
    } catch (e) {
      console.error("Erro ao salvar payer:", e);
    }
  };

  return (
    <PublicThemeWrapper primaryColor={data.theme?.primaryColor || undefined}>
      <Sonner />
      <AsaasCheckout
        data={{
          userId: photographer.userId,
          valorTotal: cobranca.valor,
          descricao: cobranca.descricao,
          cobrancaId: cobranca.id,
          enabledMethods: {
            pix: settings.habilitarPix,
            creditCard: settings.habilitarCartao,
            boleto: settings.habilitarBoleto,
          },
          maxParcelas: settings.maxParcelas || 12,
          absorverTaxa: settings.absorverTaxa,
          ireiAntecipar: settings.ireiAntecipar,
          repassarTaxaAntecipacao: settings.repassarTaxaAntecipacao,
          incluirTaxaAntecipacao: settings.incluirTaxaAntecipacao,
        }}
        initialAccountFees={data.accountFees || undefined}
        studioName={photographer.name || undefined}
        studioLogoUrl={photographer.logoUrl || undefined}
        payerHints={{
          fullName: data.payerHints?.fullName,
          email: data.payerHints?.email,
          phone: data.payerHints?.phone,
          cpfCnpj: data.payerHints?.cpfCnpj,
        }}
        payerMissing={data.payerMissing}
        onPaymentConfirmed={() => setPixConfirmed(true)}
        onPersistContact={handlePersistContact}
      />
    </PublicThemeWrapper>
  );
}
