/**
 * ExtraChargeModal — cobrança dedicada de fotos extras de uma galeria.
 *
 * Contrato: NUNCA insere em `cobrancas` diretamente. Chama a edge canônica
 * `gallery-create-payment` (mesma que o Gallery usa), que:
 *  - Lê o valor via RPC `calculate_gallery_extra_payment` (fonte única).
 *  - Cancela cobranças anteriores pendentes da mesma galeria.
 *  - Cria a cobrança no provedor correto com finalidade='fotos_extras'.
 *
 * Todos os valores exibidos vêm da RPC (`useGalleryExtraCalc`), sem cálculo
 * local. Payload da edge NÃO deve enviar valorTotal/extraCount — a edge
 * recalcula e ignora esses campos.
 */
import { useEffect, useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Images, Loader2, ExternalLink, Copy, MessageCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { ProviderSelector } from './ProviderSelector';
import type { SelectedProvider } from './ProviderRow';
import { PixManualSection } from './PixManualSection';
import { toast } from 'sonner';
import { useGalleryExtraCalc } from '@/hooks/useGalleryExtraCalc';
import { useQueryClient } from '@tanstack/react-query';
import { ChargeStepBadge } from './ChargeStepBadge';
import { buildPaymentShareUrl } from '@/utils/domainUtils';

interface ExtraChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  galeriaId: string;
  clienteNome?: string;
  nomeSessao?: string;
  clienteWhatsapp?: string;
  /** Quando presente, exibe stepper no header (fluxo "Cobrar tudo"). */
  step?: import('./ChargeStepBadge').ChargeStep | null;
}

type GalleryPaymentResponse = {
  success?: boolean;
  code?: string;
  error?: string;
  alreadyPaid?: boolean;
  cobrancaId?: string;
  checkoutUrl?: string;
  paymentUrl?: string;
  transparentCheckout?: boolean;
  provedor?: string;
  galleryUrl?: string;
  pixDados?: {
    qrCodeBase64?: string;
    pixCopiaCola?: string;
    pixPayload?: string;
  };
};

const currency = (n: number) =>
  Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Mapeia SelectedProvider → provider aceito por gallery-create-payment.
 */
function toEdgeProvider(sel: SelectedProvider | null): string | null {
  if (!sel) return null;
  if (sel === 'mercadopago_link') return 'mercadopago';
  if (sel === 'infinitepay') return 'infinitepay';
  if (sel === 'asaas') return 'asaas';
  if (sel === 'pix_manual') return 'pix_manual';
  return null;
}

export function ExtraChargeModal({
  isOpen,
  onClose,
  galeriaId,
  clienteNome,
  nomeSessao,
  clienteWhatsapp,
  step,
}: ExtraChargeModalProps) {
  const queryClient = useQueryClient();
  const { calc, isLoading, invalidate } = useGalleryExtraCalc(isOpen ? galeriaId : null);

  const [selectedProvider, setSelectedProvider] = useState<SelectedProvider | null>(null);
  const [descricao, setDescricao] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<GalleryPaymentResponse | null>(null);
  const [defaultProvider, setDefaultProvider] = useState<string | null>(null);

  // Reset ao abrir/fechar
  useEffect(() => {
    if (!isOpen) {
      setSelectedProvider(null);
      setDescricao('');
      setResult(null);
      setSubmitting(false);
      return;
    }
    setDescricao(nomeSessao ? `Fotos extras - ${nomeSessao}` : 'Fotos extras');
    // Pré-selecionar provedor padrão da galeria
    (async () => {
      const { data } = await supabase
        .from('galerias')
        .select('venda_pagamento_provedor')
        .eq('id', galeriaId)
        .maybeSingle();
      if (data?.venda_pagamento_provedor) {
        setDefaultProvider(data.venda_pagamento_provedor);
      }
    })();
  }, [isOpen, galeriaId, nomeSessao]);

  const submitDisabled =
    !selectedProvider || submitting || calc.is_fully_paid || calc.valor_a_cobrar <= 0;

  const handleGenerate = async () => {
    const provider = toEdgeProvider(selectedProvider);
    if (!provider) return;
    if (calc.is_fully_paid || calc.valor_a_cobrar <= 0) {
      toast.error('Esta galeria já está quitada.');
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      // 1. Obter cliente_id e session_id da galeria
      const { data: gal, error: galErr } = await supabase
        .from('galerias')
        .select('cliente_id, session_id, nome_sessao, fotos_incluidas')
        .eq('id', galeriaId)
        .maybeSingle();

      if (galErr || !gal?.cliente_id) {
        toast.error('Cliente não vinculado a esta galeria.');
        return;
      }

      const { data, error } = await supabase.functions.invoke<GalleryPaymentResponse>(
        'create-cobranca',
        {
          body: {
            galeriaId,
            clienteId: gal.cliente_id,
            sessionId: gal.session_id || undefined,
            valor: calc.valor_a_cobrar,
            qtdFotos: calc.extras_a_cobrar,
            snapshotFotosIncluidas: gal.fotos_incluidas,
            descricao: descricao?.trim() || `Fotos extras - ${gal.nome_sessao || 'Galeria'}`,
            provedor: provider as any,
            finalidade: 'fotos_extras',
            idempotencyKey: crypto.randomUUID(),
          },
        },
      );
      if (error) {
        toast.error(error.message || 'Falha ao gerar cobrança.');
        return;
      }
      const payload = (data ?? {}) as GalleryPaymentResponse;
      // 6 casos do handoff §1.4
      if (payload.code === 'NO_AMOUNT_DUE' || payload.alreadyPaid) {
        toast.success('Galeria já quitada.');
        invalidate();
        setResult(payload);
        return;
      }
      if (payload.success === false) {
        if (payload.code === 'NO_PROVIDER') {
          toast.error('Configure um meio de pagamento em Configurações › Integrações.');
        } else if (
          payload.code === 'GATEWAY_TIMEOUT' ||
          payload.code === 'GATEWAY_UNREACHABLE' ||
          payload.code === 'PAYMENT_CREATE_ERROR'
        ) {
          toast.error(payload.error || 'Falha temporária no provedor. Tente novamente.');
        } else {
          toast.error(payload.error || 'Erro ao gerar cobrança.');
        }
        return;
      }
      // Sucesso — router
      setResult(payload);
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['cobrancas'] });

      // Auto-abrir link em nova aba (checkout externo)
      const link = payload.checkoutUrl || payload.paymentUrl;
      if (link && !payload.transparentCheckout) {
        window.open(link, '_blank', 'noopener,noreferrer');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao gerar cobrança.');
    } finally {
      setSubmitting(false);
    }
  };

  const shareLink = useMemo(() => {
    if (!result) return null;
    if (result.transparentCheckout && result.galleryUrl) return result.galleryUrl;
    // Preferir URL branded /l/{id} (preview no WhatsApp com logo do fotógrafo).
    if (result.cobrancaId) return buildPaymentShareUrl(result.cobrancaId);
    return result.checkoutUrl || result.paymentUrl || null;
  }, [result]);

  const copyLink = () => {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink).then(
      () => toast.success('Link copiado.'),
      () => toast.error('Não foi possível copiar.'),
    );
  };

  const sendWhatsapp = () => {
    if (!shareLink) return;
    const digits = (clienteWhatsapp || '').replace(/\D/g, '');
    const msg = encodeURIComponent(
      `Olá${clienteNome ? ` ${clienteNome}` : ''}! Segue o link para pagamento das fotos extras: ${shareLink}`,
    );
    const url = digits
      ? `https://wa.me/${digits.length <= 11 ? '55' + digits : digits}?text=${msg}`
      : `https://wa.me/?text=${msg}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
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
              <Images className="h-4 w-4 text-amber-500" />
              Cobrar fotos extras
              {clienteNome && (
                <span className="text-sm font-normal text-muted-foreground ml-1">· {clienteNome}</span>
              )}
            </SheetTitle>
            {step ? <ChargeStepBadge step={step} /> : null}
          </div>
          {nomeSessao && (
            <div className="text-xs text-muted-foreground mt-1">
              Galeria: <strong className="text-foreground">{nomeSessao}</strong>
            </div>
          )}
        </header>

        {/* =========================== CONTEÚDO ROLÁVEL =========================== */}
        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-4"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {/* Snapshot readonly da RPC */}
          {isLoading ? (
            <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Calculando saldo…</span>
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 bg-muted/20 divide-y divide-border/40 text-sm shadow-xs">
              <Row label="Extras selecionadas" value={String(calc.extras_a_cobrar)} />
              <Row label="Valor unitário" value={currency(calc.valor_unitario)} />
              <Row label="Já pago" value={currency(calc.valor_pago)} />
              <Row
                label="Total a cobrar"
                value={currency(calc.valor_a_cobrar)}
                emphasis={calc.valor_a_cobrar > 0 ? 'primary' : 'muted'}
              />
            </div>
          )}

          {calc.is_fully_paid && !isLoading && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
              <div>
                <div className="font-medium">Galeria já quitada</div>
                <div className="text-xs text-muted-foreground">
                  Não há saldo pendente de fotos extras nesta galeria.
                </div>
              </div>
            </div>
          )}

          {/* Meio de pagamento */}
          {!calc.is_fully_paid && !result && (
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Meio de cobrança
              </Label>
              <ProviderSelector
                selectedProvider={selectedProvider ?? (defaultProvider ? mapDefault(defaultProvider) : null)}
                onSelect={(p) => setSelectedProvider(p)}
              />
            </div>
          )}

          {!result && !calc.is_fully_paid && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Descrição (Opcional)
                </Label>
                <span className="text-[10px] text-muted-foreground font-medium">
                  {descricao.length}/140
                </span>
              </div>
              <Textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value.substring(0, 140))}
                className="text-xs bg-muted/30 border-border/60 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/50 resize-none h-14"
              />
            </div>
          )}

          {/* Resultado */}
          {result?.pixDados && (
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                PIX gerado
              </Label>
              <PixManualSection
                valor={calc.valor_a_cobrar}
                pixPayload={result.pixDados.pixCopiaCola || result.pixDados.pixPayload || ''}
                loading={false}
                clienteWhatsapp={clienteWhatsapp}
                onGenerate={() => {
                  /* já gerado */
                }}
              />
            </div>
          )}

          {result?.transparentCheckout && result?.provedor === 'asaas' && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-2.5 shadow-xs">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-primary mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium">Cobrança Asaas criada</div>
                  <div className="text-xs text-muted-foreground">
                    O checkout do Asaas abre dentro da galeria pública. Envie o link
                    da galeria ao cliente.
                  </div>
                </div>
              </div>
              {shareLink && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5 flex-1 rounded-lg" onClick={copyLink}>
                    <Copy className="h-3.5 w-3.5" /> Copiar link
                  </Button>
                  <Button size="sm" className="gap-1.5 flex-1 rounded-lg" onClick={sendWhatsapp}>
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </Button>
                </div>
              )}
            </div>
          )}

          {result &&
            !result.pixDados &&
            !result.transparentCheckout &&
            shareLink && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-2.5 shadow-xs">
                <div className="flex items-start gap-2">
                  <ExternalLink className="h-4 w-4 text-primary mt-0.5" />
                  <div className="text-sm">
                    <div className="font-medium">Link de pagamento gerado</div>
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
          {!result && (
            <Button
              onClick={handleGenerate}
              disabled={submitDisabled}
              className="rounded-xl h-10 px-5 text-xs font-bold uppercase tracking-wider gap-2 shadow-xs"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {calc.is_fully_paid ? 'Galeria quitada' : `Gerar cobrança — ${currency(calc.valor_a_cobrar)}`}
            </Button>
          )}
        </footer>
      </SheetContent>
    </Sheet>
  );
}

function Row({
  label,
  value,
  emphasis = 'default',
  small = false,
}: {
  label: string;
  value: string;
  emphasis?: 'default' | 'primary' | 'muted';
  small?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-3.5 py-2.5">
      <span className={`text-xs ${small ? 'text-muted-foreground/70' : 'text-muted-foreground'}`}>
        {label}
      </span>
      <span
        className={
          emphasis === 'primary'
            ? 'text-base font-semibold text-primary'
            : emphasis === 'muted'
              ? 'text-sm text-muted-foreground'
              : 'text-sm font-medium text-foreground'
        }
      >
        {value}
      </span>
    </div>
  );
}

function mapDefault(provedor: string): SelectedProvider | null {
  if (provedor === 'mercadopago') return 'mercadopago_link';
  if (provedor === 'infinitepay') return 'infinitepay';
  if (provedor === 'asaas') return 'asaas';
  if (provedor === 'pix_manual') return 'pix_manual';
  return null;
}
