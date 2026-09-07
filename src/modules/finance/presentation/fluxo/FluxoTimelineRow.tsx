import { memo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Camera, CreditCard, Receipt, ChevronRight, Check, Loader2, ShoppingBag } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { format, parseISO } from 'date-fns';
import type { LinhaExtrato } from '@/types/extrato';
import { formatCurrency } from '@/utils/financialUtils';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Grid único compartilhado entre o cabeçalho (FluxoTimeline) e as linhas.
 * Larguras fixas nas colunas curtas evitam o "flutuar" das colunas entre linhas.
 */
export const FLUXO_GRID =
  'grid grid-cols-[28px_32px_minmax(0,1.6fr)] md:grid-cols-[28px_32px_minmax(0,1.6fr)_minmax(0,1fr)] lg:grid-cols-[28px_32px_minmax(0,1.6fr)_minmax(0,1fr)_150px_100px_92px_120px_72px] items-center gap-3';

interface FluxoTimelineRowProps {
  linha: LinhaExtrato;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onOpen: (linha: LinhaExtrato) => void;
  anySelected: boolean;
  onMarkPaid?: (linha: LinhaExtrato) => Promise<void> | void;
}

function iconForLinha(l: LinhaExtrato) {
  if (l.origem === 'workflow') return Camera;
  if (l.origem === 'cartao') return CreditCard;
  if (l.origem === 'gallery') return Receipt;
  if (l.origem === 'venda_avulsa') return ShoppingBag;
  return l.tipo === 'entrada' ? ArrowDownRight : ArrowUpRight;
}

export function isAtrasada(l: LinhaExtrato) {
  if (l.status !== 'Faturado' || !l.data) return false;
  const match = l.data.match(/^(\d{4}-\d{2}-\d{2})/);
  const datePart = match ? match[1] : l.data.slice(0, 10);
  const d = parseISO(`${datePart}T12:00:00`);
  return !isNaN(d.getTime()) && d.getTime() < new Date().setHours(0, 0, 0, 0);
}

function statusStyle(l: LinhaExtrato): { label: string; className: string } {
  if (isAtrasada(l)) {
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

const ESCOPO_LABEL: Record<string, string> = {
  sinal: 'Sinal',
  sessao: 'Sessão',
  fotos_extras: 'Extras',
  sessao_e_extras: 'Sessão + Extras',
  avulso: 'Avulso',
};

const PROVEDOR_LABEL: Record<string, string> = {
  manual: 'Manual',
  asaas: 'Asaas',
  mercadopago: 'Mercado Pago',
  infinitepay: 'InfinitePay',
  estorno: 'Estorno',
};

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

const FluxoTimelineRow = memo(function FluxoTimelineRow({
  linha,
  selected,
  onToggleSelect,
  onOpen,
  anySelected,
  onMarkPaid,
}: FluxoTimelineRowProps) {
  const [marking, setMarking] = useState(false);
  const Icon = iconForLinha(linha);
  const status = statusStyle(linha);
  const isReceita = linha.tipo === 'entrada';
  const cleanText = (text: string) => {
    if (!text) return text;
    const partes = text.split(' · ');
    const validas = partes.filter(p => 
      !p.startsWith('Forma:') && 
      !p.startsWith('Favorecido:') && 
      !p.startsWith('Origem:') && 
      p !== 'Recorrente - Valor Fixo' && 
      p !== 'Recorrente - Editar Valor'
    );
    return validas.length > 0 ? validas.join(' · ') : text;
  };

  const cleanDescricao = cleanText(linha.descricao);
  const titulo = cleanText(linha.cliente || cleanDescricao);
  const subtitulo = cleanText(linha.projeto || linha.categoria || cleanDescricao);

  // Marcar como pago só faz sentido em lançamentos do financeiro ainda não pagos
  const podeMarcarPago = !!onMarkPaid && linha.origem === 'financeiro' && linha.status !== 'Pago';

  const provedor = linha.meioPagamento
    ? PROVEDOR_LABEL[linha.meioPagamento] || linha.meioPagamento
    : linha.cartao || '—';
  const escopoLabel = linha.escopo ? ESCOPO_LABEL[linha.escopo] : null;

  const handleMarkPaid = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onMarkPaid || marking) return;
    setMarking(true);
    try {
      await onMarkPaid(linha);
    } finally {
      setMarking(false);
    }
  };

  return (
    <div
      className={cn(
        FLUXO_GRID,
        'group px-2 py-2.5 rounded-md transition-colors cursor-pointer text-left',
        selected ? 'bg-muted/60' : 'hover:bg-muted/40',
      )}
      onClick={() => onOpen(linha)}
    >
      {/* Checkbox */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'flex items-center justify-start transition-opacity',
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
          'w-8 h-8 rounded-full flex items-center justify-center border shrink-0',
          isReceita ? 'border-lunar-success/30 text-lunar-success' : 'border-destructive/30 text-destructive',
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={1.5} />
      </div>

      {/* Título + subtítulo */}
      <div className="min-w-0 text-left">
        <div className="text-sm font-medium text-foreground truncate">{titulo}</div>
        {subtitulo && subtitulo !== titulo && (
          <div className="text-xs text-muted-foreground truncate">{subtitulo}</div>
        )}
        <div
          className={cn(
            'lg:hidden text-xs font-medium tabular-nums mt-0.5',
            isReceita ? 'text-lunar-success' : 'text-destructive',
          )}
        >
          {isReceita ? '+ ' : '- '}
          {formatCurrency(Math.abs(linha.valor))}
        </div>
      </div>

      {/* Categoria */}
      <div className="hidden md:block min-w-0 text-left">
        <div className="text-xs text-muted-foreground truncate">{linha.categoria || '—'}</div>
      </div>

      {/* Origem do pagamento: provedor + escopo */}
      <div className="hidden lg:flex flex-col items-start min-w-0">
        <span className="text-xs text-muted-foreground truncate max-w-full">{provedor}</span>
        {escopoLabel && (
          <span className="mt-0.5 inline-flex items-center h-4 px-1.5 rounded-full border border-border/60 text-[10px] text-muted-foreground">
            {escopoLabel}
          </span>
        )}
      </div>

      {/* Status */}
      <div className="hidden lg:block text-left">
        <span className={cn('inline-flex items-center h-6 px-2 rounded-full border text-[11px]', status.className)}>
          {status.label}
        </span>
      </div>

      {/* Data */}
      <div className="hidden lg:block text-xs text-muted-foreground tabular-nums text-left">
        {formatDate(linha.data)}
      </div>

      {/* Valor */}
      <div className="hidden lg:block text-left">
        <span
          className={cn(
            'text-sm font-medium tabular-nums',
            isReceita ? 'text-lunar-success' : 'text-destructive',
          )}
        >
          {isReceita ? '+ ' : '- '}
          {formatCurrency(Math.abs(linha.valor))}
        </span>
      </div>

      {/* Ações */}
      <div className="hidden lg:flex items-center justify-start gap-1">
        {podeMarcarPago && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleMarkPaid}
                aria-label={isReceita ? 'Marcar como recebido' : 'Marcar como pago'}
                className="h-7 w-7 rounded-full border border-lunar-success/30 text-lunar-success flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity hover:bg-lunar-success/10"
              >
                {marking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent>{isReceita ? 'Marcar como recebido' : 'Marcar como pago'}</TooltipContent>
          </Tooltip>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

    </div>
  );
});

export default FluxoTimelineRow;
