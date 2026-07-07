/**
 * CombinedChargeModal — gera UM link único cobrindo sessão + fotos extras.
 *
 * Fluxo (Fase 4 do plano "Cobrar tudo"):
 *  1. Lê breakdown da sessão via `useSessionFinancialsWithExtras` (fonte única).
 *  2. Usuário escolhe provedor. Modal invoca a edge do provedor com
 *     `finalidade='sessao_e_extras'` + `valorSessaoComponente`
 *     + `valorExtrasComponente` + `galeriaId` + `qtdFotos`.
 *  3. Edge valida breakdown, guarda componente de extras dentro do ideal
 *     (RPC `calculate_gallery_extra_payment`) e insere a cobrança combinada.
 *     Ao ser paga, o trigger `ensure_transaction_on_cobranca_paid` dá baixa
 *     em UM só transação — e a RPC canônica soma o `valor_extras_componente`
 *     ao total pago da galeria.
 *  4. Cobranças pendentes anteriores da mesma sessão são canceladas
 *     defensivamente pela edge.
 *
 * NÃO chama `gallery-create-payment` (essa é `fotos_extras` puro).
 * NÃO altera fluxos "Cobrar sessão" / "Cobrar extras" existentes.
 */
import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Send,
  Loader2,
  ExternalLink,
  Copy,
  MessageCircle,
  Images,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ProviderSelector } from './ProviderSelector';
import type { SelectedProvider } from './ProviderRow';
import { PixManualSection } from './PixManualSection';
import { useCobranca } from '@/hooks/useCobranca';
import type { CobrancaResponse } from '@/types/cobranca';

interface CombinedChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  clienteId: string;
  clienteNome: string;
  clienteWhatsapp?: string;
  sessionId: string;
  galeriaId: string;
  /** Componente da sessão (pendente da sessão, sem extras). */
  valorSessaoComponente: number;
  /** Componente das fotos extras (pendente da galeria pela RPC canônica). */
  valorExtrasComponente: number;
  /** Quantidade de fotos extras a serem cobradas. */
  qtdFotosExtras: number;
  snapshotFotosIncluidas?: number | null;
  nomeSessao?: string;
}

const currency = (n: number) =>
  Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function providerToProvedor(sel: SelectedProvider | null):
  | 'mercadopago'
  | 'infinitepay'
  | 'asaas'
  | 'pix_manual'
  | null {
  if (!sel) return null;
  if (sel === 'mercadopago_link') return 'mercadopago';
  if (sel === 'infinitepay') return 'infinitepay';
  if (sel === 'asaas') return 'asaas';
  if (sel === 'pix_manual') return 'pix_manual';
  return null;
}

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
  const { createLinkCharge, createPixManualCharge } = useCobranca({
    clienteId,
    sessionId,
  });

  const valorTotal = useMemo(
    () => Number((valorSessaoComponente + valorExtrasComponente).toFixed(2)),
    [valorSessaoComponente, valorExtrasComponente],
  );

  const [selectedProvider, setSelectedProvider] = useState<SelectedProvider | null>(null);
  const [descricao, setDescricao] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CobrancaResponse | null>(null);
  const [asaasBillingType, setAsaasBillingType] = useState<'PIX' | 'UNDEFINED'>('UNDEFINED');

  useEffect(() => {
    if (!isOpen) {
      setSelectedProvider(null);
      setDescricao('');
      setResult(null);
      setSubmitting(false);
      setAsaasBillingType('UNDEFINED');
      return;
    }
    const nome = nomeSessao || 'Sessão';
    setDescricao(`Sessão + fotos extras - ${nome}`);
  }, [isOpen, nomeSessao]);

  const submitDisabled =
    !selectedProvider ||
    submitting ||
    valorTotal <= 0 ||
    valorSessaoComponente <= 0 ||
    valorExtrasComponente <= 0;

  async function handleGenerate() {
    const provedor = providerToProvedor(selectedProvider);
    if (!provedor) return;
    setSubmitting(true);
    setResult(null);

    const commonRequest = {
      clienteId,
      sessionId,
      valor: valorTotal,
      descricao: descricao?.trim() || undefined,
      tipoCobranca: (provedor === 'pix_manual' ? 'pix' : 'link') as 'pix' | 'link',
      provedor,
      finalidade: 'sessao_e_extras' as const,
      galeriaId,
      qtdFotos: qtdFotosExtras,
      snapshotFotosIncluidas: snapshotFotosIncluidas ?? null,
      valorSessaoComponente,
      valorExtrasComponente,
    };

    try {
      let response: CobrancaResponse | null = null;

      if (provedor === 'pix_manual') {
        response = await createPixManualCharge(commonRequest);
      } else if (provedor === 'asaas') {
        // Asaas usa endpoint dedicado (checkout PIX ou link universal)
        const { data, error } = await supabase.functions.invoke('gestao-asaas-create-payment', {
          body: {
            clienteId,
            sessionId,
            valor: valorTotal,
            descricao: commonRequest.descricao,
            billingType: asaasBillingType,
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
          code?: string;
          invoiceUrl?: string;
          pixCopiaECola?: string;
        };
        if (payload.success === false) {
          throw new Error(payload.error || 'Falha ao criar cobrança Asaas.');
        }
        response = {
          success: true,
          provedor: 'asaas',
          paymentLink: payload.invoiceUrl,
          checkoutUrl: payload.invoiceUrl,
          pixCopiaCola: payload.pixCopiaECola,
        };
      } else {
        response = await createLinkCharge(commonRequest);
      }

      if (!response?.success) {
        toast.error(response?.error || 'Falha ao gerar cobrança combinada.');
        return;
      }

      setResult(response);
      queryClient.invalidateQueries({ queryKey: ['cobrancas'] });

      const link = response.checkoutUrl || response.paymentLink;
      if (link) {
        window.open(link, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar cobrança.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const shareLink = useMemo(() => {
    if (!result) return null;
    return result.checkoutUrl || result.paymentLink || null;
  }, [result]);

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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-md p-0 overflow-hidden z-[60] shadow-2xl border-2 border-border flex flex-col"
        overlayClassName="backdrop-blur-sm bg-black/60 z-[59]"
      >
        <DialogHeader className="px-4 pt-3 pb-2 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Send className="h-4 w-4 text-primary" />
            Cobrar tudo (link único)
          </DialogTitle>
          <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
            {nomeSessao && (
              <span>
                Sessão: <strong className="text-foreground">{nomeSessao}</strong>
              </span>
            )}
            {clienteNome && (
              <span>
                Cliente: <strong className="text-foreground">{clienteNome}</strong>
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Breakdown */}
          <div className="rounded-md border border-border/60 bg-muted/20 divide-y divide-border/40 text-sm">
            <Row label="Pendente da sessão" value={currency(valorSessaoComponente)} />
            <Row
              label={`Fotos extras (${qtdFotosExtras})`}
              value={currency(valorExtrasComponente)}
              icon={<Images className="h-3 w-3 text-amber-500" />}
            />
            <Row label="Total do link" value={currency(valorTotal)} emphasis="primary" />
          </div>

          <div className="text-2xs text-muted-foreground bg-primary/5 border border-primary/20 rounded-md px-3 py-2">
            Ao ser pago, esse único pagamento dá baixa <strong>simultânea</strong> em pendente da
            sessão e das fotos extras. Cobranças pendentes anteriores desta sessão serão
            canceladas automaticamente.
          </div>

          {/* Meio de pagamento */}
          {!result && (
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Meio de pagamento
              </Label>
              <ProviderSelector
                selectedProvider={selectedProvider}
                onSelect={(p) => setSelectedProvider(p)}
              />
            </div>
          )}

          {!result && selectedProvider === 'asaas' && (
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Formato Asaas
              </Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={asaasBillingType === 'UNDEFINED' ? 'default' : 'outline'}
                  onClick={() => setAsaasBillingType('UNDEFINED')}
                  className="flex-1 h-8 text-xs"
                >
                  Link (Pix + Cartão + Boleto)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={asaasBillingType === 'PIX' ? 'default' : 'outline'}
                  onClick={() => setAsaasBillingType('PIX')}
                  className="flex-1 h-8 text-xs"
                >
                  PIX direto
                </Button>
              </div>
            </div>
          )}

          {!result && (
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
                <div className="text-sm">
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
          {!result && (
            <Button onClick={handleGenerate} disabled={submitDisabled} className="gap-2">
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Gerar link único
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
  icon,
}: {
  label: string;
  value: string;
  emphasis?: 'default' | 'primary';
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span
        className={
          emphasis === 'primary'
            ? 'text-base font-semibold text-primary'
            : 'text-sm font-medium text-foreground'
        }
      >
        {value}
      </span>
    </div>
  );
}
