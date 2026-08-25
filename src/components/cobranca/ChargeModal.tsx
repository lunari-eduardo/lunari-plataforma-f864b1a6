import { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { Switch } from '@/components/ui/switch';
import { CreditCard, History, Settings2, Loader2, Link2, QrCode, Calculator, Lock, ChevronDown, ChevronUp, X, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCobranca } from '@/hooks/useCobranca';
import { Cobranca } from '@/types/cobranca';
import { ChargeLinkSection } from './ChargeLinkSection';
import { PixManualSection } from './PixManualSection';
import { AsaasChargeOptions } from './AsaasChargeOptions';
import { AsaasPixModal } from './AsaasPixModal';
import { ChargeHistory } from './ChargeHistory';
import { ProviderSelector } from './ProviderSelector';
import { SelectedProvider } from './ProviderRow';
import { assertNotAmbiguousSessionChargeClient } from './_chargeGuards';
import { PayerFieldsBlock, type PayerFieldsValue, type PayerFieldsValidity } from './PayerFieldsBlock';
import { ChargeStepBadge } from './ChargeStepBadge';

import { computeMissingFields, type PayerProvider } from './payerRequirements';
import { unmaskDigits } from '@/lib/validateCpfCnpj';
import { buildPaymentShareUrl } from '@/utils/domainUtils';
import { getUnifiedPaymentSettings } from '@/utils/paymentSettingsContext';
import { normalizeAsaasFees, type NormalizedAsaasFees } from '@/lib/anticipationUtils';




/** Códigos de erro do backend → mensagens pt-BR mapeadas para exibição. */
const BACKEND_ERROR_MESSAGES: Record<string, string> = {
  MISSING_CPF: 'CPF/CNPJ do cliente é obrigatório para gerar cobrança PIX/Boleto no Asaas.',
  MISSING_PHONE: 'Telefone do cliente é obrigatório para gerar cobrança PIX/Boleto no Asaas.',
  MISSING_NAME: 'Nome do cliente é obrigatório.',
  MISSING_EMAIL: 'Email do cliente é obrigatório.',
  INVALID_CPF: 'CPF/CNPJ inválido.',
  INVALID_EMAIL: 'Este email não é aceito pelo Asaas. Use um email sem acentos ou caracteres especiais.',
  ASAAS_CUSTOMER_ERROR: 'Erro ao sincronizar cliente com o Asaas.',
  ASAAS_PAYMENT_ERROR: 'Erro ao criar cobrança no Asaas.',
  PIX_GENERATION_FAILED: 'Falha ao gerar código PIX.',
  PIX_DISABLED: 'PIX não está habilitado nas configurações Asaas.',
  BOLETO_DISABLED: 'Boleto não está habilitado nas configurações Asaas.',
  CARD_DISABLED: 'Cartão de crédito não está habilitado nas configurações Asaas.',
  ASAAS_NOT_CONFIGURED: 'Integração Asaas não configurada.',
};

function mapBackendError(code?: string, fallback?: string): string {
  if (code && BACKEND_ERROR_MESSAGES[code]) return BACKEND_ERROR_MESSAGES[code];
  return fallback || 'Erro ao processar cobrança.';
}


interface ChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  clienteId: string;
  clienteNome: string;
  clienteWhatsapp?: string;
  sessionId?: string;
  valorSugerido: number;
  /** Quando presente, exibe stepper no header (fluxo "Cobrar tudo"). */
  step?: import('./ChargeStepBadge').ChargeStep | null;
}

interface AsaasSettingsState {
  habilitarPix: boolean;
  habilitarCartao: boolean;
  habilitarBoleto: boolean;
  maxParcelas: number;
  absorverTaxa: boolean;
  ireiAntecipar: boolean;
  repassarTaxaAntecipacao: boolean;
}

export function ChargeModal({
  isOpen,
  onClose,
  clienteId,
  clienteNome,
  clienteWhatsapp,
  sessionId,
  valorSugerido,
  step,
}: ChargeModalProps) {
  const [valor, setValor] = useState(valorSugerido);
  const [valorType, setValorType] = useState<'total' | 'parcial'>('total');
  const [descricao, setDescricao] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<SelectedProvider | null>(null);
  const [activeTab, setActiveTab] = useState<'cobrar' | 'historico'>('cobrar');
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [currentChargeId, setCurrentChargeId] = useState<string | null>(null);
  const [asaasSettings, setAsaasSettings] = useState<AsaasSettingsState | null>(null);

  // Per-charge overrides
  const [overrideRepassarTaxas, setOverrideRepassarTaxas] = useState(false);
  const [overrideAntecipar, setOverrideAntecipar] = useState(false);
  const [overrideRepassarAntecipacao, setOverrideRepassarAntecipacao] = useState(false);





  // Asaas sub-flow state
  const [asaasMode, setAsaasMode] = useState<'options' | 'pix' | 'link' | null>(null);
  const [asaasSelectedMethod, setAsaasSelectedMethod] = useState<'link' | 'pix'>('link');
  const [asaasLinkLoading, setAsaasLinkLoading] = useState(false);
  const [asaasPixLoading, setAsaasPixLoading] = useState(false);
  const [asaasPixQrCode, setAsaasPixQrCode] = useState<string | null>(null);
  const [asaasPixCopiaECola, setAsaasPixCopiaECola] = useState<string | null>(null);
  const [asaasPixModalOpen, setAsaasPixModalOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const [accountFees, setAccountFees] = useState<NormalizedAsaasFees | null>(null);

  useEffect(() => {
    if (selectedProvider !== 'asaas') return;
    (async () => {
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
        console.warn('Erro ao carregar taxas Asaas:', err);
      }
    })();
  }, [selectedProvider]);

  const calcularLiquidoEstimado = () => {
    if (!valor || valor <= 0) return { liquido: 0, detalhe: '' };
    
    if (overrideRepassarTaxas && (!overrideAntecipar || overrideRepassarAntecipacao)) {
      return {
        liquido: valor,
        detalhe: 'Cliente arca com as taxas de processamento.',
      };
    }

    const fees = accountFees || normalizeAsaasFees(null);
    const tier1 = fees.creditCard?.tiers?.[0] || { percentageFee: 2.99 };
    const opVal = fees.creditCard?.operationValue ?? 0.49;

    let descontoProcessamento = 0;
    if (!overrideRepassarTaxas) {
      descontoProcessamento = (valor * tier1.percentageFee / 100) + opVal;
    }

    let descontoAntecipacao = 0;
    if (overrideAntecipar && !overrideRepassarAntecipacao) {
      const taxaMensal = fees.creditCard?.detachedMonthlyFeeValue ?? 1.25;
      descontoAntecipacao = valor * (taxaMensal / 100);
    }

    const totalDesconto = descontoProcessamento + descontoAntecipacao;
    const liquido = Math.max(0, valor - totalDesconto);

    const desc = [];
    if (!overrideRepassarTaxas) desc.push(`processamento (~R$ ${descontoProcessamento.toFixed(2).replace('.', ',')})`);
    if (overrideAntecipar && !overrideRepassarAntecipacao) desc.push(`antecipação (~R$ ${descontoAntecipacao.toFixed(2).replace('.', ',')})`);

    const detalhe = desc.length > 0
      ? `Você absorve ${desc.join(' e ')}.`
      : 'Você absorve as taxas no cartão.';

    return { liquido, detalhe };
  };
  
  // Current charge state (after generation)
  const [currentCharge, setCurrentCharge] = useState<{
    qrCode?: string;
    qrCodeBase64?: string;
    pixCopiaCola?: string;
    pixPayload?: string;
    paymentLink?: string;
    checkoutUrl?: string;
    status?: Cobranca['status'];
  } | null>(null);

  // Dados do pagador (coletados inline antes de gerar cobrança)
  const [payer, setPayer] = useState<PayerFieldsValue>({
    nome: '',
    email: '',
    telefone: '',
    cpfCnpj: '',
  });
  const [payerValidity, setPayerValidity] = useState<PayerFieldsValidity | null>(null);
  const [payerEditing, setPayerEditing] = useState(false);


  const {
    cobrancas,
    creatingCharge,
    createPixCharge,
    createLinkCharge,
    createPixManualCharge,
    confirmPixManualPayment,
    cancelCharge,
    checkPaymentStatus,
  } = useCobranca({ clienteId, sessionId });

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setValor(valorSugerido);
      setValorType('total');
      setDescricao('');
      setSelectedProvider(null);
      setCurrentCharge(null);
      setCurrentChargeId(null);
      setCheckingStatus(false);
      setActiveTab('cobrar');
      setAsaasMode(null);
      setAsaasPixQrCode(null);
      setAsaasPixCopiaECola(null);
      setAsaasPixModalOpen(false);
      setOverrideRepassarTaxas(false);
      setOverrideAntecipar(false);
      setOverrideRepassarAntecipacao(false);
      setPayerEditing(false);
      // Hidratar payer a partir do cliente
      (async () => {

        const { data } = await supabase
          .from('clientes')
          .select('nome, email, telefone, whatsapp, cpf_cnpj')
          .eq('id', clienteId)
          .maybeSingle();
        if (data) {
          setPayer({
            nome: data.nome || clienteNome || '',
            email: data.email || '',
            telefone: (data.whatsapp || data.telefone || clienteWhatsapp || '').toString(),
            cpfCnpj: (data as any).cpf_cnpj || '',
          });
        } else {
          setPayer({
            nome: clienteNome || '',
            email: '',
            telefone: clienteWhatsapp || '',
            cpfCnpj: '',
          });
        }
      })();
    }
  }, [isOpen, valorSugerido, clienteId, clienteNome, clienteWhatsapp]);

  // (Removido) — o modal antigo tinha um bloco "Finalidade: Fotos extras"
  // com snapshot da RPC. Extras agora são cobrados exclusivamente pelo
  // `ExtraChargeModal` (botão "Cobrar extras" do card do workflow).










  // Fetch Asaas settings when provider is selected
  useEffect(() => {
    if (selectedProvider !== 'asaas') {
      setAsaasMode(null);
      return;
    }
    setAsaasMode('options');
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('usuarios_integracoes')
        .select('dados_extras')
        .eq('user_id', user.id)
        .eq('provedor', 'asaas')
        .eq('status', 'ativo')
        .single();
      if (data?.dados_extras) {
        const d = getUnifiedPaymentSettings<Record<string, unknown>>(data.dados_extras);
        // Read new fields with backward compat
        const legacyAntecipar = d.incluirTaxaAntecipacao === true;
        const ireiAntecipar = (d.ireiAntecipar as boolean) ?? legacyAntecipar;
        const repassarTaxaAntecipacao = (d.repassarTaxaAntecipacao as boolean) ?? legacyAntecipar;
        const absorverTaxa = d.absorverTaxa ?? true;

        setAsaasSettings({
          habilitarPix: d.habilitarPix !== false,
          habilitarCartao: d.habilitarCartao !== false,
          habilitarBoleto: d.habilitarBoleto === true,
          maxParcelas: (d.maxParcelas as number) || 12,
          absorverTaxa,
          ireiAntecipar,
          repassarTaxaAntecipacao,
        });
        // Pre-fill per-charge overrides from global settings (qualquer override na hora de gerar deve prevalecer)
        setOverrideRepassarTaxas(!absorverTaxa);
        setOverrideAntecipar(ireiAntecipar);
        setOverrideRepassarAntecipacao(ireiAntecipar ? repassarTaxaAntecipacao : false);
      }
    })();
  }, [selectedProvider]);

  // Update valor when type changes
  useEffect(() => {
    if (valorType === 'total') {
      setValor(valorSugerido);
    }
  }, [valorType, valorSugerido]);

  const handleProviderSelect = (provider: SelectedProvider) => {
    setSelectedProvider(provider);
    setCurrentCharge(null);
    setCurrentChargeId(null);
  };

  /**
   * Valida o contrato Gestão↔Gallery antes de submeter qualquer cobrança.
   *
   * IMPORTANTE: Este modal só cobra a SESSÃO. Fotos extras têm modal
   * dedicado (`ExtraChargeModal`) que chama `gallery-create-payment`.
   * Mantemos o guard anti-ambiguidade para bloquear "cobrar como sessão"
   * um valor que bata com o saldo pendente de extras.
   */
  const buildBindingPayload = async (): Promise<
    | {
        finalidade: 'sessao';
      }
    | null
  > => {
    const { toast } = await import('sonner');
    if (sessionId) {
      const guard = await assertNotAmbiguousSessionChargeClient(sessionId, valor);
      if (guard.error) {
        toast.error(guard.error.message);
        return null;
      }
    }
    return { finalidade: 'sessao' };
  };


  /**
   * Persiste os dados do pagador no CRM antes de gerar cobrança.
   * Só grava em campos vazios (regra: nunca sobrescrever whatsapp).
   */
  const persistPayerToCrm = useCallback(async () => {
    try {
      const { data: current } = await supabase
        .from('clientes')
        .select('nome, email, telefone, cpf_cnpj')
        .eq('id', clienteId)
        .maybeSingle();
      if (!current) return;
      const patch: Record<string, string> = {};
      const isEmpty = (v: unknown) => v == null || (typeof v === 'string' && v.trim() === '');
      if (payer.nome.trim() && isEmpty(current.nome)) patch.nome = payer.nome.trim();
      if (payer.email.trim() && isEmpty(current.email) && payerValidity?.email) {
        patch.email = payer.email.trim();
      }
      if (payer.telefone && isEmpty(current.telefone) && payerValidity?.telefone) {
        patch.telefone = unmaskDigits(payer.telefone);
      }
      if (payer.cpfCnpj && isEmpty((current as any).cpf_cnpj) && payerValidity?.cpfCnpj) {
        (patch as any).cpf_cnpj = unmaskDigits(payer.cpfCnpj);
      }
      if (Object.keys(patch).length > 0) {
        await supabase.from('clientes').update(patch).eq('id', clienteId);
      }
    } catch (err) {
      console.warn('[ChargeModal] persistPayerToCrm failed:', err);
    }
  }, [clienteId, payer, payerValidity]);

  const handleGenerateCharge = async () => {
    if (!selectedProvider) return;
    const binding = await buildBindingPayload();
    if (!binding) return;
    await persistPayerToCrm();

    if (selectedProvider === 'pix_manual') {
      const result = await createPixManualCharge({
        clienteId,
        sessionId,
        valor,
        descricao: descricao || undefined,
        tipoCobranca: 'pix',
        provedor: 'pix_manual',
        finalidade: binding.finalidade,
      });

      if (result.success) {
        setCurrentCharge({
          pixPayload: result.pixPayload,
          pixCopiaCola: result.pixPayload,
          status: 'pendente',
        });
        if (result.cobranca?.id) {
          setCurrentChargeId(result.cobranca.id);
        }
      }
      return;
    }

    const provedor = selectedProvider === 'infinitepay' ? 'infinitepay' : 'mercadopago';

    const result = await createLinkCharge({
      clienteId,
      sessionId,
      valor,
      descricao: descricao || undefined,
      tipoCobranca: 'link',
      provedor,
      finalidade: binding.finalidade,
    });

    if (result.success) {
      const linkUrl = result.checkoutUrl || result.paymentLink;
      if (linkUrl) {
        setCurrentCharge({
          paymentLink: linkUrl,
          checkoutUrl: linkUrl,
          status: 'pendente',
        });
        if (result.cobranca?.id) {
          setCurrentChargeId(result.cobranca.id);
        }
      }
    }
  };

  const handleAsaasGeneratePix = async () => {
    const binding = await buildBindingPayload();
    if (!binding) return;

    setAsaasPixLoading(true);
    try {
      const response = await supabase.functions.invoke('create-cobranca', {
        body: {
          clienteId,
          sessionId,
          valor,
          descricao: descricao || undefined,
          provedor: 'asaas',
          billingType: 'PIX',
          finalidade: binding.finalidade,
          idempotencyKey: crypto.randomUUID(),
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (!response.data?.success) {
        throw new Error(mapBackendError(response.data?.code, response.data?.error));
      }

      const qrCode = response.data.pixQrCodeBase64
        ? (response.data.pixQrCodeBase64.startsWith('data:') ? response.data.pixQrCodeBase64 : `data:image/png;base64,${response.data.pixQrCodeBase64}`)
        : null;
      setAsaasPixQrCode(qrCode);
      setAsaasPixCopiaECola(response.data.pixCopiaCola || null);
      setAsaasPixModalOpen(true);
      setCurrentChargeId(response.data.cobrancaId);
    } catch (err) {
      const { toast } = await import('sonner');
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar PIX');
    } finally {
      setAsaasPixLoading(false);
    }
  };

  const handleAsaasGenerateLink = async () => {
    const binding = await buildBindingPayload();
    if (!binding) return;

    setAsaasLinkLoading(true);
    try {
      const result = await createLinkCharge({
        clienteId,
        sessionId,
        valor,
        descricao: descricao || 'Cobrança Asaas',
        tipoCobranca: 'link',
        provedor: 'asaas',
        finalidade: binding.finalidade,
        dadosExtras: {
          repassarTaxasProcessamento: overrideRepassarTaxas,
          anteciparParcelas: overrideAntecipar,
          repassarTaxaAntecipacao: overrideAntecipar ? overrideRepassarAntecipacao : false,
        },
      });

      if (result.success) {
        const linkUrl = result.checkoutUrl || result.paymentLink;
        if (linkUrl) {
          setCurrentCharge({
            paymentLink: linkUrl,
            checkoutUrl: linkUrl,
            status: 'pendente',
          });
          if (result.cobrancaId) {
            setCurrentChargeId(result.cobrancaId);
          }
          setAsaasMode('link');
        }
      }
    } catch (err) {
      const { toast } = await import('sonner');
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar link');
    } finally {
      setAsaasLinkLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!currentChargeId) return;
    
    setCheckingStatus(true);
    try {
      const result = await checkPaymentStatus(currentChargeId);
      if (result.updated || result.status === 'pago') {
        setCurrentCharge(prev => prev ? { ...prev, status: 'pago' } : null);
      }
    } finally {
      setCheckingStatus(false);
    }
  };

  const showLinkSection = selectedProvider === 'mercadopago_link' || selectedProvider === 'infinitepay';
  const showPixManualSection = selectedProvider === 'pix_manual';
  const showAsaasSection = selectedProvider === 'asaas';

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(v) => { if (!v) onClose(); }}>
        <SheetContent
          side="right"
          className={cn(
            'w-full sm:max-w-[520px] p-0 gap-0 flex flex-col',
            'h-dvh max-h-dvh bg-background backdrop-blur-none shadow-2xl',
          )}
        >
          {/* ============================ CABEÇALHO FIXO ============================ */}
          <header className="shrink-0 pt-3.5 pb-0 px-4 border-b border-border/60 relative">
            <div className="flex items-center justify-between mb-3 pr-6">
              <SheetTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                <CreditCard className="h-4 w-4 text-accent-gold" />
                Cobrar cliente
                <span className="text-sm font-normal text-muted-foreground ml-1">· {clienteNome}</span>
              </SheetTitle>
              {step ? <ChargeStepBadge step={step} /> : null}
            </div>

            <div className="flex items-center gap-6">
              <button
                className={cn(
                  "flex items-center gap-2 pb-2.5 border-b-2 text-xs font-semibold transition-colors",
                  activeTab === 'cobrar' ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setActiveTab('cobrar')}
              >
                <CreditCard className="h-3.5 w-3.5" />
                Nova cobrança
              </button>
              <button
                className={cn(
                  "flex items-center gap-2 pb-2.5 border-b-2 text-xs font-semibold transition-colors",
                  activeTab === 'historico' ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setActiveTab('historico')}
              >
                <History className="h-3.5 w-3.5" />
                Histórico ({cobrancas.length})
              </button>
            </div>
          </header>

          {/* =========================== CONTEÚDO ROLÁVEL =========================== */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-4" style={{ WebkitOverflowScrolling: 'touch' }}>
            {activeTab === 'cobrar' ? (
              <>
                {/* VALOR E TIPO DA COBRANÇA */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Valor da cobrança
                    </Label>
                    <RadioGroup
                      value={valorType}
                      onValueChange={(v) => setValorType(v as 'total' | 'parcial')}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-1.5">
                        <RadioGroupItem value="total" id="total" />
                        <Label htmlFor="total" className="text-xs font-medium cursor-pointer">Total</Label>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <RadioGroupItem value="parcial" id="parcial" />
                        <Label htmlFor="parcial" className="text-xs font-medium cursor-pointer">Parcial</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      <span className="text-base font-bold text-muted-foreground">R$</span>
                    </div>
                    <Input
                      type="number"
                      value={valor || ''}
                      onChange={(e) => setValor(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                      onFocus={(e) => { if (valor === 0) e.target.value = ''; }}
                      className="pl-12 h-12 text-lg font-bold bg-muted/30 border-border/60 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/50"
                      disabled={valorType === 'total'}
                      placeholder="0,00"
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                      <Calculator className="h-4 w-4 text-muted-foreground/50" />
                    </div>
                  </div>
                </div>

                {/* DESCRIÇÃO (INPUT DE 1 LINHA COMPACTO) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Descrição (Opcional)
                    </Label>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {descricao.length}/140
                    </span>
                  </div>
                  <Input
                    type="text"
                    placeholder="Ex.: Sinal do ensaio de Natal, pacote completo, etc."
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value.substring(0, 140))}
                    className="h-10 text-xs bg-muted/30 border-border/60 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/50"
                  />
                </div>

                {/* MEIO DE COBRANÇA */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Meio de cobrança
                  </Label>
                  <ProviderSelector
                    selectedProvider={selectedProvider}
                    onSelect={handleProviderSelect}
                  />
                  {showLinkSection && (
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
                      <Lock className="h-3 w-3" />
                      <span>O cliente receberá um link de pagamento para pagar online.</span>
                    </div>
                  )}
                </div>

                {/* CONFIGURAÇÕES DO PAGAMENTO (APENAS OPÇÕES EDITÁVEIS NA CRIAÇÃO) */}
                {showAsaasSection && asaasSettings && asaasMode === 'options' && (
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Configurações do pagamento
                      </Label>
                      <button 
                        type="button" 
                        onClick={() => setShowSettings(!showSettings)}
                        className="text-[11px] text-muted-foreground font-medium hover:text-foreground flex items-center gap-1 transition-colors"
                      >
                        {showSettings ? 'Ocultar' : 'Expandir'}
                        {showSettings ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                    </div>

                    {showSettings && (
                      <div className="space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-200">
                        {/* TAXAS DO CARTÃO */}
                        <div className="space-y-1.5">
                          <Label className="text-[10px] text-muted-foreground uppercase font-medium">Taxas do Cartão</Label>
                          <RadioGroup 
                            value={overrideRepassarTaxas ? "cliente" : "eu"}
                            onValueChange={(v) => setOverrideRepassarTaxas(v === 'cliente')}
                            className="grid grid-cols-1 gap-2"
                          >
                            <Label htmlFor="tx-cliente" className={cn("flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors shadow-xs", overrideRepassarTaxas ? "border-primary bg-primary/5" : "border-border/60 bg-muted/10 hover:bg-muted/30")}>
                              <RadioGroupItem value="cliente" id="tx-cliente" />
                              <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-semibold">Cliente paga as taxas</span>
                                <span className="text-[10px] text-muted-foreground font-normal">O valor das taxas será repassado ao cliente.</span>
                              </div>
                            </Label>
                            <Label htmlFor="tx-eu" className={cn("flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors shadow-xs", !overrideRepassarTaxas ? "border-primary bg-primary/5" : "border-border/60 bg-muted/10 hover:bg-muted/30")}>
                              <RadioGroupItem value="eu" id="tx-eu" />
                              <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-semibold">Eu pago as taxas</span>
                                <span className="text-[10px] text-muted-foreground font-normal">As taxas serão descontadas do valor recebido.</span>
                              </div>
                            </Label>
                          </RadioGroup>
                        </div>

                        {/* ANTECIPAÇÃO */}
                        <div className="space-y-1.5">
                          <Label className="text-[10px] text-muted-foreground uppercase font-medium">Antecipação</Label>
                          <div className="p-3 bg-muted/30 border border-border/60 rounded-xl space-y-3 shadow-xs">
                             <div className="flex items-center justify-between">
                               <div className="flex flex-col gap-0.5">
                                 <span className="text-xs font-semibold">Solicitar antecipação automática</span>
                                 <span className="text-[10px] text-muted-foreground font-normal">Receba o valor das parcelas antecipado</span>
                               </div>
                               <Switch checked={overrideAntecipar} onCheckedChange={(v) => {
                                 setOverrideAntecipar(v);
                                 if (!v) setOverrideRepassarAntecipacao(false);
                               }} />
                             </div>
                             
                             {overrideAntecipar && (
                               <div className="pt-2.5 border-t border-border/60 flex items-center justify-between animate-in fade-in">
                                 <div className="flex flex-col gap-0.5">
                                   <span className="text-xs font-semibold text-primary">Repassar custo da antecipação</span>
                                   <span className="text-[10px] text-muted-foreground font-normal">Inclui taxa no valor cobrado do cliente</span>
                                 </div>
                                 <Switch checked={overrideRepassarAntecipacao} onCheckedChange={setOverrideRepassarAntecipacao} />
                               </div>
                             )}
                          </div>
                        </div>

                        {/* RECEBIMENTO LÍQUIDO ESTIMADO (CALCULADO EM TEMPO REAL) */}
                        {(() => {
                          const est = calcularLiquidoEstimado();
                          return (
                            <div className="flex items-center justify-between p-3.5 bg-muted/40 border border-border/60 rounded-xl shadow-xs mt-1">
                              <div className="flex items-center gap-2.5">
                                <div className="h-8 w-8 rounded-lg bg-background border border-border/60 flex items-center justify-center shrink-0">
                                  <span className="text-xs font-bold text-muted-foreground">%</span>
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Recebimento líquido estimado</span>
                                  <span className="text-[10px] text-muted-foreground truncate leading-tight">
                                    {est.detalhe}
                                  </span>
                                </div>
                              </div>
                              <span className="text-base font-bold text-foreground pl-2 whitespace-nowrap">
                                R$ {est.liquido.toFixed(2).replace('.', ',')}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {/* AÇÕES DE GERAÇÃO E TIPO DE COBRANÇA */}
                <div className="pt-3 space-y-3">
                  {showPixManualSection && (
                    <PixManualSection valor={valor} pixPayload={currentCharge?.pixPayload} status={currentCharge?.status} loading={creatingCharge} clienteWhatsapp={clienteWhatsapp} chargeId={currentChargeId || undefined} onGenerate={handleGenerateCharge} onConfirmPayment={confirmPixManualPayment} />
                  )}

                  {showLinkSection && (
                    <ChargeLinkSection valor={valor} paymentLink={currentCharge?.paymentLink} status={currentCharge?.status} loading={creatingCharge} checkingStatus={checkingStatus} onGenerate={handleGenerateCharge} onCheckStatus={currentChargeId ? handleCheckStatus : undefined} clienteWhatsapp={clienteWhatsapp} />
                  )}

                  {showAsaasSection && asaasMode === 'options' && asaasSettings && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          Tipo de cobrança
                        </Label>
                        <AsaasChargeOptions valor={valor} selectedMethod={asaasSelectedMethod} onSelectMethod={setAsaasSelectedMethod} hasPix={asaasSettings.habilitarPix} />
                      </div>
                      
                      <div className="pt-1">
                        {asaasSelectedMethod === 'pix' ? (
                          <Button onClick={handleAsaasGeneratePix} disabled={asaasPixLoading} className="w-full h-12 text-xs font-bold uppercase tracking-wider rounded-xl shadow-xs">
                            {asaasPixLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Gerar PIX — R$ {valor.toFixed(2).replace('.', ',')}
                          </Button>
                        ) : (
                          <Button onClick={handleAsaasGenerateLink} disabled={asaasLinkLoading} className="w-full h-12 text-xs font-bold uppercase tracking-wider rounded-xl shadow-xs">
                            {asaasLinkLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Gerar Link — R$ {valor.toFixed(2).replace('.', ',')}
                          </Button>
                        )}
                      </div>
                    </>
                  )}

                  {showAsaasSection && asaasMode === 'link' && (
                    <ChargeLinkSection valor={valor} paymentLink={currentCharge?.paymentLink} status={currentCharge?.status} loading={creatingCharge} checkingStatus={checkingStatus} onGenerate={handleAsaasGenerateLink} onCheckStatus={currentChargeId ? handleCheckStatus : undefined} clienteWhatsapp={clienteWhatsapp} />
                  )}
                </div>

              </>
            ) : (
              <ChargeHistory cobrancas={cobrancas} onCancel={cancelCharge} />
            )}
          </div>
          
          {/* ============================= RODAPÉ FIXO ============================== */}
          <footer className="shrink-0 border-t border-border/60 p-3 px-4 bg-background/95 backdrop-blur-sm flex items-center justify-between gap-3 shadow-lg">
            <Button variant="outline" onClick={onClose} className="rounded-xl h-10 px-5 text-xs font-semibold bg-muted/40 hover:bg-muted border-border/60">
              Cancelar
            </Button>
            {activeTab === 'historico' && (
              <Button onClick={() => setActiveTab('cobrar')} className="rounded-xl h-10 px-5 text-xs font-semibold">
                Nova Cobrança
              </Button>
            )}
          </footer>
        </SheetContent>
      </Sheet>
      
      <AsaasPixModal 
        isOpen={asaasPixModalOpen}
        onClose={() => setAsaasPixModalOpen(false)}
        qrCodeBase64={asaasPixQrCode}
        copiaECola={asaasPixCopiaECola}
        valor={valor}
      />
    </>
  );
}
