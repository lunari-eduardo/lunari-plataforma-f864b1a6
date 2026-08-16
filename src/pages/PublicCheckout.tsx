import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { CreditCard, QrCode, Copy, CheckCircle, Loader2, Lock, AlertCircle, ShieldCheck, User, Phone, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { calcularAntecipacao } from '@/lib/anticipationUtils';
import { cn } from '@/lib/utils';
import CheckoutShell, { CheckoutSkeleton } from './checkout/CheckoutShell';
import ProviderCheckout, { ProviderBlock, Provedor } from './checkout/ProviderCheckout';
import { PayerValue } from './checkout/PayerGate';
import { PublicThemeWrapper } from '@/components/shared/PublicThemeWrapper';

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
    const ireiAntecipar = data.settings.ireiAntecipar ?? false;
    const repassarAntecipacao = ireiAntecipar ? (data.settings.repassarTaxaAntecipacao ?? false) : false;
    const repassarTaxas = !data.settings.absorverTaxa;
    for (let i = 1; i <= data.settings.maxParcelas; i++) {
      let totalComTaxas = valor;
      let label = `${i}x de R$ ${(valor / i).toFixed(2)}`;

      if (data.accountFees) {
        const activeTiers = (data.accountFees.discount?.active && data.accountFees.discount.tiers.length > 0)
          ? data.accountFees.discount.tiers
          : data.accountFees.creditCard.tiers;
        const tier = activeTiers.find(t => i >= t.min && i <= t.max);
        const processingPercentage = tier?.percentageFee ?? 0;
        const processingFee = repassarTaxas
          ? (valor * processingPercentage / 100) + data.accountFees.creditCard.operationValue
          : 0;

        let anticipationFee = 0;
        if (repassarAntecipacao) {
          const taxaMensal = i === 1
            ? data.accountFees.creditCard.detachedMonthlyFeeValue
            : data.accountFees.creditCard.installmentMonthlyFeeValue;
          const result = calcularAntecipacao(valor, i, taxaMensal);
          anticipationFee = result.totalTaxa;
        }

        totalComTaxas = valor + processingFee + anticipationFee;
        totalComTaxas = Math.round(totalComTaxas * 100) / 100;

        label = `${i}x de R$ ${(totalComTaxas / i).toFixed(2)}`;
        if (totalComTaxas > valor) label += ` (total R$ ${totalComTaxas.toFixed(2)})`;
      }

      installmentOptions.push({ value: String(i), label, totalValue: totalComTaxas });
    }
  }

  const selectedOption = installmentOptions.find(o => o.value === cardInstallments);
  const valorComTaxas = selectedOption?.totalValue ?? data?.cobranca.valor ?? 0;

  // ═══════════════════ RENDER ═══════════════════
  if (loading) {
    return <CheckoutSkeleton />;
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

  if (pixConfirmed || cardSuccess) {
    return (
      <PublicThemeWrapper primaryColor={data.theme?.primaryColor || undefined}>
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
          {data?.photographer?.name && (
            <p className="text-xs text-neutral-500 pt-4 border-t border-neutral-100">
              {data.photographer.name}
            </p>
          )}
        </div>
      </div>
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
  const bothTabs = settings.habilitarPix && settings.habilitarCartao;

  // ——— Layout base (estilo Gallery, imagens 4 e 5) ———
  return (
    <PublicThemeWrapper primaryColor={data.theme?.primaryColor || undefined} className="flex flex-col items-center px-4 py-6">
      <Sonner />
      <div className="max-w-md w-full space-y-4">
        {/* Header — logo/nome do fotógrafo + selo em uma linha compacta */}
        <div className="flex items-center justify-between gap-3">
          {photographer.logoUrl ? (
            <img src={photographer.logoUrl} alt={photographer.name || 'Estúdio'} className="h-8 object-contain opacity-90" />
          ) : photographer.name ? (
            <h1 className="text-sm font-medium text-neutral-500 truncate">{photographer.name}</h1>
          ) : <span />}
          <div className="flex items-center gap-1 text-[10px] text-primary shrink-0">
            <Lock className="h-3 w-3" />
            Ambiente seguro
          </div>
        </div>

        {/* Valor destacado (compacto) */}
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-medium">Pagamento</p>
          <p className="text-3xl font-bold text-primary tracking-tight leading-tight">
            R$ {cobranca.valor.toFixed(2).replace('.', ',')}
          </p>
          {cobranca.descricao && (
            <p className="text-xs text-neutral-600 mt-0.5">{cobranca.descricao}</p>
          )}
        </div>


        {/* Tabs segmentadas (pill) — só quando ambos habilitados */}
        {bothTabs && (
          <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-neutral-100">
            <button
              type="button"
              onClick={() => setTab('pix')}
              className={cn(
                'flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all',
                tab === 'pix'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900',
              )}
            >
              <QrCode className="h-4 w-4" /> PIX
            </button>
            <button
              type="button"
              onClick={() => setTab('card')}
              className={cn(
                'flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all',
                tab === 'card'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900',
              )}
            >
              <CreditCard className="h-4 w-4" /> Cartão
            </button>
          </div>
        )}

        {/* ══════════════════ PIX ══════════════════ */}
        {tab === 'pix' && settings.habilitarPix && (
          <div className="space-y-4">
            {!pixCopiaECola ? (
              <>
                {/* Coleta inline: pergunta apenas o que falta */}
                {(stillMissing.name || stillMissing.email || stillMissing.phone || stillMissing.cpfCnpj) && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-neutral-900">
                      <User className="h-4 w-4 text-primary" />
                      Seus dados para o PIX
                    </div>
                    <p className="text-xs text-neutral-600">
                      Precisamos destes dados para gerar a cobrança e enviar o comprovante.
                    </p>

                    {stillMissing.name && (
                      <div className="space-y-1">
                        <Label className="text-xs text-neutral-700">Nome completo</Label>
                        <Input
                          value={payerName}
                          onChange={(e) => setPayerName(e.target.value)}
                          placeholder="Seu nome"
                          className="bg-white border-neutral-200"
                        />
                      </div>
                    )}
                    {stillMissing.cpfCnpj && (
                      <div className="space-y-1">
                        <Label className="text-xs text-neutral-700">CPF ou CNPJ</Label>
                        <Input
                          value={payerCpf}
                          onChange={(e) => setPayerCpf(maskCpfCnpj(e.target.value))}
                          placeholder="000.000.000-00"
                          inputMode="numeric"
                          className="bg-white border-neutral-200"
                        />
                      </div>
                    )}
                    {stillMissing.email && (
                      <div className="space-y-1">
                        <Label className="text-xs text-neutral-700">Email</Label>
                        <Input
                          type="email"
                          value={payerEmail}
                          onChange={(e) => setPayerEmail(e.target.value)}
                          placeholder="voce@email.com"
                          className="bg-white border-neutral-200"
                        />
                      </div>
                    )}
                    {stillMissing.phone && (
                      <div className="space-y-1">
                        <Label className="text-xs text-neutral-700">Telefone</Label>
                        <Input
                          value={payerPhone}
                          onChange={(e) => setPayerPhone(maskPhone(e.target.value))}
                          placeholder="(00) 00000-0000"
                          inputMode="tel"
                          className="bg-white border-neutral-200"
                        />
                      </div>
                    )}
                  </div>
                )}

                {pixError && (
                  <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/5 border border-destructive/20 rounded-md p-3">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{pixError}</span>
                  </div>
                )}

                <Button
                  className="w-full h-12 gap-2 text-base font-medium"
                  onClick={generatePix}
                  disabled={pixLoading}
                >
                  {pixLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                  Gerar QR Code PIX
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                {pixQrCode && (
                  <div className="flex justify-center">
                    <img src={pixQrCode} alt="QR Code PIX" className="w-56 h-56 rounded-lg border border-neutral-200 bg-white p-2" />
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-xs text-neutral-700">Código PIX Copia e Cola</Label>
                  <div className="flex gap-2">
                    <Input value={pixCopiaECola} readOnly className="font-mono text-xs bg-white border-neutral-200" />
                    <Button variant="outline" size="icon" onClick={handleCopyPix} className="shrink-0">
                      {pixCopied ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-neutral-600 text-center flex items-center justify-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Aguardando confirmação do pagamento...
                </p>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════ CARTÃO ══════════════════ */}
        {tab === 'card' && settings.habilitarCartao && (
          <div className="space-y-3">
            {/* Dados do titular */}
            <div className="grid grid-cols-1 gap-2">
              <Input
                value={payerName}
                onChange={(e) => setPayerName(e.target.value.toUpperCase())}
                placeholder="Nome no cartão"
                className="h-9 bg-white border-neutral-200"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={payerCpf}
                  onChange={(e) => setPayerCpf(maskCpfCnpj(e.target.value))}
                  placeholder="CPF / CNPJ"
                  inputMode="numeric"
                  className="h-9 bg-white border-neutral-200"
                />
                <Input
                  type="email"
                  value={payerEmail}
                  onChange={(e) => setPayerEmail(e.target.value)}
                  placeholder="Email"
                  className="h-9 bg-white border-neutral-200"
                />
              </div>
            </div>

            {/* Dados do cartão */}
            <div className="grid grid-cols-1 gap-2">
              <Input
                value={cardNumber}
                onChange={(e) => setCardNumber(maskCardNumber(e.target.value))}
                placeholder="Número do cartão"
                inputMode="numeric"
                className="h-9 bg-white border-neutral-200"
              />
              <div className="grid grid-cols-3 gap-2">
                <Input
                  value={cardExpiry}
                  onChange={(e) => setCardExpiry(maskExpiry(e.target.value))}
                  placeholder="MM/AA"
                  inputMode="numeric"
                  className="h-9 bg-white border-neutral-200"
                />
                <Input
                  value={cardCvv}
                  onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="CVV"
                  inputMode="numeric"
                  className="h-9 bg-white border-neutral-200"
                />
                <Input
                  value={cardCep}
                  onChange={(e) => setCardCep(maskCep(e.target.value))}
                  placeholder="CEP"
                  inputMode="numeric"
                  className="h-9 bg-white border-neutral-200"
                />
              </div>
              <Input
                value={payerPhone}
                onChange={(e) => setPayerPhone(maskPhone(e.target.value))}
                placeholder="Telefone (opcional)"
                inputMode="tel"
                className="h-9 bg-white border-neutral-200"
              />
            </div>

            {/* Parcelas */}
            <Select value={cardInstallments} onValueChange={setCardInstallments}>
              <SelectTrigger className="h-9 bg-white border-neutral-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {installmentOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {cardError && (
              <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/5 border border-destructive/20 rounded-md p-2.5">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{cardError}</span>
              </div>
            )}

            <Button
              className="w-full h-11 gap-2 text-base font-medium"
              onClick={handleCardSubmit}
              disabled={cardLoading}
            >
              {cardLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              Finalizar · R$ {valorComTaxas.toFixed(2).replace('.', ',')}
            </Button>

            <p className="text-[10px] text-neutral-500 text-center flex items-center justify-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              Seus dados estão protegidos com segurança de ponta a ponta.
            </p>
          </div>
        )}


        {/* Voltar */}
        {(pixCopiaECola || tab === 'card') && (
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                if (pixCopiaECola) {
                  setPixCopiaECola(null);
                  setPixQrCode(null);
                  if (pollRef.current) clearInterval(pollRef.current);
                } else {
                  setTab('pix');
                }
              }}
              className="text-sm text-neutral-600 hover:text-neutral-900 inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar
            </button>
          </div>
        )}
      </div>
    </PublicThemeWrapper>
  );
}
