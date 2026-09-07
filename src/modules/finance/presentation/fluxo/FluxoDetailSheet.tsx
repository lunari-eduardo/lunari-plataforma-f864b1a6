import { memo, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { LinhaExtrato } from '@/types/extrato';
import { formatCurrency } from '@/utils/financialUtils';
import { parseFinancialInput } from '@/utils/financialPrecision';
import { cn } from '@/lib/utils';
import { ArrowDownLeft, ArrowUpRight, ExternalLink, Trash2 } from 'lucide-react';
import { SidePanel } from '@/modules/finance/presentation/shell/SidePanel';
import { ChargeModal } from '@/components/cobranca/ChargeModal';
import { PaymentSupabaseService } from '@/services/PaymentSupabaseService';
import { format, parseISO } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface FluxoDetailSheetProps {
  linha: LinhaExtrato | null;
  onClose: () => void;
  onSave: (id: string, patch: { valor?: number; data_vencimento?: string; observacoes?: string }) => Promise<void> | void;
  onDelete: (id: string, deleteAllSeries?: boolean) => Promise<void> | void;
  onMarkPaid: (id: string) => Promise<void> | void;
  onMarkPending?: (id: string) => Promise<void> | void;
  onOpenOrigin?: (linha: LinhaExtrato) => void;
}

function formatDate(iso: string) {
  try {
    const match = iso.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (match) {
      const [_, datePart, hh, mm, ss] = match;
      const isZeroTime = !hh || (hh === '00' && mm === '00' && (!ss || ss === '00'));
      if (isZeroTime) {
        const parsed = parseISO(`${datePart}T12:00:00`);
        if (isNaN(parsed.getTime())) return iso;
        return format(parsed, 'dd/MM/yy');
      }
    }
    const parsed = iso.includes('T') || iso.includes(' ') ? new Date(iso) : parseISO(`${iso}T12:00:00`);
    if (isNaN(parsed.getTime())) return iso;
    return format(parsed, 'dd/MM/yy - HH:mm');
  } catch {
    return iso;
  }
}

const FluxoDetailSheet = memo(function FluxoDetailSheet({
  linha,
  onClose,
  onSave,
  onDelete,
  onMarkPaid,
  onMarkPending,
  onOpenOrigin,
}: FluxoDetailSheetProps) {
  const [valor, setValor] = useState('');
  const [data, setData] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [saving, setSaving] = useState(false);
  const [localStatus, setLocalStatus] = useState<string>('');
  const [gatewayInfo, setGatewayInfo] = useState<any>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isCharging, setIsCharging] = useState(false);
  const [isRegisteringPayment, setIsRegisteringPayment] = useState(false);
  const [sessionClienteId, setSessionClienteId] = useState<string>('');
  const [formaPagamento, setFormaPagamento] = useState<string>('pix');

  useEffect(() => {
    if (linha) {
      setValor(String(linha.valor.toFixed(2)).replace('.', ','));
      setData(linha.data);
      setObservacoes(linha.observacoes ?? '');
      setLocalStatus(linha.status);
      
      if (linha.origem === 'workflow' || linha.origem === 'venda_avulsa') {
        const sessionId = linha.referenciaId.replace('cs_', '');
        PaymentSupabaseService.getSessionBinding(sessionId).then(binding => {
          if (binding) {
            setSessionClienteId(binding.cliente_id);
          }
        });
      }

      if (linha.meioPagamento === 'asaas' || linha.origem === 'workflow' || linha.origem === 'gallery') {
        const fetchGateway = async () => {
          try {
            const { data: gm } = await supabase
              .from('gateway_cash_movements')
              .select(`
                id,
                movement_type,
                amount,
                movement_date,
                description,
                cobrancas(id, valor, valor_principal, valor_cobrado_cliente, taxa_processamento_real, taxa_antecipacao_real, valor_liquido_creditado, data_credito, data_credito_real, status),
                cobranca_parcelas(id, valor_principal, valor_cobrado_cliente, taxa_processamento_real, taxa_antecipacao_real, valor_liquido_creditado, data_credito, data_credito_real, status, antecipado)
              `)
              .eq('id', linha.referenciaId)
              .maybeSingle();

            if (gm) {
              setGatewayInfo(gm);
            } else {
              setGatewayInfo(null);
            }
          } catch {
            setGatewayInfo(null);
          }
        };
        fetchGateway();
      } else {
        setGatewayInfo(null);
      }
    }
  }, [linha]);

  if (!linha) return null;

  const editable = ['financeiro', 'cartao'].includes(linha.origem);
  const isParcelado = linha.parcela && linha.parcela.total > 1;
  const isReceita = linha.tipo === 'entrada';

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(linha.referenciaId, {
        valor: parseFinancialInput(valor),
        data_vencimento: data,
        observacoes,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleMarkPaid = async () => {
    setLocalStatus('Pago');
    await onMarkPaid(linha.referenciaId);
  };
  
  const handleMarkPending = async () => {
    setLocalStatus('Faturado');
    if (onMarkPending) {
      await onMarkPending(linha.referenciaId);
    }
  };

  const handleRegisterSessionPayment = async () => {
    if (!linha) return;
    setSaving(true);
    try {
      const sessionId = linha.referenciaId.replace('cs_', '');
      const paymentValue = parseFinancialInput(valor);
      const desc = observacoes ? `${observacoes} - Pago via ${formaPagamento}` : `Pago via ${formaPagamento}`;
      
      const success = await PaymentSupabaseService.saveSinglePaymentToSupabase(sessionId, {
        valor: paymentValue,
        data: data,
        observacoes: desc,
        forma_pagamento: formaPagamento,
      });
      
      if (success) {
        setLocalStatus('Pago');
        setIsRegisteringPayment(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const headerExtra = (
    <div className="flex items-center gap-2 flex-wrap">
      <span
        className={cn(
          'inline-flex items-center h-6 px-2 rounded-full border text-[11px]',
          isReceita
            ? 'border-lunar-success/30 text-lunar-success bg-lunar-success/10'
            : 'border-destructive/30 text-destructive bg-destructive/10',
        )}
      >
        {isReceita ? 'Entrada' : 'Saída'}
      </span>
      <span className={cn(
        "inline-flex items-center h-6 px-2 rounded-full border border-border text-[11px] text-muted-foreground",
        localStatus === 'Pago' && "border-lunar-success/30 text-lunar-success bg-lunar-success/10"
      )}>
        {localStatus}
      </span>
      <span className="inline-flex items-center h-6 px-2 rounded-full border border-border text-[11px] text-muted-foreground capitalize">
        {linha.origem}
      </span>
    </div>
  );

  const handleDeleteClick = () => {
    if (isParcelado) {
      setDeleteDialogOpen(true);
    } else {
      onDelete(linha.referenciaId);
    }
  };

  const isSessao = linha.origem === 'workflow' || linha.origem === 'venda_avulsa';

  const footer = (
    <SidePanel.Footer
      left={
        editable ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDeleteClick}
            className="text-destructive hover:text-destructive gap-1.5"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
            Excluir
          </Button>
        ) : null
      }
      right={
        <>
          {localStatus !== 'Pago' && editable && (
            <Button variant="outline" size="sm" onClick={handleMarkPaid}>
              Marcar pago
            </Button>
          )}
          {localStatus === 'Pago' && editable && onMarkPending && (
            <Button variant="outline" size="sm" onClick={handleMarkPending}>
              Marcar pendente
            </Button>
          )}
          {editable && (
            <Button size="sm" onClick={handleSave} disabled={saving}>
              Salvar
            </Button>
          )}
          {localStatus !== 'Pago' && isSessao && (
            <>
              {isRegisteringPayment ? (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setIsRegisteringPayment(false)}>Cancelar</Button>
                  <Button size="sm" onClick={handleRegisterSessionPayment} disabled={saving}>Confirmar Pagamento</Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={() => setIsRegisteringPayment(true)}>Registrar pagamento</Button>
                  <Button size="sm" onClick={() => setIsCharging(true)}>Cobrar online</Button>
                </>
              )}
            </>
          )}
        </>
      }
    />
  );

  return (
    <>
    <SidePanel
      open={!!linha}
      onOpenChange={(v) => !v && onClose()}
      icone={isReceita ? ArrowDownLeft : ArrowUpRight}
      titulo={linha.cliente || linha.descricao}
      subtitulo={formatCurrency(linha.valor)}
      headerExtra={headerExtra}
      width="md"
      footer={footer}
    >
      <div className="space-y-5">
        {!editable && (
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Este lançamento foi criado no <strong className="capitalize">{linha.origem}</strong>. Para preservar a
            integridade, edite na origem.
            {onOpenOrigin && (
              <button
                type="button"
                onClick={() => onOpenOrigin(linha)}
                className="ml-2 inline-flex items-center gap-1 text-primary hover:underline"
              >
                Abrir origem <ExternalLink className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        <section className="space-y-3">
          <h4 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
            Informações gerais
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {isReceita && <ReadOnlyField label="Cliente" value={linha.cliente ?? '—'} />}
            <ReadOnlyField label="Categoria" value={linha.categoria ?? '—'} />
            <ReadOnlyField label="Forma de pagamento" value={linha.meioPagamento ?? linha.cartao ?? '—'} />
            {isReceita && <ReadOnlyField label="Projeto" value={linha.projeto ?? '—'} />}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Valor</Label>
            <Input
              inputMode="decimal"
              value={editable || isRegisteringPayment ? valor : formatCurrency(linha.valor)}
              onChange={(e) => setValor(e.target.value)}
              disabled={!editable && !isRegisteringPayment}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Data</Label>
            <Input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              disabled={!editable && !isRegisteringPayment}
            />
          </div>

          {isRegisteringPayment && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Forma de pagamento</Label>
              <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                  <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                  <SelectItem value="transferencia">Transferência Bancária</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Descrição / observação</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              placeholder="Notas internas…"
              disabled={!editable && !isRegisteringPayment}
            />
          </div>
        </section>

        {gatewayInfo && (gatewayInfo.cobranca_parcelas || gatewayInfo.cobrancas) && (
          <section className="space-y-2.5 rounded-lg border border-border bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
                Composição do Gateway (Asaas)
              </h4>
              {gatewayInfo.cobranca_parcelas?.antecipado && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  Antecipado
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <div>
                <span className="text-muted-foreground block text-[11px]">Valor Bruto:</span>
                <span className="font-medium text-foreground">
                  {formatCurrency(
                    Number(gatewayInfo.cobranca_parcelas?.valor_principal ?? gatewayInfo.cobrancas?.valor_principal ?? linha.valor)
                  )}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Líquido Creditado:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(
                    Number(gatewayInfo.cobranca_parcelas?.valor_liquido_creditado ?? gatewayInfo.cobrancas?.valor_liquido_creditado ?? 0)
                  )}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Taxa de Processamento:</span>
                <span className="text-destructive font-medium">
                  - {formatCurrency(
                    Number(gatewayInfo.cobranca_parcelas?.taxa_processamento_real ?? gatewayInfo.cobrancas?.taxa_processamento_real ?? 0)
                  )}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Taxa de Antecipação:</span>
                <span className={cn(
                  "font-medium",
                  Number(gatewayInfo.cobranca_parcelas?.taxa_antecipacao_real ?? gatewayInfo.cobrancas?.taxa_antecipacao_real ?? 0) > 0
                    ? "text-destructive"
                    : "text-muted-foreground"
                )}>
                  {Number(gatewayInfo.cobranca_parcelas?.taxa_antecipacao_real ?? gatewayInfo.cobrancas?.taxa_antecipacao_real ?? 0) > 0
                    ? `- ${formatCurrency(Number(gatewayInfo.cobranca_parcelas?.taxa_antecipacao_real ?? gatewayInfo.cobrancas?.taxa_antecipacao_real))}`
                    : "R$ 0,00"}
                </span>
              </div>
            </div>

            {(gatewayInfo.cobranca_parcelas?.data_credito_real || gatewayInfo.cobrancas?.data_credito_real) && (
              <div className="text-[11px] text-muted-foreground pt-2 border-t border-border/50 flex flex-col gap-0.5">
                <div>
                  <strong className="text-foreground/80">Crédito efetivo no banco:</strong>{' '}
                  {formatDate(gatewayInfo.cobranca_parcelas?.data_credito_real || gatewayInfo.cobrancas?.data_credito_real)}
                </div>
                {(gatewayInfo.cobranca_parcelas?.data_credito || gatewayInfo.cobrancas?.data_credito) && (
                  <div className="text-[10.5px]">
                    Previsão original a termo:{' '}
                    {formatDate(gatewayInfo.cobranca_parcelas?.data_credito || gatewayInfo.cobrancas?.data_credito)}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        <section className="space-y-2">
          <h4 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
            Histórico
          </h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            {linha.dataCompetencia && <li>Competência: {formatDate(linha.dataCompetencia)}</li>}
            {linha.dataCaixa && <li>Caixa: {formatDate(linha.dataCaixa)}</li>}
            {linha.parcela && (
              <li>Parcela {linha.parcela.atual} de {linha.parcela.total}</li>
            )}
          </ul>
        </section>
      </div>
    </SidePanel>
    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir lançamento parcelado</AlertDialogTitle>
          <AlertDialogDescription>
            Este é um lançamento parcelado ({linha.parcela?.atual}/{linha.parcela?.total}). Deseja excluir apenas esta parcela ou todas as parcelas deste lançamento?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0 mt-4">
          <AlertDialogCancel className="mt-0">Cancelar</AlertDialogCancel>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                onDelete(linha.referenciaId, false);
                setDeleteDialogOpen(false);
              }}
            >
              Apenas esta
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDelete(linha.referenciaId, true);
                setDeleteDialogOpen(false);
              }}
            >
              Todas
            </Button>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    {isSessao && (
      <ChargeModal
        isOpen={isCharging}
        onClose={() => setIsCharging(false)}
        clienteId={sessionClienteId}
        clienteNome={linha.cliente || ''}
        sessionId={linha.referenciaId.replace('cs_', '')}
        valorSugerido={linha.valor}
      />
    )}
    </>
  );
});

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="text-sm text-foreground truncate">{value}</div>
    </div>
  );
}

export default FluxoDetailSheet;
