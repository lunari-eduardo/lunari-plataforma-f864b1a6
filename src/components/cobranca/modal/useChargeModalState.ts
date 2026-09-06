import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCobranca } from '@/hooks/useCobranca';
import { Cobranca } from '@/types/cobranca';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { SelectedProvider } from '../ProviderRow';
import { type PayerFieldsValue, type PayerFieldsValidity } from '../PayerFieldsBlock';
import { getUnifiedPaymentSettings } from '@/utils/paymentSettingsContext';
import { type NormalizedAsaasFees } from '@/lib/anticipationUtils';
import { ChargeModalProps, AsaasSettingsState } from './types';
import { buildBindingPayload, persistPayerToCrm, calcularLiquidoEstimado } from './chargeHelpers';

export function useChargeModalState(props: ChargeModalProps) {
  const {
    isOpen,
    clienteId,
    clienteNome,
    clienteWhatsapp,
    sessionId,
    valorSugerido,
    valorSinal,
    finalidade = 'sessao',
    galeriaId,
    qtdFotos,
    snapshotFotosIncluidas,
    valorSessaoComponente,
    valorExtrasComponente,
    nomeSessao,
    initialTab = 'cobrar',
    descricao: descricaoInicial,
  } = props;

  const [valor, setValor] = useState(valorSugerido);
  const [valorType, setValorType] = useState<'total' | 'parcial'>('total');
  const [descricao, setDescricao] = useState(descricaoInicial ?? '');
  const [selectedProvider, setSelectedProvider] = useState<SelectedProvider | null>(null);
  const [activeTab, setActiveTab] = useState<'cobrar' | 'historico'>(initialTab);

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

  const [currentCharge, setCurrentCharge] = useState<{
    qrCode?: string;
    qrCodeBase64?: string;
    pixCopiaCola?: string;
    pixPayload?: string;
    paymentLink?: string;
    checkoutUrl?: string;
    status?: Cobranca['status'];
  } | null>(null);

  // Dados do pagador
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
    createAsaasPixCharge,
    createLinkCharge,
    createPixManualCharge,
    confirmPixManualPayment,
    cancelCharge,
    checkPaymentStatus,
  } = useCobranca({ clienteId, sessionId, galeriaId: galeriaId ?? undefined });

  const {
    dialogState: confirmDialogState,
    confirm: confirmDialog,
    handleConfirm: handleConfirmDialog,
    handleCancel: handleCancelDialog,
    handleClose: handleCloseDialog,
  } = useConfirmDialog();

  const handleSelectValorType = (type: 'total' | 'parcial') => {
    setValorType(type);
    if (type === 'total') {
      setValor(valorSugerido);
    } else if (type === 'parcial') {
      if (valorSinal && valorSinal > 0) {
        setValor(valorSinal);
        if (!descricao || descricao.trim() === '') {
          setDescricao('Entrada / Sinal');
        }
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

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

  const handleEstimatedNet = () => {
    return calcularLiquidoEstimado({
      valor,
      overrideRepassarTaxas,
      overrideAntecipar,
      overrideRepassarAntecipacao,
      accountFees,
    });
  };

  const handleCancelCharge = async (chargeId: string) => {
    const ok = await confirmDialog({
      title: "Cancelar cobrança pendente",
      description:
        "Deseja realmente cancelar esta cobrança pendente? O link de pagamento deixará de funcionar.",
      confirmText: "Cancelar cobrança",
      cancelText: "Voltar",
      variant: "destructive",
    });
    if (ok) {
      await cancelCharge(chargeId);
    }
  };

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setValor(valorSugerido);
      setValorType('total');
      if (finalidade === 'fotos_extras') {
        setDescricao(`Fotos extras${nomeSessao ? ` - ${nomeSessao}` : ''}`);
      } else if (finalidade === 'sessao_e_extras') {
        setDescricao(`Sessão + fotos extras${nomeSessao ? ` - ${nomeSessao}` : ''}`);
      } else {
        setDescricao('');
      }
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
  }, [isOpen, valorSugerido, clienteId, clienteNome, clienteWhatsapp, finalidade, nomeSessao]);

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
        const legacyAntecipar = d.incluirTaxaAntecipacao === true;
        const ireiAntecipar = (d.ireiAntecipar as boolean) ?? legacyAntecipar;
        const repassarTaxaAntecipacao = (d.repassarTaxaAntecipacao as boolean) ?? legacyAntecipar;
        const absorverTaxa = (d.absorverTaxa as boolean | undefined) ?? true;

        setAsaasSettings({
          habilitarPix: d.habilitarPix !== false,
          habilitarCartao: d.habilitarCartao !== false,
          habilitarBoleto: d.habilitarBoleto === true,
          maxParcelas: (d.maxParcelas as number) || 12,
          absorverTaxa,
          ireiAntecipar,
          repassarTaxaAntecipacao,
        });
        setOverrideRepassarTaxas(!absorverTaxa);
        setOverrideAntecipar(ireiAntecipar);
        setOverrideRepassarAntecipacao(ireiAntecipar ? repassarTaxaAntecipacao : false);
      }
    })();
  }, [selectedProvider]);

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

  const getBinding = () => {
    return buildBindingPayload({
      finalidade,
      galeriaId,
      qtdFotos,
      snapshotFotosIncluidas,
      valorSessaoComponente,
      valorExtrasComponente,
      sessionId,
      valor,
    });
  };

  const handleGenerateCharge = async () => {
    if (!selectedProvider) return;
    const binding = await getBinding();
    if (!binding) return;
    await persistPayerToCrm(clienteId, payer, payerValidity);

    if (selectedProvider === 'pix_manual') {
      const result = await createPixManualCharge({
        clienteId,
        sessionId,
        galeriaId: binding.galeriaId,
        qtdFotos: binding.qtdFotos,
        snapshotFotosIncluidas: binding.snapshotFotosIncluidas,
        valorSessaoComponente: binding.valorSessaoComponente,
        valorExtrasComponente: binding.valorExtrasComponente,
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
      galeriaId: binding.galeriaId,
      qtdFotos: binding.qtdFotos,
      snapshotFotosIncluidas: binding.snapshotFotosIncluidas,
      valorSessaoComponente: binding.valorSessaoComponente,
      valorExtrasComponente: binding.valorExtrasComponente,
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
    const binding = await getBinding();
    if (!binding) return;

    setAsaasPixLoading(true);
    try {
      const result = await createAsaasPixCharge({
        clienteId,
        sessionId,
        galeriaId: binding.galeriaId,
        qtdFotos: binding.qtdFotos,
        snapshotFotosIncluidas: binding.snapshotFotosIncluidas,
        valorSessaoComponente: binding.valorSessaoComponente,
        valorExtrasComponente: binding.valorExtrasComponente,
        valor,
        descricao: descricao || undefined,
        provedor: 'asaas',
        finalidade: binding.finalidade,
        tipoCobranca: 'pix',
      });

      if (result.success) {
        const qrCode = result.pixQrCodeBase64
          ? (result.pixQrCodeBase64.startsWith('data:') ? result.pixQrCodeBase64 : `data:image/png;base64,${result.pixQrCodeBase64}`)
          : null;
        setAsaasPixQrCode(qrCode);
        setAsaasPixCopiaECola(result.pixCopiaCola || null);
        setAsaasPixModalOpen(true);
        if (result.cobrancaId) setCurrentChargeId(result.cobrancaId);

        if (result.pixQrCodeMissing || (!qrCode && !result.pixCopiaCola)) {
          const { toast } = await import('sonner');
          toast.warning('Cobrança criada, mas o QR Code não foi gerado pelo Asaas. Verifique se há uma chave PIX cadastrada na sua conta Asaas.');
        }
      }
    } finally {
      setAsaasPixLoading(false);
    }
  };

  const handleAsaasGenerateLink = async () => {
    const binding = await getBinding();
    if (!binding) return;

    setAsaasLinkLoading(true);
    try {
      const result = await createLinkCharge({
        clienteId,
        sessionId,
        galeriaId: binding.galeriaId,
        qtdFotos: binding.qtdFotos,
        snapshotFotosIncluidas: binding.snapshotFotosIncluidas,
        valorSessaoComponente: binding.valorSessaoComponente,
        valorExtrasComponente: binding.valorExtrasComponente,
        valor,
        descricao: descricao || (finalidade === 'fotos_extras' ? 'Fotos extras' : finalidade === 'sessao_e_extras' ? 'Sessão + fotos extras' : 'Cobrança Asaas'),
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

  return {
    valor,
    setValor,
    valorType,
    setValorType,
    handleSelectValorType,
    descricao,
    setDescricao,
    selectedProvider,
    handleProviderSelect,
    activeTab,
    setActiveTab,
    checkingStatus,
    currentChargeId,
    currentCharge,
    asaasSettings,
    overrideRepassarTaxas,
    setOverrideRepassarTaxas,
    overrideAntecipar,
    setOverrideAntecipar,
    overrideRepassarAntecipacao,
    setOverrideRepassarAntecipacao,
    asaasMode,
    asaasSelectedMethod,
    setAsaasSelectedMethod,
    asaasLinkLoading,
    asaasPixLoading,
    asaasPixQrCode,
    asaasPixCopiaECola,
    asaasPixModalOpen,
    setAsaasPixModalOpen,
    showSettings,
    setShowSettings,
    accountFees,
    calcularLiquidoEstimado: handleEstimatedNet,
    payer,
    setPayer,
    payerValidity,
    setPayerValidity,
    payerEditing,
    setPayerEditing,
    cobrancas,
    creatingCharge,
    confirmPixManualPayment,
    confirmDialogState,
    handleConfirmDialog,
    handleCancelDialog,
    handleCloseDialog,
    handleCancelCharge,
    handleGenerateCharge,
    handleAsaasGeneratePix,
    handleAsaasGenerateLink,
    handleCheckStatus,
  };
}
