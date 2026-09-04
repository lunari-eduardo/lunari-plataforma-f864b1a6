/**
 * FluxoFinanceiroView — página unificada que substitui Lançamentos, Extrato e Metas
 * operacionais dentro da aba "Fluxo Financeiro". Filosofia Silent Luxury: interface
 * limpa, muito espaço em branco, timeline agrupada, sem cards decorativos.
 *
 * Regra crítica: NADA de lógica de negócio nova. Consome useExtrato (leitura unificada)
 * + useNovoFinancas (mutations existentes) exatamente como já estavam.
 */
import { memo, useMemo, useState, useEffect, useCallback } from 'react';
import { Search, SlidersHorizontal, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import FluxoDetailSheet from './FluxoDetailSheet';
import PeriodActionBar from '@/modules/finance/presentation/shell/PeriodActionBar';
import FinancePageContainer from '@/modules/finance/presentation/shell/FinancePageContainer';
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

  const [selectedAno, setSelectedAno] = useState<number>(() => financas.filtroMesAno.ano);
  const [selectedMes, setSelectedMes] = useState<string>(() => String(financas.filtroMesAno.mes));

  const handlePeriodChange = useCallback((novoAno: number, novoMes: string) => {
    setSelectedAno(novoAno);
    setSelectedMes(novoMes);

    if (novoMes === 'ano-completo') {
      extrato.atualizarFiltros({
        dataInicio: `${novoAno}-01-01`,
        dataFim: `${novoAno}-12-31`,
      });
    } else {
      const mNum = parseInt(novoMes, 10);
      if (!isNaN(mNum)) {
        financas.setFiltroMesAno({ mes: mNum, ano: novoAno });
        const start = new Date(novoAno, mNum - 1, 1);
        const end = new Date(novoAno, mNum, 0);
        const fmt = (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        extrato.atualizarFiltros({ dataInicio: fmt(start), dataFim: fmt(end) });
      }
    }
  }, [extrato, financas]);

  // Foco vindo da Visão Geral (Agenda / Pendências)
  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<FluxoFocusPayload>).detail;
      if (!detail) return;
      const [yStr, mStr] = detail.dataVencimento.split('-');
      const ano = Number(yStr);
      const mes = Number(mStr);
      if (ano && mes) {
        handlePeriodChange(ano, String(mes));
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
  }, [handlePeriodChange]);

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
        // Filtra pendentes (Faturado + Agendado)
        extrato.atualizarFiltros({ tipo: 'entrada', status: 'pendentes' as any });
        break;
      case 'a_pagar':
        // Filtra pendentes (Faturado + Agendado)
        extrato.atualizarFiltros({ tipo: 'saida', status: 'pendentes' as any });
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

  const toggleGroup = (ids: string[], selecionarTodos: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (selecionarTodos ? next.add(id) : next.delete(id)));
      return next;
    });
  };

  // Marcar como pago direto na linha (sem abrir o painel)
  const handleMarkPaidRow = async (linha: LinhaExtrato) => {
    await financas.marcarComoPago(linha.referenciaId);
  };

  // Seleção — apenas informativa: soma nas métricas superiores
  const resumoSelecao = useMemo(() => {
    let entradas = 0;
    let saidas = 0;
    let count = 0;
    linhasVisiveis.forEach((l) => {
      if (!selectedIds.has(l.id)) return;
      count += 1;
      if (l.tipo === 'entrada') entradas += l.valor;
      else saidas += l.valor;
    });
    return { entradas, saidas, saldo: entradas - saidas, count };
  }, [linhasVisiveis, selectedIds]);




  // Filtros aplicados totalizados
  const filtrosAtivos =
    (extrato.filtros.origem && extrato.filtros.origem !== 'todos' ? 1 : 0) +
    (extrato.filtros.escopo && extrato.filtros.escopo !== 'todos' ? 1 : 0) +
    (extrato.filtros.cliente ? 1 : 0) +
    (extrato.filtros.formaPagamento ? 1 : 0) +
    (valorMin ? 1 : 0) +
    (valorMax ? 1 : 0);

  const regimeControl = (
    <div className="flex items-center gap-1.5 ml-1 sm:ml-2">
      <div className="inline-flex items-center p-0.5 rounded-lg bg-muted/50 border border-border/60 text-xs">
        <button
          type="button"
          onClick={() => extrato.setRegime('caixa')}
          className={cn(
            'px-2.5 py-1 rounded-md text-xs font-medium transition-all',
            extrato.regime === 'caixa'
              ? 'bg-background text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Caixa
        </button>
        <button
          type="button"
          onClick={() => extrato.setRegime('competencia')}
          className={cn(
            'px-2.5 py-1 rounded-md text-xs font-medium transition-all',
            extrato.regime === 'competencia'
              ? 'bg-background text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Competência
        </button>
      </div>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground p-1 transition-colors"
              aria-label="Sobre regimes contábeis"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
            <p className="font-semibold mb-1">Regime Contábil</p>
            <p className="mb-1">
              <strong>Caixa:</strong> considera a data em que o valor efetivamente entrou ou saiu da conta bancária/gateway (fluxo financeiro real).
            </p>
            <p>
              <strong>Competência:</strong> considera a data do fato gerador (prestação do serviço ou competência da despesa), refletindo o resultado contábil do período.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );

  return (
    <FinancePageContainer>
      <PeriodActionBar
        ano={String(selectedAno)}
        setAno={(v) => handlePeriodChange(parseInt(v, 10), selectedMes)}
        mes={selectedMes}
        setMes={(v) => handlePeriodChange(selectedAno, v)}
        anosDisponiveis={(() => {
          const y = new Date().getFullYear();
          return [y - 2, y - 1, y, y + 1];
        })()}
        showAnoTodo
        extraLeft={regimeControl}
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
        selecionados={resumoSelecao.count}
        selecaoEntradas={resumoSelecao.entradas}
        selecaoSaidas={resumoSelecao.saidas}
        selecaoSaldo={resumoSelecao.saldo}
        onClearSelection={clearSelection}
      />

      {/* Resumo Financeiro expandível (Demonstrativo) */}
      <FluxoResumoExpandable
        ano={selectedAno}
        mes={selectedMes}
        periodo={{
          inicio: extrato.filtros.dataInicio,
          fim: extrato.filtros.dataFim,
        }}
        linhas={linhasVisiveis}
        regime={extrato.regime}
        onSetMes={(m) => handlePeriodChange(selectedAno, m)}
      />

      {/* Timeline */}
      <div className="pt-4 pb-24">
        {!extrato.isLoading && (
          <div className="pb-2 text-[11px] text-muted-foreground">
            {linhasVisiveis.length === 1
              ? '1 lançamento'
              : `${linhasVisiveis.length} lançamentos`}
            {extrato.filtros.escopo && extrato.filtros.escopo !== 'todos' ? ' · filtrado por escopo' : ''}
          </div>
        )}
        <FluxoTimeline
          linhas={linhasVisiveis}
          isLoading={extrato.isLoading}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleGroup={toggleGroup}
          onMarkPaid={handleMarkPaidRow}
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
          const hoje = new Date();
          handlePeriodChange(hoje.getFullYear(), String(hoje.getMonth() + 1));
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
        onDelete={async (id, deleteAllSeries) => {
          if (deleteAllSeries === undefined) {
            const ok = await confirm({
              title: 'Excluir lançamento',
              description: 'Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.',
              confirmText: 'Excluir',
              cancelText: 'Cancelar',
              variant: 'destructive',
            });
            if (!ok) return;
          }
          await financas.removerTransacao(id, deleteAllSeries);
          setDetailLinha(null);
        }}

        onMarkPaid={async (id) => {
          await financas.marcarComoPago(id);
          // O painel permanece aberto
        }}
        onMarkPending={async (id) => {
          await financas.marcarComoPendente(id);
          // O painel permanece aberto
        }}
        onOpenOrigin={extrato.abrirOrigem}
      />




      <ConfirmDialog
        state={dialogState}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        onClose={handleClose}
      />
    </FinancePageContainer>

  );
});

export default FluxoFinanceiroView;
