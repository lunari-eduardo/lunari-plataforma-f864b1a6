/**
 * CombinedChargeModal — gera UM link único cobrindo sessão + fotos extras.
 *
 * Paridade com `ChargeModal`:
 *  - Mesmo `ProviderSelector` + `AsaasChargeOptions` (respeitando `habilitarPix`).
 *  - Mesmos overrides Asaas (repassar taxas / antecipar / repassar antecipação).
 *  - Asaas Link insere `cobrancas` local e usa checkout transparente
 *    (`/checkout/:id`) — não redireciona ao checkout hospedado do Asaas.
 *  - Bloco de "Dados do pagador" NÃO é renderizado — cliente completa no
 *    checkout público quando algum dado faltar.
 *
 * Backend: cobrança inserida com `finalidade='sessao_e_extras'` +
 * `galeria_id` + `qtd_fotos` + `valor_sessao_componente` +
 * `valor_extras_componente`. O trigger `ensure_transaction_on_cobranca_paid`
 * dá baixa unificada e a RPC canônica soma `valor_extras_componente` ao total
 * pago da galeria.
 */
import { useEffect, useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Send,
  Loader2,
  ExternalLink,
  Copy,
  MessageCircle,
  Settings2,
  Link2,
  QrCode,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ProviderSelector } from './ProviderSelector';
import type { SelectedProvider } from './ProviderRow';
import { AsaasChargeOptions } from './AsaasChargeOptions';
import { AsaasPixModal } from './AsaasPixModal';
import { PixManualSection } from './PixManualSection';
import { ChargeLinkSection } from './ChargeLinkSection';
import { useCobranca } from '@/hooks/useCobranca';
import type { CobrancaResponse } from '@/types/cobranca';
import { getPublicShareBaseUrl } from '@/utils/domainUtils';
import { getUnifiedPaymentSettings } from '@/utils/paymentSettingsContext';
import { normalizeAsaasFees, type NormalizedAsaasFees } from '@/lib/anticipationUtils';

interface CombinedChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  clienteId: string;
  clienteNome: string;
  clienteWhatsapp?: string;
  sessionId: string;
  /** Opcional — quando ausente, cobra sessão+extras sem galeria vinculada. */
  galeriaId?: string | null;
  valorSessaoComponente: number;
  valorExtrasComponente: number;
  qtdFotosExtras: number;
  snapshotFotosIncluidas?: number | null;
  nomeSessao?: string;
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

const currency = (n: number) =>
  Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function CombinedChargeModal({
  isOpen,
  onClose,
  clienteId,
  clienteNome,
  clienteWhatsapp,
  sessionId,
  galeriaId,
  valorSessaoComponente,
  valorExtrasComponente,
  qtdFotosExtras,
  snapshotFotosIncluidas,
  nomeSessao,
}: CombinedChargeModalProps) {
  const queryClient = useQueryClient();
  const { createLinkCharge, createPixManualCharge, creatingCharge } = useCobranca({
    clienteId,
    sessionId,
  });

  const valorTotal = useMemo(
    () => Number((valorSessaoComponente + valorExtrasComponente).toFixed(2)),
    [valorSessaoComponente, valorExtrasComponente],
  );

  const [selectedProvider, setSelectedProvider] = useState<SelectedProvider | null>(null);
  const [descricao, setDescricao] = useState('');
  const [result, setResult] = useState<CobrancaResponse | null>(null);
  const [currentChargeId, setCurrentChargeId] = useState<string | null>(null);

  // Asaas
  const [asaasSettings, setAsaasSettings] = useState<AsaasSettingsState | null>(null);
  const [asaasMode, setAsaasMode] = useState<'options' | 'link' | null>(null);
  const [asaasSelectedMethod, setAsaasSelectedMethod] = useState<'link' | 'pix'>('link');
  const [asaasPixLoading, setAsaasPixLoading] = useState(false);
  const [asaasLinkLoading, setAsaasLinkLoading] = useState(false);
  const [asaasPixQrCode, setAsaasPixQrCode] = useState<string | null>(null);
  const [asaasPixCopiaECola, setAsaasPixCopiaECola] = useState<string | null>(null);
  const [asaasPixModalOpen, setAsaasPixModalOpen] = useState(false);

  const [overrideRepassarTaxas, setOverrideRepassarTaxas] = useState(false);
  const [overrideAntecipar, setOverrideAntecipar] = useState(false);
  const [overrideRepassarAntecipacao, setOverrideRepassarAntecipacao] = useState(false);
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
    if (!valorTotal || valorTotal <= 0) return { liquido: 0, detalhe: '' };
    
    if (overrideRepassarTaxas && (!overrideAntecipar || overrideRepassarAntecipacao)) {
      return {
        liquido: valorTotal,
        detalhe: 'Cliente arca com as taxas de processamento.',
      };
    }

    const fees = accountFees || normalizeAsaasFees(null);
    const tier1 = fees.creditCard?.tiers?.[0] || { percentageFee: 2.99 };
    const opVal = fees.creditCard?.operationValue ?? 0.49;

    let descontoProcessamento = 0;
    if (!overrideRepassarTaxas) {
      descontoProcessamento = (valorTotal * tier1.percentageFee / 100) + opVal;
    }

    let descontoAntecipacao = 0;
    if (overrideAntecipar && !overrideRepassarAntecipacao) {
      const taxaMensal = fees.creditCard?.detachedMonthlyFeeValue ?? 1.25;
      descontoAntecipacao = valorTotal * (taxaMensal / 100);
    }

    const totalDesconto = descontoProcessamento + descontoAntecipacao;
    const liquido = Math.max(0, valorTotal - totalDesconto);

    const desc = [];
    if (!overrideRepassarTaxas) desc.push(`processamento (~R$ ${descontoProcessamento.toFixed(2).replace('.', ',')})`);
    if (overrideAntecipar && !overrideRepassarAntecipacao) desc.push(`antecipação (~R$ ${descontoAntecipacao.toFixed(2).replace('.', ',')})`);

    const detalhe = desc.length > 0
      ? `Você absorve ${desc.join(' e ')}.`
      : 'Você absorve as taxas no cartão.';

    return { liquido, detalhe };
  };

  useEffect(() => {
    if (!isOpen) {
      setSelectedProvider(null);
      setDescricao('');
      setResult(null);
      setCurrentChargeId(null);
      setAsaasMode(null);
      setAsaasPixQrCode(null);
      setAsaasPixCopiaECola(null);
      setAsaasPixModalOpen(false);
      setOverrideRepassarTaxas(false);
      setOverrideAntecipar(false);
      setOverrideRepassarAntecipacao(false);
      return;
    }
    const soExtrasInit = valorSessaoComponente <= 0 && valorExtrasComponente > 0;
    setDescricao(
      soExtrasInit
        ? `Fotos extras - ${nomeSessao || 'Sessão'}`
        : `Sessão + fotos extras - ${nomeSessao || 'Sessão'}`,
    );
  }, [isOpen, nomeSessao, valorSessaoComponente, valorExtrasComponente]);

  // Fetch Asaas settings
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
        .maybeSingle();
      if (data?.dados_extras) {
        const d = getUnifiedPaymentSettings<Record<string, unknown>>(data.dados_extras);
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
        setOverrideRepassarTaxas(!absorverTaxa);
        setOverrideAntecipar(ireiAntecipar);
        setOverrideRepassarAntecipacao(ireiAntecipar ? repassarTaxaAntecipacao : false);
      }
    })();
  }, [selectedProvider]);

  const commonBinding = {
    finalidade: 'sessao_e_extras' as const,
    galeriaId: galeriaId ?? null,
    qtdFotos: qtdFotosExtras,
    snapshotFotosIncluidas: snapshotFotosIncluidas ?? null,
    valorSessaoComponente,
    valorExtrasComponente,
  };

  const invalid =
    valorTotal <= 0 ||
    (valorSessaoComponente <= 0 && valorExtrasComponente <= 0) ||
    valorSessaoComponente < 0 ||
    valorExtrasComponente < 0;

  const soExtras = valorSessaoComponente <= 0 && valorExtrasComponente > 0;

  async function handlePixManual() {
    if (invalid) return;
    const response = await createPixManualCharge({
      clienteId,
      sessionId,
      valor: valorTotal,
      descricao: descricao?.trim() || undefined,
      tipoCobranca: 'pix',
      provedor: 'pix_manual',
      ...commonBinding,
    });
    if (!response?.success) {
      toast.error(response?.error || 'Falha ao gerar cobrança combinada.');
      return;
    }
    setResult(response);
    if (response.cobranca?.id) setCurrentChargeId(response.cobranca.id);
    queryClient.invalidateQueries({ queryKey: ['cobrancas'] });
  }

  async function handleLinkProvider(provedor: 'mercadopago' | 'infinitepay') {
    if (invalid) return;
    const response = await createLinkCharge({
      clienteId,
      sessionId,
      valor: valorTotal,
      descricao: descricao?.trim() || undefined,
      tipoCobranca: 'link',
      provedor,
      ...commonBinding,
    });
    if (!response?.success) {
      toast.error(response?.error || 'Falha ao gerar cobrança combinada.');
      return;
    }
    setResult(response);
    if (response.cobranca?.id) setCurrentChargeId(response.cobranca.id);
    queryClient.invalidateQueries({ queryKey: ['cobrancas'] });
    const link = response.checkoutUrl || response.paymentLink;
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
  }

  async function handleAsaasPix() {
    if (invalid) return;
    setAsaasPixLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-cobranca', {
        body: {
          clienteId,
          sessionId,
          valor: valorTotal,
          descricao: descricao?.trim() || undefined,
          provedor: 'asaas',
          billingType: 'PIX',
          finalidade: 'sessao_e_extras',
          galeriaId: galeriaId ?? null,
          qtdFotos: qtdFotosExtras,
          snapshotFotosIncluidas: snapshotFotosIncluidas ?? null,
          valorSessaoComponente,
          valorExtrasComponente,
          idempotencyKey: crypto.randomUUID(),
        },
      });
      if (error) throw error;
      const payload = (data ?? {}) as {
        success?: boolean;
        error?: string;
        pixQrCodeBase64?: string;
        pixCopiaCola?: string;
        cobrancaId?: string;
      };
      if (payload.success === false) throw new Error(payload.error || 'Falha Asaas PIX.');
      setAsaasPixQrCode(payload.pixQrCodeBase64 ? `data:image/png;base64,${payload.pixQrCodeBase64}` : null);
      setAsaasPixCopiaECola(payload.pixCopiaCola || null);
      setAsaasPixModalOpen(true);
      if (payload.cobrancaId) setCurrentChargeId(payload.cobrancaId);
      queryClient.invalidateQueries({ queryKey: ['cobrancas'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar PIX Asaas.');
    } finally {
      setAsaasPixLoading(false);
    }
  }

  async function handleAsaasLink() {
    if (invalid) return;
    setAsaasLinkLoading(true);
    try {
      const response = await createLinkCharge({
        clienteId,
        sessionId,
        valor: valorTotal,
        descricao: descricao?.trim() || undefined,
        tipoCobranca: 'link',
        provedor: 'asaas',
        ...commonBinding,
        dadosExtras: {
          repassarTaxasProcessamento: overrideRepassarTaxas,
          anteciparParcelas: overrideAntecipar,
          repassarTaxaAntecipacao: overrideAntecipar ? overrideRepassarAntecipacao : false,
        },
      });

      if (!response?.success) {
        toast.error(response?.error || 'Falha ao gerar link Asaas.');
        return;
      }
      setResult(response);
      if (response.cobranca?.id || response.cobrancaId) {
        setCurrentChargeId(response.cobranca?.id || response.cobrancaId || null);
      }
      setAsaasMode('link');
      queryClient.invalidateQueries({ queryKey: ['cobrancas'] });
      const link = response.checkoutUrl || response.paymentLink;
      if (link) window.open(link, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar link Asaas.');
    } finally {
      setAsaasLinkLoading(false);
    }
  }

  const shareLink = result?.checkoutUrl || result?.paymentLink || null;
  const pixPayload = result?.pixCopiaCola || result?.pixPayload || null;

  function copyLink() {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink).then(
      () => toast.success('Link copiado.'),
      () => toast.error('Não foi possível copiar.'),
    );
  }

  function sendWhatsapp() {
    if (!shareLink) return;
    const digits = (clienteWhatsapp || '').replace(/\D/g, '');
    const msg = encodeURIComponent(
      `Olá${clienteNome ? ` ${clienteNome}` : ''}! Segue o link para pagamento (sessão + fotos extras): ${shareLink}`,
    );
    const url = digits
      ? `https://wa.me/${digits.length <= 11 ? '55' + digits : digits}?text=${msg}`
      : `https://wa.me/?text=${msg}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  const showLinkProvider =
    selectedProvider === 'mercadopago_link' || selectedProvider === 'infinitepay';
  const showPixManual = selectedProvider === 'pix_manual';
  const showAsaas = selectedProvider === 'asaas';

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <SheetContent
          side="right"
          className={cn(
            'w-full sm:max-w-[520px] p-0 gap-0 flex flex-col',
            'h-dvh max-h-dvh bg-background backdrop-blur-none shadow-2xl',
          )}
        >
          {/* ============================ CABEÇALHO FIXO ============================ */}
          <header className="shrink-0 pt-3.5 pb-3 px-4 border-b border-border/60 relative">
            <div className="flex items-center justify-between pr-6">
              <SheetTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                <Send className="h-4 w-4 text-primary" />
                {soExtras ? 'Cobrar fotos extras' : 'Cobrar tudo (link único)'}
                {clienteNome && (
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    · {clienteNome}
                  </span>
                )}
              </SheetTitle>
            </div>
            {nomeSessao && (
              <div className="text-xs text-muted-foreground mt-1">
                Sessão: <strong className="text-foreground">{nomeSessao}</strong>
              </div>
            )}
          </header>

          {/* =========================== CONTEÚDO ROLÁVEL =========================== */}
          <div
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-4"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {/* Breakdown enxuto */}
            <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-border/60 bg-muted/20 px-3.5 py-2.5 shadow-xs">
              <div className="text-xs text-muted-foreground">
                {valorSessaoComponente > 0 && (
                  <>
                    Sessão <strong className="text-foreground">{currency(valorSessaoComponente)}</strong>
                    <span className="mx-1.5 opacity-60">+</span>
                  </>
                )}
                Extras ({qtdFotosExtras}){' '}
                <strong className="text-foreground">{currency(valorExtrasComponente)}</strong>
              </div>
              <div className="text-base font-bold text-primary">
                Total {currency(valorTotal)}
              </div>
            </div>

            {/* Descrição */}
            {!result && (
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
                  placeholder="Ex.: Sessão + Fotos extras"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value.substring(0, 140))}
                  className="h-10 text-xs bg-muted/30 border-border/60 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/50"
                />
              </div>
            )}

            {/* Meio de cobrança */}
            {!result && (
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Meio de cobrança
                </Label>
                <ProviderSelector
                  selectedProvider={selectedProvider}
                  onSelect={(p) => setSelectedProvider(p)}
                />
              </div>
            )}

            {/* Overrides Asaas */}
            {!result && showAsaas && asaasSettings && asaasMode === 'options' && (
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
                    {/* Taxas do Cartão */}
                    <div className="space-y-1.5">
                      <Label className="text-[10px] text-muted-foreground uppercase font-medium">Taxas do Cartão</Label>
                      <RadioGroup
                        value={overrideRepassarTaxas ? "cliente" : "eu"}
                        onValueChange={(v) => setOverrideRepassarTaxas(v === 'cliente')}
                        className="grid grid-cols-1 gap-2"
                      >
                        <Label htmlFor="cc-tx-cliente" className={cn("flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors shadow-xs", overrideRepassarTaxas ? "border-primary bg-primary/5" : "border-border/60 bg-muted/10 hover:bg-muted/30")}>
                          <RadioGroupItem value="cliente" id="cc-tx-cliente" />
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-semibold">Cliente paga as taxas</span>
                            <span className="text-[10px] text-muted-foreground font-normal">O valor das taxas será repassado ao cliente.</span>
                          </div>
                        </Label>
                        <Label htmlFor="cc-tx-eu" className={cn("flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors shadow-xs", !overrideRepassarTaxas ? "border-primary bg-primary/5" : "border-border/60 bg-muted/10 hover:bg-muted/30")}>
                          <RadioGroupItem value="eu" id="cc-tx-eu" />
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-semibold">Eu pago as taxas</span>
                            <span className="text-[10px] text-muted-foreground font-normal">As taxas serão descontadas do valor recebido.</span>
                          </div>
                        </Label>
                      </RadioGroup>
                    </div>

                    {/* Antecipação */}
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

                    {/* Recebimento líquido estimado */}
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

            {/* Ação — PIX manual */}
            {!result && showPixManual && (
              <PixManualSection
                valor={valorTotal}
                loading={creatingCharge}
                clienteWhatsapp={clienteWhatsapp}
                onGenerate={handlePixManual}
              />
            )}

            {/* Ação — Link (MP / InfinitePay) */}
            {!result && showLinkProvider && (
              <ChargeLinkSection
                valor={valorTotal}
                loading={creatingCharge}
                onGenerate={() =>
                  handleLinkProvider(
                    selectedProvider === 'infinitepay' ? 'infinitepay' : 'mercadopago',
                  )
                }
                clienteWhatsapp={clienteWhatsapp}
              />
            )}

            {/* Ação — Asaas (mesma UX do ChargeModal) */}
            {!result && showAsaas && asaasSettings && asaasMode === 'options' && (
              <>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    Tipo de cobrança
                  </Label>
                  <AsaasChargeOptions
                    valor={valorTotal}
                    selectedMethod={asaasSelectedMethod}
                    onSelectMethod={setAsaasSelectedMethod}
                    hasPix={asaasSettings.habilitarPix}
                  />
                </div>

                <div className="pt-1">
                  {asaasSelectedMethod === 'pix' ? (
                    <Button onClick={handleAsaasPix} disabled={asaasPixLoading} className="w-full h-12 text-xs font-bold uppercase tracking-wider rounded-xl shadow-xs">
                      {asaasPixLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Gerar PIX — R$ {valorTotal.toFixed(2).replace('.', ',')}
                    </Button>
                  ) : (
                    <Button onClick={handleAsaasLink} disabled={asaasLinkLoading} className="w-full h-12 text-xs font-bold uppercase tracking-wider rounded-xl shadow-xs">
                      {asaasLinkLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Gerar Link — R$ {valorTotal.toFixed(2).replace('.', ',')}
                    </Button>
                  )}
                </div>
              </>
            )}

            {/* Resultado */}
            {result && pixPayload && (
              <PixManualSection
                valor={valorTotal}
                pixPayload={pixPayload}
                loading={false}
                clienteWhatsapp={clienteWhatsapp}
                onGenerate={() => {}}
              />
            )}

            {result && !pixPayload && shareLink && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-2.5 shadow-xs">
                <div className="flex items-start gap-2">
                  <ExternalLink className="h-4 w-4 text-primary mt-0.5" />
                  <div className="text-sm min-w-0">
                    <div className="font-medium">Link único gerado</div>
                    <div className="text-xs text-muted-foreground break-all">{shareLink}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5 flex-1 rounded-lg" onClick={copyLink}>
                    <Copy className="h-3.5 w-3.5" /> Copiar
                  </Button>
                  <Button size="sm" className="gap-1.5 flex-1 rounded-lg" onClick={sendWhatsapp}>
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* ============================= RODAPÉ FIXO ============================== */}
          <footer className="shrink-0 border-t border-border/60 p-3 px-4 bg-background/95 backdrop-blur-sm flex items-center justify-between gap-3 shadow-lg">
            <Button
              variant="outline"
              onClick={onClose}
              className="rounded-xl h-10 px-5 text-xs font-semibold bg-muted/40 hover:bg-muted border-border/60"
            >
              {result ? 'Fechar' : 'Cancelar'}
            </Button>
          </footer>
        </SheetContent>
      </Sheet>

      {/* Asaas PIX QR modal */}
      <AsaasPixModal
        isOpen={asaasPixModalOpen}
        onClose={() => setAsaasPixModalOpen(false)}
        pixQrCode={asaasPixQrCode}
        pixCopiaECola={asaasPixCopiaECola}
        valor={valorTotal}
        clienteWhatsapp={clienteWhatsapp}
      />
    </>
  );
}
