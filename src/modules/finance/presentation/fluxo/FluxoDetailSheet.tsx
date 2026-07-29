import { memo, useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import type { LinhaExtrato } from '@/types/extrato';
import { formatCurrency } from '@/utils/financialUtils';
import { parseFinancialInput } from '@/utils/financialPrecision';
import { cn } from '@/lib/utils';
import { ArrowDownLeft, ArrowUpRight, ExternalLink, Trash2 } from 'lucide-react';
import { SidePanel } from '@/modules/finance/presentation/shell/SidePanel';

interface FluxoDetailSheetProps {
  linha: LinhaExtrato | null;
  onClose: () => void;
  onSave: (id: string, patch: { valor?: number; data_vencimento?: string; observacoes?: string }) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  onMarkPaid: (id: string) => Promise<void> | void;
  onOpenOrigin?: (linha: LinhaExtrato) => void;
}

const FluxoDetailSheet = memo(function FluxoDetailSheet({
  linha,
  onClose,
  onSave,
  onDelete,
  onMarkPaid,
  onOpenOrigin,
}: FluxoDetailSheetProps) {
  const [valor, setValor] = useState('');
  const [data, setData] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (linha) {
      setValor(String(linha.valor.toFixed(2)).replace('.', ','));
      setData(linha.data);
      setObservacoes(linha.observacoes ?? '');
    }
  }, [linha]);

  if (!linha) return null;

  const editable = linha.origem === 'financeiro';
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
      <span className="inline-flex items-center h-6 px-2 rounded-full border border-border text-[11px] text-muted-foreground">
        {linha.status}
      </span>
      <span className="inline-flex items-center h-6 px-2 rounded-full border border-border text-[11px] text-muted-foreground capitalize">
        {linha.origem}
      </span>
    </div>
  );

  const footer = (
    <SidePanel.Footer
      left={
        editable ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(linha.referenciaId)}
            className="text-destructive hover:text-destructive gap-1.5"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
            Excluir
          </Button>
        ) : null
      }
      right={
        <>
          {linha.status !== 'Pago' && editable && (
            <Button variant="outline" size="sm" onClick={() => onMarkPaid(linha.referenciaId)}>
              Marcar pago
            </Button>
          )}
          {editable && (
            <Button size="sm" onClick={handleSave} disabled={saving}>
              Salvar
            </Button>
          )}
        </>
      }
    />
  );

  return (
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
            <ReadOnlyField label="Cliente" value={linha.cliente ?? '—'} />
            <ReadOnlyField label="Categoria" value={linha.categoria ?? '—'} />
            <ReadOnlyField label="Forma de pagamento" value={linha.meioPagamento ?? linha.cartao ?? '—'} />
            <ReadOnlyField label="Projeto" value={linha.projeto ?? '—'} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Valor</Label>
            <Input
              inputMode="decimal"
              value={editable ? valor : formatCurrency(linha.valor)}
              onChange={(e) => setValor(e.target.value)}
              disabled={!editable}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Data</Label>
            <Input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              disabled={!editable}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Descrição / observação</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              placeholder="Notas internas…"
              disabled={!editable}
            />
          </div>
        </section>

        <section className="space-y-2">
          <h4 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
            Histórico
          </h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            {linha.dataCompetencia && <li>Competência: {linha.dataCompetencia}</li>}
            {linha.dataCaixa && <li>Caixa: {linha.dataCaixa}</li>}
            {linha.parcela && (
              <li>Parcela {linha.parcela.atual} de {linha.parcela.total}</li>
            )}
          </ul>
        </section>
      </div>
    </SidePanel>
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
