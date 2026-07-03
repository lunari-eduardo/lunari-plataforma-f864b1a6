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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Images, Loader2, ExternalLink, Copy, MessageCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ProviderSelector } from './ProviderSelector';
import type { SelectedProvider } from './ProviderRow';
import { PixManualSection } from './PixManualSection';
import { toast } from 'sonner';
import { useGalleryExtraCalc } from '@/hooks/useGalleryExtraCalc';
import { useQueryClient } from '@tanstack/react-query';

interface ExtraChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  galeriaId: string;
  clienteNome?: string;
  nomeSessao?: string;
  clienteWhatsapp?: string;
}

type GalleryPaymentResponse = {
  success?: boolean;
  code?: string;
  error?: string;
  alreadyPaid?: boolean;
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
      const { data, error } = await supabase.functions.invoke<GalleryPaymentResponse>(
        'gallery-create-payment',
        {
          body: {
            galleryId: galeriaId,
            provider,
            descricao: descricao?.trim() || undefined,
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-md p-0 overflow-hidden z-[60] shadow-2xl border-2 border-border flex flex-col"
        overlayClassName="backdrop-blur-sm bg-black/60 z-[59]"
      >
        <DialogHeader className="px-4 pt-3 pb-2 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Images className="h-4 w-4 text-primary" />
            Cobrar fotos extras
          </DialogTitle>
          <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
            {nomeSessao && <span>Galeria: <strong className="text-foreground">{nomeSessao}</strong></span>}
            {clienteNome && <span>Cliente: <strong className="text-foreground">{clienteNome}</strong></span>}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Snapshot readonly da RPC */}
          {isLoading ? (
            <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Calculando saldo…</span>
            </div>
          ) : (
            <div className="rounded-md border border-border/60 bg-muted/20 divide-y divide-border/40 text-sm">
              <Row label="Extras selecionadas" value={String(calc.extras_a_cobrar)} />
              <Row label="Valor unitário" value={currency(calc.valor_unitario)} />
              <Row label="Já pago" value={currency(calc.valor_pago)} />
              <Row
                label="Total a cobrar"
                value={currency(calc.valor_a_cobrar)}
                emphasis={calc.valor_a_cobrar > 0 ? 'primary' : 'muted'}
              />
              {calc.rules_source && (
                <Row
                  label="Regra aplicada"
                  value={calc.rules_source}
                  small
                />
              )}
            </div>
          )}

          {calc.is_fully_paid && !isLoading && (
            <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
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
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Meio de pagamento
              </Label>
              <ProviderSelector
                selectedProvider={selectedProvider ?? (defaultProvider ? mapDefault(defaultProvider) : null)}
                onSelect={(p) => setSelectedProvider(p)}
              />
            </div>
          )}

          {!result && !calc.is_fully_paid && (
            <div className="space-y-2">
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

          {/* Resultado */}
          {result?.pixDados && (
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
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
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
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
                  <Button size="sm" variant="outline" className="gap-1.5 flex-1" onClick={copyLink}>
                    <Copy className="h-3.5 w-3.5" /> Copiar link
                  </Button>
                  <Button size="sm" className="gap-1.5 flex-1" onClick={sendWhatsapp}>
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
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <ExternalLink className="h-4 w-4 text-primary mt-0.5" />
                  <div className="text-sm">
                    <div className="font-medium">Link de pagamento gerado</div>
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
          {!result && (
            <Button onClick={handleGenerate} disabled={submitDisabled} className="gap-2">
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {calc.is_fully_paid ? 'Galeria quitada' : 'Gerar cobrança'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
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
    <div className="flex items-center justify-between px-3 py-2">
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
