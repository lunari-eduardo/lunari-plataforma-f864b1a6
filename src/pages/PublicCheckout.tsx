import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { CreditCard, QrCode, Copy, CheckCircle, Loader2, Lock, AlertCircle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { calcularAntecipacao } from '@/lib/anticipationUtils';

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

interface CheckoutData {
  cobranca: { id: string; valor: number; descricao: string; status: string };
  photographer: { name: string | null; logoUrl: string | null; userId: string };
  settings: {
    habilitarPix: boolean;
    habilitarCartao: boolean;
    habilitarBoleto: boolean;
    maxParcelas: number;
    absorverTaxa: boolean;
    incluirTaxaAntecipacao: boolean;
  };
  accountFees: AccountFees | null;
}

export default function PublicCheckout() {
  const { cobrancaId } = useParams<{ cobrancaId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CheckoutData | null>(null);

  // PIX state
  const [pixLoading, setPixLoading] = useState(false);
  const [pixQrCode, setPixQrCode] = useState<string | null>(null);
  const [pixCopiaECola, setPixCopiaECola] = useState<string | null>(null);
  const [pixCopied, setPixCopied] = useState(false);
  const [pixConfirmed, setPixConfirmed] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);

  // Card state
  const [cardLoading, setCardLoading] = useState(false);
  const [cardName, setCardName] = useState('');
  const [cardCpfCnpj, setCardCpfCnpj] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardPhone, setCardPhone] = useState('');
  const [cardEmail, setCardEmail] = useState('');
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

  // PIX flow
  const generatePix = useCallback(async () => {
    if (!cobrancaId) return;
    setPixLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/checkout-process-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cobrancaId, billingType: 'PIX' }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || 'Erro ao gerar PIX');

      setPixQrCode(result.pixQrCode ? `data:image/png;base64,${result.pixQrCode}` : null);
      setPixCopiaECola(result.pixCopiaECola || null);

      // Start polling
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
            toast.success('Pagamento confirmado!');
          }
        } catch { /* retry */ }
      }, POLL_INTERVAL);

      toast.success('PIX gerado!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar PIX');
    } finally {
      setPixLoading(false);
    }
  }, [cobrancaId]);

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

    if (!cardName.trim()) { setCardError('Informe o nome no cartão'); return; }
    if (!validateCpfCnpj(cardCpfCnpj)) { setCardError('CPF/CNPJ inválido'); return; }
    const rawCard = cardNumber.replace(/\s/g, '');
    if (rawCard.length < 13) { setCardError('Número do cartão inválido'); return; }
    const [expM, expY] = cardExpiry.split('/');
    if (!expM || !expY || parseInt(expM) < 1 || parseInt(expM) > 12) { setCardError('Validade inválida'); return; }
    if (cardCvv.length < 3) { setCardError('CVV inválido'); return; }
    if (!cardEmail || !/\S+@\S+\.\S+/.test(cardEmail)) { setCardError('Informe o email'); return; }
    if (cardPhone.replace(/\D/g, '').length < 10) { setCardError('Telefone inválido'); return; }
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
          creditCard: {
            holderName: cardName,
            number: rawCard,
            expiryMonth: expM,
            expiryYear: `20${expY}`,
            ccv: cardCvv,
          },
          creditCardHolderInfo: {
            name: cardName,
            cpfCnpj: cardCpfCnpj.replace(/\D/g, ''),
            email: cardEmail,
            phone: cardPhone.replace(/\D/g, ''),
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
    const incluirAntecipacao = data.settings.incluirTaxaAntecipacao;
    for (let i = 1; i <= data.settings.maxParcelas; i++) {
      let totalComTaxas = valor;
      let label = `${i}x de R$ ${(valor / i).toFixed(2)}`;

      if (!data.settings.absorverTaxa && data.accountFees) {
        const activeTiers = (data.accountFees.discount?.active && data.accountFees.discount.tiers.length > 0)
          ? data.accountFees.discount.tiers
          : data.accountFees.creditCard.tiers;
        const tier = activeTiers.find(t => i >= t.min && i <= t.max);
        const processingPercentage = tier?.percentageFee ?? 0;
        const processingFee = (valor * processingPercentage / 100) + data.accountFees.creditCard.operationValue;

        let anticipationFee = 0;
        if (incluirAntecipacao) {
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

  // ——— RENDER ———
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Sonner />
        <div className="max-w-sm w-full text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-xl font-semibold">Pagamento indisponível</h1>
          <p className="text-muted-foreground">{error || 'Cobrança não encontrada'}</p>
        </div>
      </div>
    );
  }

  if (pixConfirmed || cardSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Sonner />
        <div className="max-w-sm w-full text-center space-y-6 animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center bg-green-100 dark:bg-green-900/30">
            <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold">Pagamento confirmado!</h1>
          <p className="text-muted-foreground">Obrigado! Seu pagamento foi processado com sucesso.</p>
        </div>
      </div>
    );
  }

  const { cobranca, photographer, settings } = data;
  const defaultTab = settings.habilitarPix ? 'pix' : 'card';
  const enabledCount = [settings.habilitarPix, settings.habilitarCartao].filter(Boolean).length;

  return (
    <div className="min-h-screen flex flex-col items-center bg-background text-foreground p-4">
      <Sonner />
      <div className="max-w-md w-full space-y-6 py-6">
        {/* Header */}
        {photographer.logoUrl ? (
          <img src={photographer.logoUrl} alt={photographer.name || 'Estúdio'} className="h-12 mx-auto object-contain" />
        ) : photographer.name ? (
          <h1 className="text-xl font-semibold text-center">{photographer.name}</h1>
        ) : null}

        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold">Pagamento</h2>
          <p className="text-3xl font-bold text-primary">R$ {cobranca.valor.toFixed(2)}</p>
          {cobranca.descricao && (
            <p className="text-sm text-muted-foreground">{cobranca.descricao}</p>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="w-full grid" style={{ gridTemplateColumns: `repeat(${enabledCount}, 1fr)` }}>
            {settings.habilitarPix && (
              <TabsTrigger value="pix" className="gap-2">
                <QrCode className="h-4 w-4" /> PIX
              </TabsTrigger>
            )}
            {settings.habilitarCartao && (
              <TabsTrigger value="card" className="gap-2">
                <CreditCard className="h-4 w-4" /> Cartão
              </TabsTrigger>
            )}
          </TabsList>

          {/* PIX Tab */}
          {settings.habilitarPix && (
            <TabsContent value="pix" className="space-y-4 pt-4">
              {!pixCopiaECola ? (
                <Button className="w-full gap-2" onClick={generatePix} disabled={pixLoading}>
                  {pixLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                  Gerar PIX
                </Button>
              ) : (
                <div className="space-y-4">
                  {pixQrCode && (
                    <div className="flex justify-center">
                      <img src={pixQrCode} alt="QR Code PIX" className="w-48 h-48 rounded-lg border" />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Código PIX Copia e Cola</Label>
                    <div className="flex gap-2">
                      <Input value={pixCopiaECola} readOnly className="font-mono text-xs" />
                      <Button variant="outline" size="icon" onClick={handleCopyPix}>
                        {pixCopied ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Aguardando confirmação do pagamento...
                  </p>
                </div>
              )}
            </TabsContent>
          )}

          {/* Card Tab */}
          {settings.habilitarCartao && (
            <TabsContent value="card" className="space-y-4 pt-4">
              <div className="grid gap-3">
                <div className="space-y-1.5">
                  <Label>Nome no cartão</Label>
                  <Input value={cardName} onChange={(e) => setCardName(e.target.value.toUpperCase())} placeholder="NOME COMPLETO" />
                </div>
                <div className="space-y-1.5">
                  <Label>CPF/CNPJ do titular</Label>
                  <Input value={cardCpfCnpj} onChange={(e) => setCardCpfCnpj(maskCpfCnpj(e.target.value))} placeholder="000.000.000-00" />
                </div>
                <div className="space-y-1.5">
                  <Label>Número do cartão</Label>
                  <Input value={cardNumber} onChange={(e) => setCardNumber(maskCardNumber(e.target.value))} placeholder="0000 0000 0000 0000" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Validade</Label>
                    <Input value={cardExpiry} onChange={(e) => setCardExpiry(maskExpiry(e.target.value))} placeholder="MM/AA" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>CVV</Label>
                    <Input value={cardCvv} onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="123" type="password" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={cardEmail} onChange={(e) => setCardEmail(e.target.value)} placeholder="email@exemplo.com" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Telefone</Label>
                    <Input value={cardPhone} onChange={(e) => setCardPhone(maskPhone(e.target.value))} placeholder="(00) 00000-0000" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>CEP</Label>
                    <Input value={cardCep} onChange={(e) => setCardCep(maskCep(e.target.value))} placeholder="00000-000" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Parcelas</Label>
                  <Select value={cardInstallments} onValueChange={setCardInstallments}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {installmentOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {cardError && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {cardError}
                </div>
              )}

              <Button className="w-full gap-2" onClick={handleCardSubmit} disabled={cardLoading}>
                {cardLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                Pagar R$ {valorComTaxas.toFixed(2)}
              </Button>
            </TabsContent>
          )}
        </Tabs>

        {/* Security badge */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-4">
          <ShieldCheck className="h-4 w-4" />
          Pagamento seguro processado por Asaas
        </div>
      </div>
    </div>
  );
}
