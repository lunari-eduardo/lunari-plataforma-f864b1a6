import { useState, useEffect, useCallback } from 'react';
import { CreditCard, QrCode, FileText, Copy, CheckCircle, Loader2, Lock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { calcularAntecipacao } from '@/lib/anticipationUtils';

export interface AsaasCheckoutSettings {
  habilitarPix: boolean;
  habilitarCartao: boolean;
  habilitarBoleto: boolean;
  maxParcelas: number;
  absorverTaxa: boolean;
  incluirTaxaAntecipacao: boolean;
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

interface AsaasCheckoutSectionProps {
  valor: number;
  clienteId: string;
  sessionId?: string;
  descricao?: string;
  settings: AsaasCheckoutSettings;
  clienteWhatsapp?: string;
  onPaymentCreated: (result: {
    cobrancaId: string;
    pixCopiaECola?: string;
    pixQrCode?: string;
    boletoUrl?: string;
    paid: boolean;
  }) => void;
  loading?: boolean;
}

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
  if (d.length === 14) return true; // Basic CNPJ validation
  return false;
}

export function AsaasCheckoutSection({
  valor,
  clienteId,
  sessionId,
  descricao,
  settings,
  clienteWhatsapp,
  onPaymentCreated,
  loading: externalLoading,
}: AsaasCheckoutSectionProps) {
  const defaultTab = settings.habilitarPix ? 'pix' : settings.habilitarCartao ? 'card' : 'boleto';
  const [activeTab, setActiveTab] = useState(defaultTab);
  
  // PIX state
  const [pixLoading, setPixLoading] = useState(false);
  const [pixQrCode, setPixQrCode] = useState<string | null>(null);
  const [pixCopiaECola, setPixCopiaECola] = useState<string | null>(null);
  const [pixCopied, setPixCopied] = useState(false);

  // Boleto state
  const [boletoLoading, setBoletoLoading] = useState(false);
  const [boletoUrl, setBoletoUrl] = useState<string | null>(null);

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

  // Fees state
  const [accountFees, setAccountFees] = useState<AccountFees | null>(null);
  const [feesLoading, setFeesLoading] = useState(false);

  // Fetch fees if client pays
  useEffect(() => {
    if (settings.absorverTaxa || !settings.habilitarCartao) return;
    
    const fetchFees = async () => {
      setFeesLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const response = await supabase.functions.invoke('asaas-fetch-fees', {
          body: { userId: user.id },
        });

        if (response.data?.success && response.data?.accountFees) {
          setAccountFees(response.data.accountFees);
        }
      } catch (err) {
        console.error('Error fetching Asaas fees:', err);
      } finally {
        setFeesLoading(false);
      }
    };

    fetchFees();
  }, [settings.absorverTaxa, settings.habilitarCartao]);

  const handleCopyPix = async () => {
    if (!pixCopiaECola) return;
    try {
      await navigator.clipboard.writeText(pixCopiaECola);
      setPixCopied(true);
      toast.success('Código PIX copiado!');
      setTimeout(() => setPixCopied(false), 3000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const generatePix = useCallback(async () => {
    setPixLoading(true);
    try {
      const response = await supabase.functions.invoke('gestao-asaas-create-payment', {
        body: {
          clienteId,
          sessionId,
          valor,
          descricao,
          billingType: 'PIX',
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (!response.data?.success) throw new Error(response.data?.error || 'Erro ao gerar PIX');

      setPixQrCode(response.data.pixQrCode ? `data:image/png;base64,${response.data.pixQrCode}` : null);
      setPixCopiaECola(response.data.pixCopiaECola || null);

      onPaymentCreated({
        cobrancaId: response.data.cobrancaId,
        pixCopiaECola: response.data.pixCopiaECola,
        pixQrCode: response.data.pixQrCode,
        paid: false,
      });

      toast.success('PIX gerado com sucesso!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar PIX');
    } finally {
      setPixLoading(false);
    }
  }, [clienteId, sessionId, valor, descricao, onPaymentCreated]);

  const generateBoleto = useCallback(async () => {
    setBoletoLoading(true);
    try {
      const response = await supabase.functions.invoke('gestao-asaas-create-payment', {
        body: {
          clienteId,
          sessionId,
          valor,
          descricao,
          billingType: 'BOLETO',
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (!response.data?.success) throw new Error(response.data?.error || 'Erro ao gerar boleto');

      setBoletoUrl(response.data.boletoUrl || null);

      onPaymentCreated({
        cobrancaId: response.data.cobrancaId,
        boletoUrl: response.data.boletoUrl,
        paid: false,
      });

      toast.success('Boleto gerado com sucesso!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar boleto');
    } finally {
      setBoletoLoading(false);
    }
  }, [clienteId, sessionId, valor, descricao, onPaymentCreated]);

  // Calculate installments with fees
  const incluirAntecipacao = settings.incluirTaxaAntecipacao !== false;

  const installmentOptions: Array<{ value: string; label: string; totalValue: number }> = [];
  for (let i = 1; i <= (settings.maxParcelas || 12); i++) {
    let totalComTaxas = valor;
    let label = `${i}x de R$ ${(valor / i).toFixed(2)}`;

    if (!settings.absorverTaxa && accountFees) {
      const activeTiers = (accountFees.discount?.active && accountFees.discount.tiers.length > 0)
        ? accountFees.discount.tiers
        : accountFees.creditCard.tiers;
      const tier = activeTiers.find(t => i >= t.min && i <= t.max);
      const processingPercentage = tier?.percentageFee ?? 0;
      const processingFee = (valor * processingPercentage / 100) + accountFees.creditCard.operationValue;

      let anticipationFee = 0;
      if (incluirAntecipacao) {
        const taxaMensal = i === 1
          ? accountFees.creditCard.detachedMonthlyFeeValue
          : accountFees.creditCard.installmentMonthlyFeeValue;
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

  const selectedOption = installmentOptions.find(o => o.value === cardInstallments);
  const valorComTaxas = selectedOption?.totalValue ?? valor;

  const handleCardSubmit = async () => {
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
      const response = await supabase.functions.invoke('gestao-asaas-create-payment', {
        body: {
          clienteId,
          sessionId,
          valor,
          descricao,
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
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (!response.data?.success) throw new Error(response.data?.error || 'Erro no pagamento');

      const isPaid = response.data.paid || response.data.creditCardStatus === 'CONFIRMED';
      
      if (isPaid) {
        setCardSuccess(true);
        toast.success('Pagamento aprovado!');
        onPaymentCreated({
          cobrancaId: response.data.cobrancaId,
          paid: true,
        });
      } else {
        throw new Error('Pagamento não aprovado. Tente outro cartão.');
      }
    } catch (err) {
      setCardError(err instanceof Error ? err.message : 'Erro no pagamento');
    } finally {
      setCardLoading(false);
    }
  };

  if (cardSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-4">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="text-lg font-semibold">Pagamento aprovado!</h3>
        <p className="text-sm text-muted-foreground text-center">O pagamento foi processado com sucesso.</p>
      </div>
    );
  }

  const hasEnabledMethods = settings.habilitarPix || settings.habilitarCartao || settings.habilitarBoleto;

  if (!hasEnabledMethods) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
        <AlertCircle className="h-8 w-8" />
        <p className="text-sm text-center">Nenhum método de pagamento habilitado nas configurações do Asaas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center pb-2">
        <p className="text-2xl font-bold text-primary">R$ {valor.toFixed(2)}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid" style={{ gridTemplateColumns: `repeat(${[settings.habilitarPix, settings.habilitarCartao, settings.habilitarBoleto].filter(Boolean).length}, 1fr)` }}>
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
          {settings.habilitarBoleto && (
            <TabsTrigger value="boleto" className="gap-2">
              <FileText className="h-4 w-4" /> Boleto
            </TabsTrigger>
          )}
        </TabsList>

        {/* PIX Tab */}
        {settings.habilitarPix && (
          <TabsContent value="pix" className="space-y-4 pt-4">
            {!pixCopiaECola ? (
              <Button 
                className="w-full gap-2" 
                onClick={generatePix} 
                disabled={pixLoading}
              >
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
                <Input
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value.toUpperCase())}
                  placeholder="NOME COMPLETO"
                />
              </div>

              <div className="space-y-1.5">
                <Label>CPF/CNPJ do titular</Label>
                <Input
                  value={cardCpfCnpj}
                  onChange={(e) => setCardCpfCnpj(maskCpfCnpj(e.target.value))}
                  placeholder="000.000.000-00"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Número do cartão</Label>
                <Input
                  value={cardNumber}
                  onChange={(e) => setCardNumber(maskCardNumber(e.target.value))}
                  placeholder="0000 0000 0000 0000"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Validade</Label>
                  <Input
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(maskExpiry(e.target.value))}
                    placeholder="MM/AA"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>CVV</Label>
                  <Input
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="123"
                    type="password"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={cardEmail}
                  onChange={(e) => setCardEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Telefone</Label>
                  <Input
                    value={cardPhone}
                    onChange={(e) => setCardPhone(maskPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>CEP</Label>
                  <Input
                    value={cardCep}
                    onChange={(e) => setCardCep(maskCep(e.target.value))}
                    placeholder="00000-000"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Parcelas</Label>
                {feesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando taxas...
                  </div>
                ) : (
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
                )}
              </div>
            </div>

            {cardError && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                {cardError}
              </div>
            )}

            <Button 
              className="w-full gap-2" 
              onClick={handleCardSubmit}
              disabled={cardLoading}
            >
              {cardLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              Pagar R$ {valorComTaxas.toFixed(2)}
            </Button>
          </TabsContent>
        )}

        {/* Boleto Tab */}
        {settings.habilitarBoleto && (
          <TabsContent value="boleto" className="space-y-4 pt-4">
            {!boletoUrl ? (
              <Button 
                className="w-full gap-2" 
                onClick={generateBoleto}
                disabled={boletoLoading}
              >
                {boletoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Gerar Boleto
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground mb-3">Boleto gerado com sucesso!</p>
                  <Button asChild>
                    <a href={boletoUrl} target="_blank" rel="noopener noreferrer" className="gap-2">
                      <FileText className="h-4 w-4" />
                      Abrir Boleto
                    </a>
                  </Button>
                </div>
                
                <p className="text-xs text-muted-foreground text-center">
                  O boleto pode levar até 3 dias úteis para compensar.
                </p>
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
