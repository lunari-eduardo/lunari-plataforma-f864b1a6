/**
 * FluxoFinanceiroView — página unificada que substitui Lançamentos, Extrato e Metas
 * operacionais dentro da aba "Fluxo Financeiro". Filosofia Silent Luxury: interface
 * limpa, muito espaço em branco, timeline agrupada, sem cards decorativos.
 *
 * Regra crítica: NADA de lógica de negócio nova. Consome useExtrato (leitura unificada)
 * + useNovoFinancas (mutations existentes) exatamente como já estavam.
 */
import { memo, useMemo, useState, useEffect } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { useExtrato } from '@/hooks/useExtrato';
import { useNovoFinancas } from '@/hooks/useNovoFinancas';
import { parseFinancialInput } from '@/utils/financialPrecision';
import { cn } from '@/lib/utils';
import type { LinhaExtrato, ExtratoStatus } from '@/types/extrato';
import FluxoTimeline from './FluxoTimeline';
import FluxoResumoBar from './FluxoResumoBar';
import FluxoResumoExpandable from './FluxoResumoExpandable';
import FluxoFiltersSheet from './FluxoFiltersSheet';
import FluxoBulkBar from './FluxoBulkBar';
import FluxoDetailSheet from './FluxoDetailSheet';
import PeriodActionBar from '@/modules/finance/presentation/shell/PeriodActionBar';
import { useLancamentoDrawer } from '@/modules/finance/presentation/shell/LancamentoDrawerProvider';
import {
  FINANCE_FOCUS_FLUXO_EVENT,
  type FluxoFocusPayload,
} from '@/modules/finance/presentation/navigation';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';


type Chip = 'todos' | 'receitas' | 'despesas' | 'a_receber' | 'a_pagar';

const CHIPS: { key: Chip; label: string; dot?: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'receitas', label: 'Receitas', dot: 'bg-lunar-success' },
  { key: 'despesas', label: 'Despesas', dot: 'bg-destructive' },
  { key: 'a_receber', label: 'A Receber', dot: 'bg-amber-500' },
  { key: 'a_pagar', label: 'A Pagar', dot: 'bg-sky-500' },
];

const FluxoFinanceiroView = memo(function FluxoFinanceiroView() {
  const isMobile = useIsMobile();
  const extrato = useExtrato();
  const financas = useNovoFinancas();
  const drawer = useLancamentoDrawer();
  const { dialogState, confirm, handleConfirm, handleCancel, handleClose } = useConfirmDialog();


  // Estado local (view-state)
  const [chip, setChip] = useState<Chip>('todos');
  const [busca, setBusca] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailLinha, setDetailLinha] = useState<LinhaExtrato | null>(null);
  const [valorMin, setValorMin] = useState('');
  const [valorMax, setValorMax] = useState('');
  const [highlightId, setHighlightId] = useState<string | null>(null);

  // Foco vindo da Visão Geral (Agenda / Pendências)
  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<FluxoFocusPayload>).detail;
      if (!detail) return;
      const [yStr, mStr] = detail.dataVencimento.split('-');
      const ano = Number(yStr);
      const mes = Number(mStr);
      if (ano && mes) {
        setFiltroMesAno({ mes, ano });
      }
      const nextChip: Chip = detail.tipo === 'entrada' ? 'receitas' : 'despesas';
      applyChip(nextChip);
      setBusca('');
      setHighlightId(detail.transacaoId);
      const t = window.setTimeout(() => setHighlightId(null), 3500);
      return () => window.clearTimeout(t);
    };
    window.addEventListener(FINANCE_FOCUS_FLUXO_EVENT, handler as EventListener);
    return () => window.removeEventListener(FINANCE_FOCUS_FLUXO_EVENT, handler as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync competência (mês/ano) do Fluxo com o range de datas do useExtrato
  const filtroMesAno = financas.filtroMesAno;
  const setFiltroMesAno = (novo: { mes: number; ano: number }) => {
    financas.setFiltroMesAno(novo);
    const start = new Date(novo.ano, novo.mes - 1, 1);
    const end = new Date(novo.ano, novo.mes, 0);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    extrato.atualizarFiltros({ dataInicio: fmt(start), dataFim: fmt(end) });
  };

  // Aplica chip → filtros do extrato
  const applyChip = (c: Chip) => {
    setChip(c);
    switch (c) {
      case 'todos':
        extrato.atualizarFiltros({ tipo: 'todos', status: 'todos' });
        break;
      case 'receitas':
        extrato.atualizarFiltros({ tipo: 'entrada', status: 'todos' });
        break;
      case 'despesas':
        extrato.atualizarFiltros({ tipo: 'saida', status: 'todos' });
        break;
      case 'a_receber':
        extrato.atualizarFiltros({ tipo: 'entrada', status: 'Faturado' as ExtratoStatus });
        break;
      case 'a_pagar':
        extrato.atualizarFiltros({ tipo: 'saida', status: 'Faturado' as ExtratoStatus });
        break;
    }
  };

  // Busca client-side + valor min/max
  const linhasVisiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const min = valorMin ? parseFinancialInput(valorMin) : null;
    const max = valorMax ? parseFinancialInput(valorMax) : null;
    return extrato.linhas.filter((l) => {
      if (q) {
        const hay = `${l.cliente ?? ''} ${l.descricao ?? ''} ${l.categoria ?? ''} ${l.projeto ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (min !== null && Math.abs(l.valor) < min) return false;
      if (max !== null && Math.abs(l.valor) > max) return false;
      return true;
    });
  }, [extrato.linhas, busca, valorMin, valorMax]);

  // Resumo derivado das linhas visíveis
  const resumo = useMemo(() => {
    let entradas = 0;
    let saidas = 0;
    linhasVisiveis.forEach((l) => {
      if (l.tipo === 'entrada') entradas += l.valor;
      else saidas += l.valor;
    });
    return { entradas, saidas, saldo: entradas - saidas };
  }, [linhasVisiveis]);

  // Toggle seleção
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  // Bulk actions — só aplicam a lançamentos de origem "financeiro"
  const selectedFinanceLinhas = useMemo(
    () => linhasVisiveis.filter((l) => selectedIds.has(l.id) && l.origem === 'financeiro'),
    [linhasVisiveis, selectedIds],
  );

  const handleBulkMarkPaid = async () => {
    const targets = selectedFinanceLinhas.filter((l) => l.status !== 'Pago');
    await Promise.all(targets.map((l) => financas.marcarComoPago(l.referenciaId)));
    clearSelection();
  };

  const handleBulkDelete = async () => {
    const ok = await confirm({
      title: 'Excluir lançamentos',
      description: `Tem certeza que deseja excluir ${selectedFinanceLinhas.length} lançamento(s)? Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });
    if (!ok) return;
    await Promise.all(
      selectedFinanceLinhas.map((l) => financas.removerTransacao(l.referenciaId)),
    );
    clearSelection();
  };



  // Filtros aplicados totalizados
  const filtrosAtivos =
    (extrato.filtros.origem && extrato.filtros.origem !== 'todos' ? 1 : 0) +
    (extrato.filtros.cliente ? 1 : 0) +
    (extrato.filtros.formaPagamento ? 1 : 0) +
    (valorMin ? 1 : 0) +
    (valorMax ? 1 : 0);

  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-4 lg:px-6">
      <PeriodActionBar
        ano={String(filtroMesAno.ano)}
        setAno={(v) => setFiltroMesAno({ mes: filtroMesAno.mes, ano: parseInt(v, 10) })}
        mes={String(filtroMesAno.mes)}
        setMes={(v) => setFiltroMesAno({ mes: parseInt(v, 10), ano: filtroMesAno.ano })}
        anosDisponiveis={(() => {
          const y = new Date().getFullYear();
          return [y - 2, y - 1, y, y + 1];
        })()}
        onSelectTipo={(tipo) => drawer.open({ tipo })}
      />

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 pb-4">


        <div className="flex items-center gap-1 overflow-x-auto -mx-1 px-1">
          {CHIPS.map((c) => {
            const active = chip === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => applyChip(c.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                  active
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                {c.dot && <span className={cn('w-1.5 h-1.5 rounded-full', c.dot)} />}
                {c.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 relative min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente, categoria ou descrição…"
            className="pl-9 h-9"
          />
        </div>

        <Button variant="outline" size="sm" onClick={() => setFiltersOpen(true)} className="gap-1.5">
          <SlidersHorizontal className="h-4 w-4" strokeWidth={1.5} />
          Filtros
          {filtrosAtivos > 0 && (
            <span className="ml-1 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-foreground text-background text-[10px]">
              {filtrosAtivos}
            </span>
          )}
        </Button>
      </div>

      {/* Resumo bar */}
      <FluxoResumoBar
        entradas={resumo.entradas}
        saidas={resumo.saidas}
        saldo={resumo.saldo}
        selecionados={selectedIds.size}
      />

      {/* Resumo Financeiro expandível */}
      <FluxoResumoExpandable
        receita={resumo.entradas}
        despesas={resumo.saidas}
        lucro={resumo.saldo}
        resultadoAcumulado={extrato.resumo?.saldoEfetivo ?? resumo.saldo}
        saldoPrevisto={extrato.resumo?.saldoProjetado ?? resumo.saldo}
      />

      {/* Timeline */}
      <div className="pt-4 pb-24">
        <FluxoTimeline
          linhas={linhasVisiveis}
          isLoading={extrato.isLoading}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onOpen={setDetailLinha}
          highlightId={highlightId}
        />
      </div>

      {/* Side sheets */}
      <FluxoFiltersSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filtros={extrato.filtros}
        onChange={extrato.atualizarFiltros}
        onReset={() => {
          extrato.limparFiltros();
          setValorMin('');
          setValorMax('');
        }}
        valorMin={valorMin}
        valorMax={valorMax}
        onValorMinChange={setValorMin}
        onValorMaxChange={setValorMax}
      />

      <FluxoDetailSheet
        linha={detailLinha}
        onClose={() => setDetailLinha(null)}
        onSave={async (id, patch) => {
          await financas.atualizarTransacao(id, patch);
        }}
        onDelete={async (id) => {
          const ok = await confirm({
            title: 'Excluir lançamento',
            description: 'Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.',
            confirmText: 'Excluir',
            cancelText: 'Cancelar',
            variant: 'destructive',
          });
          if (!ok) return;
          await financas.removerTransacao(id);
          setDetailLinha(null);
        }}

        onMarkPaid={async (id) => {
          await financas.marcarComoPago(id);
          setDetailLinha(null);
        }}
        onOpenOrigin={extrato.abrirOrigem}
      />

      <FluxoBulkBar
        count={selectedIds.size}
        onClear={clearSelection}
        onMarkPaid={handleBulkMarkPaid}
        onDelete={handleBulkDelete}
      />

      <ConfirmDialog
        state={dialogState}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        onClose={handleClose}
      />
    </div>

  );
});

export default FluxoFinanceiroView;
