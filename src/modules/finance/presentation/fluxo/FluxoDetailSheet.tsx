import { memo, useEffect, useState } from 'react';
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
