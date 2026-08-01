import { memo } from 'react';
import { ArrowDownRight, ArrowUpRight, Camera, CreditCard, Receipt, ChevronRight } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { format, parseISO } from 'date-fns';
import type { LinhaExtrato } from '@/types/extrato';
import { formatCurrency } from '@/utils/financialUtils';
import { cn } from '@/lib/utils';

interface FluxoTimelineRowProps {
  linha: LinhaExtrato;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onOpen: (linha: LinhaExtrato) => void;
  anySelected: boolean;
}

function iconForLinha(l: LinhaExtrato) {
  if (l.origem === 'workflow') return Camera;
  if (l.origem === 'cartao') return CreditCard;
  if (l.origem === 'gallery') return Receipt;
  return l.tipo === 'entrada' ? ArrowDownRight : ArrowUpRight;
}

function statusStyle(l: LinhaExtrato): { label: string; className: string } {
  const isAtrasado =
    l.status === 'Faturado' &&
    l.data &&
    parseISO(`${l.data}T12:00:00`).getTime() < new Date().setHours(0, 0, 0, 0);
  if (isAtrasado) {
    return { label: 'Atrasado', className: 'bg-destructive/10 text-destructive border-destructive/20' };
  }
  if (l.status === 'Pago') {
    return {
      label: l.tipo === 'entrada' ? 'Recebido' : 'Pago',
      className: 'bg-lunar-success/10 text-lunar-success border-lunar-success/20',
    };
  }
  if (l.status === 'Faturado') {
    return {
      label: l.tipo === 'entrada' ? 'A receber' : 'A pagar',
      className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    };
  }
  return { label: 'Agendado', className: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20' };
}

function formatDate(iso: string) {
  try {
    return format(parseISO(`${iso}T12:00:00`), 'dd/MM/yyyy');
  } catch {
    return iso;
  }
}

const FluxoTimelineRow = memo(function FluxoTimelineRow({
  linha,
  selected,
  onToggleSelect,
  onOpen,
  anySelected,
}: FluxoTimelineRowProps) {
  const Icon = iconForLinha(linha);
  const status = statusStyle(linha);
  const isReceita = linha.tipo === 'entrada';
  const titulo = linha.cliente || linha.descricao;
  const subtitulo = linha.projeto || linha.categoria || linha.descricao;

  return (
    <div
      className={cn(
        'group grid grid-cols-[auto_auto_1.4fr_1fr_auto_auto_auto_auto] items-center gap-3 px-2 py-2.5 rounded-md transition-colors cursor-pointer',
        selected ? 'bg-muted/60' : 'hover:bg-muted/40',
      )}
      onClick={() => onOpen(linha)}
    >
      {/* Checkbox */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'flex items-center justify-center w-6 transition-opacity',
          selected || anySelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
      >
        <Checkbox
          checked={selected}
          aria-label={selected ? 'Remover da seleção' : 'Selecionar lançamento'}
          onCheckedChange={() => onToggleSelect(linha.id)}
        />
      </div>

      {/* Ícone */}
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center border',
          isReceita ? 'border-lunar-success/30 text-lunar-success' : 'border-destructive/30 text-destructive',
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={1.5} />
      </div>

      {/* Título + subtítulo */}
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground truncate">{titulo}</div>
        {subtitulo && subtitulo !== titulo && (
          <div className="text-xs text-muted-foreground truncate">{subtitulo}</div>
        )}
      </div>

      {/* Categoria */}
      <div className="hidden md:block min-w-0">
        <div className="text-xs text-muted-foreground truncate">{linha.categoria || '—'}</div>
      </div>

      {/* Forma pagamento */}
      <div className="hidden lg:block">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          {linha.meioPagamento || (linha.cartao ? 'Cartão' : '—')}
        </span>
      </div>

      {/* Status */}
      <div>
        <span className={cn('inline-flex items-center h-6 px-2 rounded-full border text-[11px]', status.className)}>
          {status.label}
        </span>
      </div>

      {/* Data */}
      <div className="hidden sm:block text-xs text-muted-foreground tabular-nums">{formatDate(linha.data)}</div>

      {/* Valor + chevron */}
      <div className="flex items-center gap-2 ml-2">
        <span
          className={cn(
            'text-sm font-medium tabular-nums text-right',
            isReceita ? 'text-lunar-success' : 'text-destructive',
          )}
        >
          {isReceita ? '+ ' : '- '}
          {formatCurrency(Math.abs(linha.valor))}
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
});

export default FluxoTimelineRow;
