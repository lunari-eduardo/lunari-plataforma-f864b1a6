import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { CreditCard, History, Settings2 } from 'lucide-react';
import { useCobranca } from '@/hooks/useCobranca';
import { Cobranca } from '@/types/cobranca';
import { ChargeLinkSection } from './ChargeLinkSection';
import { PixManualSection } from './PixManualSection';
import { AsaasChargeOptions } from './AsaasChargeOptions';
import { AsaasPixModal } from './AsaasPixModal';
import { ChargeHistory } from './ChargeHistory';
import { ProviderSelector } from './ProviderSelector';
import { SelectedProvider } from './ProviderRow';
import { CobrancaFinalidadeSelector, type GalleryOption, type CobrancaFinalidadeUI } from './CobrancaFinalidadeSelector';
import {
  assertExtraPaymentWithinIdealClient,
  assertNotAmbiguousSessionChargeClient,
  type ExtraPaymentSnapshot,
} from './_chargeGuards';
import { PayerFieldsBlock, type PayerFieldsValue, type PayerFieldsValidity } from './PayerFieldsBlock';
import { PayerSummaryChip } from './PayerSummaryChip';
import { computeMissingFields, type PayerProvider } from './payerRequirements';
import { unmaskDigits } from '@/lib/validateCpfCnpj';
import { AlertTriangle } from 'lucide-react';


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

  // Contrato Gestão↔Gallery — finalidade da cobrança
  const [finalidade, setFinalidade] = useState<CobrancaFinalidadeUI>('sessao');
  const [galeriaId, setGaleriaId] = useState<string | null>(null);
  const [galeriaInfo, setGaleriaInfo] = useState<GalleryOption | null>(null);
  const [qtdFotos, setQtdFotos] = useState<number>(0);
  const [rpcSnapshot, setRpcSnapshot] = useState<ExtraPaymentSnapshot | null>(null);
  const [ambiguity, setAmbiguity] = useState<{
    galeriaId: string;
    valorSaldoExtras: number;
    qtdSugerida: number;
    nomeGaleria?: string;
  } | null>(null);


  // Asaas sub-flow state
  const [asaasMode, setAsaasMode] = useState<'options' | 'pix' | 'link' | null>(null);
  const [asaasLinkLoading, setAsaasLinkLoading] = useState(false);
  const [asaasPixLoading, setAsaasPixLoading] = useState(false);
  const [asaasPixQrCode, setAsaasPixQrCode] = useState<string | null>(null);
  const [asaasPixCopiaECola, setAsaasPixCopiaECola] = useState<string | null>(null);
  const [asaasPixModalOpen, setAsaasPixModalOpen] = useState(false);
  
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
      setFinalidade('sessao');
      setGaleriaId(null);
      setGaleriaInfo(null);
      setQtdFotos(0);
      setRpcSnapshot(null);
      setAmbiguity(null);
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

  // Snapshot canônico via RPC quando galeria selecionada (substitui cálculo local)
  useEffect(() => {
    if (finalidade !== 'fotos_extras' || !galeriaId) {
      setRpcSnapshot(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const guard = await assertExtraPaymentWithinIdealClient(galeriaId, 0);
      if (cancelled) return;
      const snap = guard.snapshot || (guard.error && 'snapshot' in guard.error ? guard.error.snapshot : null);
      if (!snap) return;
      setRpcSnapshot(snap);
      // Sugere o saldo a cobrar quando ainda não houver valor digitado manualmente
      const saldo = Number(snap.valor_a_cobrar ?? 0);
      if (saldo > 0) {
        setValor(saldo);
        setValorType('parcial');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [finalidade, galeriaId]);

  // Detecta ambiguidade (sessão com saldo de extras pendente) — banner proativo
  useEffect(() => {
    if (!isOpen || !sessionId || finalidade !== 'sessao') {
      setAmbiguity(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const guard = await assertNotAmbiguousSessionChargeClient(sessionId, -1);
      // Truque: passar valor inválido (-1) só pega o caminho se houver galeria com saldo;
      // como não vai bater no ±1%, usamos uma busca direta abaixo.
      void guard;
      // Busca real do saldo da 1ª galeria com extras pendentes para exibir banner
      const { data: galerias } = await supabase
        .from('galerias')
        .select('id, nome_sessao, fotos_selecionadas, fotos_incluidas, status_pagamento')
        .eq('session_id', sessionId);
      if (cancelled || !galerias) return;
      for (const g of galerias) {
        if ((g.fotos_selecionadas ?? 0) <= (g.fotos_incluidas ?? 0)) continue;
        if (g.status_pagamento === 'pago') continue;
        const { data: rpc } = await supabase.rpc('calculate_gallery_extra_payment', {
          p_gallery_id: g.id,
        });
        const snap = (rpc ?? {}) as ExtraPaymentSnapshot;
        const saldo = Number(snap.valor_a_cobrar ?? 0);
        if (saldo > 0) {
          if (cancelled) return;
          setAmbiguity({
            galeriaId: g.id,
            valorSaldoExtras: saldo,
            qtdSugerida:
              Number(snap.extras_necessarias ?? 0) - Number(snap.extras_pagas ?? 0),
            nomeGaleria: g.nome_sessao ?? undefined,
          });
          return;
        }
      }
      if (!cancelled) setAmbiguity(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, sessionId, finalidade]);





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
        const d = data.dados_extras as Record<string, unknown>;
        // Read new fields with backward compat
        const legacyAntecipar = d.incluirTaxaAntecipacao === true;
        const ireiAntecipar = (d.ireiAntecipar as boolean) ?? legacyAntecipar;
        const repassarTaxaAntecipacao = (d.repassarTaxaAntecipacao as boolean) ?? legacyAntecipar;
        const absorverTaxa = d.absorverTaxa === true;

        setAsaasSettings({
          habilitarPix: d.habilitarPix !== false,
          habilitarCartao: d.habilitarCartao !== false,
          habilitarBoleto: d.habilitarBoleto === true,
          maxParcelas: (d.maxParcelas as number) || 12,
          absorverTaxa,
          ireiAntecipar,
          repassarTaxaAntecipacao,
        });
        // Pre-fill per-charge overrides from global settings
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
   * Retorna o bloco a ser repassado às edge functions / inserts ou `null`
   * se a validação falhar (toast já mostrado).
   */
  const buildBindingPayload = async (): Promise<
    | {
        finalidade: 'sessao' | 'fotos_extras';
        galeriaId?: string;
        qtdFotos?: number;
      }
    | null
  > => {
    const { toast } = await import('sonner');
    if (finalidade === 'sessao') {
      if (sessionId) {
        const guard = await assertNotAmbiguousSessionChargeClient(sessionId, valor);
        if (guard.error) {
          toast.error(guard.error.message);
          return null;
        }
      }
      return { finalidade: 'sessao' };
    }
    if (!galeriaId) {
      toast.error('Selecione a galeria vinculada às fotos extras');
      return null;
    }
    if (!qtdFotos || qtdFotos <= 0) {
      toast.error('Informe a quantidade de fotos extras');
      return null;
    }
    const guard = await assertExtraPaymentWithinIdealClient(galeriaId, valor);
    if (guard.error) {
      toast.error(guard.error.message);
      return null;
    }
    return { finalidade: 'fotos_extras', galeriaId, qtdFotos };
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
        galeriaId: binding.galeriaId,
        qtdFotos: binding.qtdFotos,
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
      galeriaId: binding.galeriaId,
      qtdFotos: binding.qtdFotos,
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
    if (!payerValidity?.allValidFor('pix_asaas')) {
      const { toast } = await import('sonner');
      toast.error('Preencha nome, telefone e CPF/CNPJ válidos do pagador antes de gerar o PIX.');
      return;
    }
    await persistPayerToCrm();
    setAsaasPixLoading(true);
    try {
      const response = await supabase.functions.invoke('gestao-asaas-create-payment', {
        body: {
          clienteId,
          sessionId,
          valor,
          descricao: descricao || undefined,
          billingType: 'PIX',
          finalidade: binding.finalidade,
          galeriaId: binding.galeriaId,
          qtdFotos: binding.qtdFotos,
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (!response.data?.success) {
        throw new Error(mapBackendError(response.data?.code, response.data?.error));
      }

      const qrCode = response.data.pixQrCode ? `data:image/png;base64,${response.data.pixQrCode}` : null;
      setAsaasPixQrCode(qrCode);
      setAsaasPixCopiaECola(response.data.pixCopiaECola || null);
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
    // Link Asaas NÃO bloqueia por dados faltantes — o próprio cliente completa
    // no checkout público (`/checkout/:id`). Aqui só validamos que temos um nome
    // para identificar o pagador na cobrança gerada.
    if (!payer.nome?.trim()) {
      const { toast } = await import('sonner');
      toast.error('Informe pelo menos o nome do pagador antes de gerar o link.');
      return;
    }
    await persistPayerToCrm();

    setAsaasLinkLoading(true);
    try {
      // Get current user
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Não autenticado');

      // Build per-charge overrides metadata
      const chargeOverrides = {
        repassarTaxasProcessamento: overrideRepassarTaxas,
        anteciparParcelas: overrideAntecipar,
        repassarTaxaAntecipacao: overrideAntecipar ? overrideRepassarAntecipacao : false,
      };

      // Create cobrança record locally with per-charge overrides stored in dados_extras
      const insertPayload: Record<string, unknown> = {
        user_id: session.user.id,
        cliente_id: clienteId,
        session_id: sessionId || null,
        valor,
        descricao: descricao || 'Cobrança Asaas',
        tipo_cobranca: 'link',
        provedor: 'asaas',
        status: 'pendente',
        dados_extras: chargeOverrides,
        finalidade: binding.finalidade,
        correlation_id: crypto.randomUUID(),
      };
      if (binding.finalidade === 'fotos_extras') {
        insertPayload.galeria_id = binding.galeriaId;
        insertPayload.qtd_fotos = binding.qtdFotos;
      }
      const { data: cobranca, error: insertError } = await supabase
        .from('cobrancas')
        .insert(insertPayload as any)
        .select('id')
        .single();

      if (insertError || !cobranca) throw new Error('Erro ao criar cobrança');

      // Generate internal checkout URL using canonical production domain
      const { getPublicShareBaseUrl } = await import('@/utils/domainUtils');
      const checkoutUrl = `${getPublicShareBaseUrl()}/checkout/${cobranca.id}`;

      setCurrentCharge({
        paymentLink: checkoutUrl,
        checkoutUrl: checkoutUrl,
        status: 'pendente',
      });
      setCurrentChargeId(cobranca.id);
      setAsaasMode('link');
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

  const handleViewCharge = (cobranca: Cobranca) => {
    if (cobranca.provedor === 'infinitepay') {
      setSelectedProvider('infinitepay');
    } else if (cobranca.provedor === 'mercadopago') {
      setSelectedProvider('mercadopago_link');
    } else if (cobranca.provedor === 'pix_manual') {
      setSelectedProvider('pix_manual');
    }
    
    const linkUrl = cobranca.ipCheckoutUrl || cobranca.mpPaymentLink;
    setCurrentCharge({
      qrCode: cobranca.mpQrCode,
      qrCodeBase64: cobranca.mpQrCodeBase64,
      pixCopiaCola: cobranca.mpPixCopiaCola,
      pixPayload: cobranca.provedor === 'pix_manual' ? cobranca.mpPixCopiaCola : undefined,
      paymentLink: linkUrl,
      checkoutUrl: linkUrl,
      status: cobranca.status,
    });
    setCurrentChargeId(cobranca.id);
    setActiveTab('cobrar');
  };

  const showLinkSection = selectedProvider === 'mercadopago_link' || selectedProvider === 'infinitepay';
  const showPixManualSection = selectedProvider === 'pix_manual';
  const showAsaasSection = selectedProvider === 'asaas';

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          className="max-w-lg md:max-w-3xl max-h-[92vh] p-0 overflow-hidden z-[60] shadow-2xl border-2 border-border flex flex-col"
          overlayClassName="backdrop-blur-sm bg-black/60 z-[59]"
        >
          <DialogHeader className="px-4 pt-3 pb-2">
            <DialogTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4 text-primary" />
              Cobrar cliente
              <span className="text-xs text-muted-foreground font-normal ml-1">· {clienteNome}</span>
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'cobrar' | 'historico')} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <TabsList className="w-full grid grid-cols-2 mx-4 mb-2 shrink-0 h-9" style={{ width: 'calc(100% - 32px)' }}>
              <TabsTrigger value="cobrar" className="gap-2 text-xs">
                <CreditCard className="h-3.5 w-3.5" />
                Nova Cobrança
              </TabsTrigger>
              <TabsTrigger value="historico" className="gap-2 text-xs">
                <History className="h-3.5 w-3.5" />
                Histórico ({cobrancas.length})
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 min-h-0 overflow-y-auto">

              <TabsContent value="cobrar" className="p-4 pt-2 m-0">
                <div className="md:grid md:grid-cols-2 md:gap-5 space-y-4 md:space-y-0">
                  {/* ========== COLUNA ESQUERDA ========== */}
                  <div className="space-y-4">
                    {/* Valor da cobrança */}
                    <div className="space-y-2">
                      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Valor da cobrança
                      </Label>

                      <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                            R$
                          </span>
                          <Input
                            type="number"
                            value={valor || ''}
                            onChange={(e) => setValor(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                            onFocus={(e) => { if (valor === 0) e.target.value = ''; }}
                            className="pl-10 h-10 text-lg font-semibold"
                            disabled={valorType === 'total'}
                            placeholder="0"
                          />
                        </div>

                        <RadioGroup
                          value={valorType}
                          onValueChange={(v) => setValorType(v as 'total' | 'parcial')}
                          className="flex gap-3"
                        >
                          <div className="flex items-center space-x-1">
                            <RadioGroupItem value="total" id="total" />
                            <Label htmlFor="total" className="text-xs cursor-pointer">Total</Label>
                          </div>
                          <div className="flex items-center space-x-1">
                            <RadioGroupItem value="parcial" id="parcial" />
                            <Label htmlFor="parcial" className="text-xs cursor-pointer">Parcial</Label>
                          </div>
                        </RadioGroup>
                      </div>

                      <Textarea
                        placeholder="Descrição (opcional)"
                        value={descricao}
                        onChange={(e) => setDescricao(e.target.value)}
                        className="resize-none h-14 text-sm"
                      />
                    </div>

                    {/* Finalidade da cobrança */}
                    <CobrancaFinalidadeSelector
                      clienteId={clienteId}
                      sessionId={sessionId}
                      finalidade={finalidade}
                      onFinalidadeChange={(v) => {
                        setFinalidade(v);
                        if (v === 'sessao') {
                          setGaleriaId(null);
                          setGaleriaInfo(null);
                          setQtdFotos(0);
                        }
                      }}
                      galeriaId={galeriaId}
                      onGaleriaChange={(id, gal) => {
                        setGaleriaId(id);
                        setGaleriaInfo(gal);
                      }}
                      qtdFotos={qtdFotos}
                      onQtdFotosChange={setQtdFotos}
                    />

                    {/* Banner ambiguidade */}
                    {ambiguity && finalidade === 'sessao' && (
                      <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 text-sm">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                          <div className="flex-1 space-y-2">
                            <div>
                              <strong>Fotos extras pendentes nesta sessão.</strong>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Galeria "{ambiguity.nomeGaleria ?? '—'}" · {ambiguity.qtdSugerida} fotos ·{' '}
                                {ambiguity.valorSaldoExtras.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })}{' '}
                                a cobrar. Cobrar como "sessão" pode duplicar receita.
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => {
                                setFinalidade('fotos_extras');
                                setGaleriaId(ambiguity.galeriaId);
                                setQtdFotos(ambiguity.qtdSugerida);
                                setValor(ambiguity.valorSaldoExtras);
                                setValorType('parcial');
                              }}
                            >
                              Cobrar como fotos extras
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ========== COLUNA DIREITA ========== */}
                  <div className="space-y-4">
                    {/* Meio de cobrança */}
                    <div className="space-y-2">
                      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Meio de cobrança
                      </Label>
                      <ProviderSelector
                        selectedProvider={selectedProvider}
                        onSelect={handleProviderSelect}
                      />
                    </div>

                    {/* Dados do pagador — só aparece quando FALTA algo.
                        - CRM completo: nada renderizado (economiza vertical).
                        - InfinitePay: sempre um botão discreto (client-side completa no /pay/ip).
                        - Outros com missing: bloco inline compacto só com campos faltantes. */}
                    {(() => {
                      const currentProvider: PayerProvider | null =
                        selectedProvider === 'asaas'
                          ? (asaasMode === 'link' ? 'link_asaas' : 'pix_asaas')
                          : selectedProvider === 'mercadopago_link'
                            ? 'link_mp'
                            : selectedProvider === 'infinitepay'
                              ? 'link_infinitepay'
                              : selectedProvider === 'pix_manual'
                                ? 'pix_manual'
                                : null;

                      if (!currentProvider || currentProvider === 'pix_manual') return null;

                      const missing = computeMissingFields(currentProvider, payer);
                      const nothingMissing = missing.length === 0;

                      // InfinitePay: coleta pelo cliente. Botão discreto apenas.
                      if (currentProvider === 'link_infinitepay') {
                        if (payerEditing) {
                          return (
                            <div className="space-y-2">
                              <PayerFieldsBlock
                                value={payer}
                                onChange={setPayer}
                                onValidityChange={setPayerValidity}
                                provider={null}
                              />
                              <div className="flex justify-end">
                                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setPayerEditing(false)}>
                                  Recolher
                                </Button>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <span>Dados do pagador serão preenchidos pelo cliente na página de pagamento.</span>
                            <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setPayerEditing(true)}>
                              Editar
                            </Button>
                          </div>
                        );
                      }

                      // Outros provedores: nada quando completo.
                      if (nothingMissing && !payerEditing) {
                        return (
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <span>Dados do pagador OK.</span>
                            <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setPayerEditing(true)}>
                              Revisar
                            </Button>
                          </div>
                        );
                      }

                      // Faltam campos: bloco inline compacto.
                      return (
                        <div className="space-y-2">
                          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Complete os dados do pagador
                          </Label>
                          <PayerFieldsBlock
                            value={payer}
                            onChange={setPayer}
                            onValidityChange={setPayerValidity}
                            provider={currentProvider}
                            onlyShow={payerEditing ? undefined : missing}
                          />
                          {payerEditing && (
                            <div className="flex justify-end">
                              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setPayerEditing(false)}>
                                Recolher
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Per-charge Asaas overrides */}
                    {showAsaasSection && asaasSettings && asaasMode === 'options' && (
                      <div className="space-y-2">
                        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                          <Settings2 className="h-3 w-3" />
                          Opções desta cobrança
                        </Label>

                        <div className="rounded-md border border-border/60 divide-y divide-border/40">
                          <div className="flex items-center justify-between px-3 h-11">
                            <div className="min-w-0">
                              <Label htmlFor="override-taxas" className="text-sm">Repassar taxas de processamento</Label>
                              <p className="text-[11px] text-muted-foreground truncate">Cliente paga as taxas de cartão</p>
                            </div>
                            <Switch id="override-taxas" checked={overrideRepassarTaxas} onCheckedChange={setOverrideRepassarTaxas} />
                          </div>

                          <div className="flex items-center justify-between px-3 h-11">
                            <div className="min-w-0">
                              <Label htmlFor="override-antecipar" className="text-sm">Antecipar parcelas</Label>
                              <p className="text-[11px] text-muted-foreground truncate">Solicitar antecipação no Asaas</p>
                            </div>
                            <Switch id="override-antecipar" checked={overrideAntecipar} onCheckedChange={(v) => {
                              setOverrideAntecipar(v);
                              if (!v) setOverrideRepassarAntecipacao(false);
                            }} />
                          </div>

                          {overrideAntecipar && (
                            <div className="flex items-center justify-between px-3 h-11 bg-primary/5">
                              <div className="min-w-0 pl-3 border-l-2 border-primary/40">
                                <Label htmlFor="override-repassar-antecipacao" className="text-sm">Repassar antecipação</Label>
                                <p className="text-[11px] text-muted-foreground truncate">Inclui taxa no valor do cliente</p>
                              </div>
                              <Switch id="override-repassar-antecipacao" checked={overrideRepassarAntecipacao} onCheckedChange={setOverrideRepassarAntecipacao} />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ========== AÇÃO PRINCIPAL (largura total) ========== */}
                <div className="mt-5 pt-4 border-t border-border/40 min-h-[110px]">
                  {showPixManualSection && (
                    <PixManualSection
                      valor={valor}
                      pixPayload={currentCharge?.pixPayload}
                      status={currentCharge?.status}
                      loading={creatingCharge}
                      clienteWhatsapp={clienteWhatsapp}
                      chargeId={currentChargeId || undefined}
                      onGenerate={handleGenerateCharge}
                      onConfirmPayment={confirmPixManualPayment}
                    />
                  )}

                  {showLinkSection && (
                    <ChargeLinkSection
                      valor={valor}
                      paymentLink={currentCharge?.paymentLink}
                      status={currentCharge?.status}
                      loading={creatingCharge}
                      checkingStatus={checkingStatus}
                      onGenerate={handleGenerateCharge}
                      onCheckStatus={currentChargeId ? handleCheckStatus : undefined}
                      clienteWhatsapp={clienteWhatsapp}
                    />
                  )}

                  {showAsaasSection && asaasMode === 'options' && asaasSettings && (
                    <AsaasChargeOptions
                      valor={valor}
                      onSelectPix={handleAsaasGeneratePix}
                      onSelectLink={handleAsaasGenerateLink}
                      pixLoading={asaasPixLoading}
                      linkLoading={asaasLinkLoading}
                      hasPix={asaasSettings.habilitarPix}
                    />
                  )}

                  {showAsaasSection && asaasMode === 'link' && (
                    <ChargeLinkSection
                      valor={valor}
                      paymentLink={currentCharge?.paymentLink}
                      status={currentCharge?.status}
                      loading={asaasLinkLoading}
                      checkingStatus={checkingStatus}
                      onGenerate={handleAsaasGenerateLink}
                      onCheckStatus={currentChargeId ? handleCheckStatus : undefined}
                      clienteWhatsapp={clienteWhatsapp}
                    />
                  )}

                  {!selectedProvider && (
                    <div className="flex items-center justify-center h-[110px] text-muted-foreground text-sm">
                      Selecione um meio de cobrança
                    </div>
                  )}
                </div>
              </TabsContent>



              <TabsContent value="historico" className="p-4 pt-2 m-0">
                <ChargeHistory
                  cobrancas={cobrancas}
                  onCancel={cancelCharge}
                  onView={handleViewCharge}
                />
              </TabsContent>
            </div>
          </Tabs>

          {/* Footer */}
          <div className="p-4 pt-2 border-t flex justify-end gap-2">
            {showAsaasSection && asaasMode === 'link' && (
              <Button variant="ghost" onClick={() => { setAsaasMode('options'); setCurrentCharge(null); }}>
                Voltar
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Asaas PIX Modal (separate dialog on top) */}
      <AsaasPixModal
        isOpen={asaasPixModalOpen}
        onClose={() => setAsaasPixModalOpen(false)}
        valor={valor}
        pixQrCode={asaasPixQrCode}
        pixCopiaECola={asaasPixCopiaECola}
        clienteWhatsapp={clienteWhatsapp}
      />
    </>
  );
}
