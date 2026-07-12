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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Send,
  Loader2,
  ExternalLink,
  Copy,
  MessageCircle,
  Settings2,
} from 'lucide-react';
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

interface CombinedChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  clienteId: string;
  clienteNome: string;
  clienteWhatsapp?: string;
  sessionId: string;
  galeriaId: string;
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
  const [asaasPixLoading, setAsaasPixLoading] = useState(false);
  const [asaasLinkLoading, setAsaasLinkLoading] = useState(false);
  const [asaasPixQrCode, setAsaasPixQrCode] = useState<string | null>(null);
  const [asaasPixCopiaECola, setAsaasPixCopiaECola] = useState<string | null>(null);
  const [asaasPixModalOpen, setAsaasPixModalOpen] = useState(false);

  const [overrideRepassarTaxas, setOverrideRepassarTaxas] = useState(false);
  const [overrideAntecipar, setOverrideAntecipar] = useState(false);
  const [overrideRepassarAntecipacao, setOverrideRepassarAntecipacao] = useState(false);

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
    setDescricao(`Sessão + fotos extras - ${nomeSessao || 'Sessão'}`);
  }, [isOpen, nomeSessao]);

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
        const d = data.dados_extras as Record<string, unknown>;
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
        setOverrideRepassarTaxas(!absorverTaxa);
        setOverrideAntecipar(ireiAntecipar);
        setOverrideRepassarAntecipacao(ireiAntecipar ? repassarTaxaAntecipacao : false);
      }
    })();
  }, [selectedProvider]);

  const commonBinding = {
    finalidade: 'sessao_e_extras' as const,
    galeriaId,
    qtdFotos: qtdFotosExtras,
    snapshotFotosIncluidas: snapshotFotosIncluidas ?? null,
    valorSessaoComponente,
    valorExtrasComponente,
  };

  const invalid =
    valorTotal <= 0 || valorSessaoComponente <= 0 || valorExtrasComponente <= 0;

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
      const { data, error } = await supabase.functions.invoke('gestao-asaas-create-payment', {
        body: {
          clienteId,
          sessionId,
          valor: valorTotal,
          descricao: descricao?.trim() || undefined,
          billingType: 'PIX',
          finalidade: 'sessao_e_extras',
          galeriaId,
          qtdFotos: qtdFotosExtras,
          snapshotFotosIncluidas: snapshotFotosIncluidas ?? null,
          valorSessaoComponente,
          valorExtrasComponente,
        },
      });
      if (error) throw error;
      const payload = (data ?? {}) as {
        success?: boolean;
        error?: string;
        pixQrCode?: string;
        pixCopiaECola?: string;
        cobrancaId?: string;
      };
      if (payload.success === false) throw new Error(payload.error || 'Falha Asaas PIX.');
      setAsaasPixQrCode(payload.pixQrCode ? `data:image/png;base64,${payload.pixQrCode}` : null);
      setAsaasPixCopiaECola(payload.pixCopiaECola || null);
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Não autenticado');

      const chargeOverrides = {
        repassarTaxasProcessamento: overrideRepassarTaxas,
        anteciparParcelas: overrideAntecipar,
        repassarTaxaAntecipacao: overrideAntecipar ? overrideRepassarAntecipacao : false,
      };

      const insertPayload: Record<string, unknown> = {
        user_id: session.user.id,
        cliente_id: clienteId,
        session_id: sessionId,
        valor: valorTotal,
        descricao: descricao?.trim() || 'Cobrança Asaas (sessão + extras)',
        tipo_cobranca: 'link',
        provedor: 'asaas',
        status: 'pendente',
        dados_extras: chargeOverrides,
        finalidade: 'sessao_e_extras',
        galeria_id: galeriaId,
        qtd_fotos: qtdFotosExtras,
        snapshot_fotos_incluidas: snapshotFotosIncluidas ?? null,
        valor_sessao_componente: valorSessaoComponente,
        valor_extras_componente: valorExtrasComponente,
        correlation_id: crypto.randomUUID(),
      };

      const { data: cobranca, error: insertError } = await supabase
        .from('cobrancas')
        .insert(insertPayload as any)
        .select('id')
        .single();

      if (insertError || !cobranca) throw new Error(insertError?.message || 'Erro ao criar cobrança');

      const checkoutUrl = `${getPublicShareBaseUrl()}/checkout/${cobranca.id}`;
      setResult({
        success: true,
        provedor: 'asaas',
        paymentLink: checkoutUrl,
        checkoutUrl,
      } as CobrancaResponse);
      setCurrentChargeId(cobranca.id);
      setAsaasMode('link');
      queryClient.invalidateQueries({ queryKey: ['cobrancas'] });
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
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          className="max-w-lg md:max-w-2xl max-h-[92vh] p-0 overflow-hidden z-[60] shadow-2xl border-2 border-border flex flex-col"
          overlayClassName="backdrop-blur-sm bg-black/60 z-[59]"
        >
          <DialogHeader className="px-4 pt-3 pb-2 border-b border-border/50">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Send className="h-4 w-4 text-primary" />
              Cobrar tudo (link único)
              <span className="text-xs text-muted-foreground font-normal ml-1">
                · {clienteNome}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Breakdown enxuto — 1 linha */}
            <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <div className="text-xs text-muted-foreground">
                Sessão <strong className="text-foreground">{currency(valorSessaoComponente)}</strong>
                <span className="mx-1.5 opacity-60">+</span>
                Extras ({qtdFotosExtras}){' '}
                <strong className="text-foreground">{currency(valorExtrasComponente)}</strong>
              </div>
              <div className="text-base font-semibold text-primary">
                Total {currency(valorTotal)}
              </div>
            </div>

            {/* Descrição */}
            {!result && (
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Descrição
                </Label>
                <Textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="resize-none h-14 text-sm"
                />
              </div>
            )}

            {/* Meio de pagamento */}
            {!result && (
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Meio de cobrança
                </Label>
                <ProviderSelector
                  selectedProvider={selectedProvider}
                  onSelect={(p) => setSelectedProvider(p)}
                />
              </div>
            )}

            {/* Overrides Asaas (mesmo bloco do ChargeModal) */}
            {!result && showAsaas && asaasSettings && asaasMode === 'options' && (
              <div className="space-y-2">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Settings2 className="h-3 w-3" />
                  Opções desta cobrança
                </Label>

                <div className="rounded-md border border-border/60 divide-y divide-border/40">
                  <div className="flex items-center justify-between px-3 h-11">
                    <div className="min-w-0">
                      <Label htmlFor="cc-override-taxas" className="text-sm">Repassar taxas de processamento</Label>
                      <p className="text-[11px] text-muted-foreground truncate">Cliente paga as taxas de cartão</p>
                    </div>
                    <Switch id="cc-override-taxas" checked={overrideRepassarTaxas} onCheckedChange={setOverrideRepassarTaxas} />
                  </div>

                  <div className="flex items-center justify-between px-3 h-11">
                    <div className="min-w-0">
                      <Label htmlFor="cc-override-antecipar" className="text-sm">Antecipar parcelas</Label>
                      <p className="text-[11px] text-muted-foreground truncate">Solicitar antecipação no Asaas</p>
                    </div>
                    <Switch
                      id="cc-override-antecipar"
                      checked={overrideAntecipar}
                      onCheckedChange={(v) => {
                        setOverrideAntecipar(v);
                        if (!v) setOverrideRepassarAntecipacao(false);
                      }}
                    />
                  </div>

                  {overrideAntecipar && (
                    <div className="flex items-center justify-between px-3 h-11 bg-primary/5">
                      <div className="min-w-0 pl-3 border-l-2 border-primary/40">
                        <Label htmlFor="cc-override-repassar-antecipacao" className="text-sm">Repassar antecipação</Label>
                        <p className="text-[11px] text-muted-foreground truncate">Inclui taxa no valor do cliente</p>
                      </div>
                      <Switch id="cc-override-repassar-antecipacao" checked={overrideRepassarAntecipacao} onCheckedChange={setOverrideRepassarAntecipacao} />
                    </div>
                  )}
                </div>
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
              <AsaasChargeOptions
                valor={valorTotal}
                onSelectPix={handleAsaasPix}
                onSelectLink={handleAsaasLink}
                pixLoading={asaasPixLoading}
                linkLoading={asaasLinkLoading}
                hasPix={asaasSettings.habilitarPix}
              />
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
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <ExternalLink className="h-4 w-4 text-primary mt-0.5" />
                  <div className="text-sm min-w-0">
                    <div className="font-medium">Link único gerado</div>
                    <div className="text-xs text-muted-foreground break-all">{shareLink}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5 flex-1" onClick={copyLink}>
                    <Copy className="h-3.5 w-3.5" /> Copiar
                  </Button>
                  <Button size="sm" className="gap-1.5 flex-1" onClick={sendWhatsapp}>
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border/50 bg-background/50">
            <Button variant="ghost" onClick={onClose}>
              {result ? 'Fechar' : 'Cancelar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
