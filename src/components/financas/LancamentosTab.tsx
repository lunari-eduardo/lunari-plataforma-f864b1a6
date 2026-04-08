import { useState, useMemo, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Minus, TrendingDown, TrendingUp, ChevronDown, ChevronRight, ShoppingBag } from 'lucide-react';
import { TransacaoComItem, GrupoPrincipal, NovaTransacaoFinanceira, ItemFinanceiro } from '@/types/financas';
import { formatCurrency } from '@/utils/financialUtils';
import { GRUPOS_CONFIG, getInfoPorGrupo } from '@/utils/financialGroupUtils';
import TabelaLancamentos from './TabelaLancamentos';
import TabelaLancamentosMobile from './TabelaLancamentosMobile';
import ModalNovoLancamentoRefatorado from './ModalNovoLancamentoRefatorado';
import ModalVendaAvulsa from './ModalVendaAvulsa';
import MonthYearNavigator from '@/components/shared/MonthYearNavigator';
import { useIsMobile } from '@/hooks/use-mobile';
import { CreateTransactionInput } from '@/hooks/useFinancialTransactionsSupabase';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';

const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Ordem das seções na vista unificada
const SECOES_ORDEM: { grupo: GrupoPrincipal; label: string }[] = [
  { grupo: 'Despesa Fixa', label: 'Despesas Fixas' },
  { grupo: 'Despesa Variável', label: 'Despesas Variáveis' },
  { grupo: 'Investimento', label: 'Investimentos' },
  { grupo: 'Receita Operacional', label: 'Receitas Operacionais' },
  { grupo: 'Receita Não Operacional', label: 'Receitas Extras' },
];

interface LancamentosTabProps {
  filtroMesAno: { mes: number; ano: number };
  setFiltroMesAno: (filtro: { mes: number; ano: number }) => void;
  transacoesPorGrupo: Record<GrupoPrincipal, TransacaoComItem[]>;
  resumoFinanceiro: any;
  calcularMetricasPorGrupo: (grupo: GrupoPrincipal) => any;
  obterItensPorGrupo: (grupo: GrupoPrincipal) => ItemFinanceiro[];
  adicionarTransacao: (transacao: Omit<NovaTransacaoFinanceira, 'id' | 'userId' | 'criadoEm'>) => void;
  atualizarTransacao: (id: string, dadosAtualizados: Partial<NovaTransacaoFinanceira>) => void;
  removerTransacao: (id: string) => void;
  marcarComoPago: (id: string) => void;
  createTransactionEngine?: (input: CreateTransactionInput) => void;
}

const LancamentosTab = memo(function LancamentosTab({
  filtroMesAno,
  setFiltroMesAno,
  transacoesPorGrupo,
  calcularMetricasPorGrupo,
  obterItensPorGrupo,
  adicionarTransacao,
  atualizarTransacao,
  removerTransacao,
  marcarComoPago,
  createTransactionEngine
}: LancamentosTabProps) {
  const [modalAberto, setModalAberto] = useState(false);
  const [modalVendaAvulsa, setModalVendaAvulsa] = useState(false);
  const [modalTipo, setModalTipo] = useState<'despesa' | 'receita'>('despesa');
  const [modalGrupo, setModalGrupo] = useState<GrupoPrincipal>('Despesa Variável');
  const [modalFiltrarApenas, setModalFiltrarApenas] = useState(false);
  const [secoesAbertas, setSecoesAbertas] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    SECOES_ORDEM.forEach(s => { initial[s.grupo] = true; });
    return initial;
  });
  const isMobile = useIsMobile();

  // Calcular resumo geral
  const resumo = useMemo(() => {
    let totalReceitas = 0;
    let totalDespesas = 0;

    SECOES_ORDEM.forEach(({ grupo }) => {
      const metricas = calcularMetricasPorGrupo(grupo);
      if (grupo === 'Receita Operacional' || grupo === 'Receita Não Operacional') {
        totalReceitas += metricas.total || 0;
      } else {
        totalDespesas += metricas.total || 0;
      }
    });

    return { totalReceitas, totalDespesas, saldo: totalReceitas - totalDespesas };
  }, [calcularMetricasPorGrupo, transacoesPorGrupo]);

  const abrirModal = (tipo: 'despesa' | 'receita', grupo?: GrupoPrincipal, filtrarApenas = false) => {
    setModalTipo(tipo);
    setModalGrupo(grupo || (tipo === 'receita' ? 'Receita Não Operacional' : 'Despesa Variável'));
    setModalFiltrarApenas(filtrarApenas);
    setModalAberto(true);
  };

  const toggleSecao = (grupo: string) => {
    setSecoesAbertas(prev => ({ ...prev, [grupo]: !prev[grupo] }));
  };

  return (
    <div className="space-y-4">
      {/* Header: Navegador + Botões rápidos */}
      <div className="flex items-center justify-between gap-3">
        <MonthYearNavigator
          filtroMesAno={filtroMesAno}
          setFiltroMesAno={setFiltroMesAno}
          size={isMobile ? 'sm' : 'md'}
          className={isMobile ? 'flex-1' : ''}
        />

        <div className="flex items-center gap-2">
          <Button
            onClick={() => abrirModal('despesa')}
            variant="outline"
            size={isMobile ? 'sm' : 'default'}
            className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Minus className="h-4 w-4 mr-1" />
            {!isMobile && 'Despesa'}
          </Button>
          <Button
            onClick={() => abrirModal('receita')}
            variant="outline"
            size={isMobile ? 'sm' : 'default'}
            className="border-lunar-success/30 text-lunar-success hover:bg-lunar-success/10 hover:text-lunar-success"
          >
            <Plus className="h-4 w-4 mr-1" />
            {!isMobile && 'Receita'}
          </Button>
          <Button
            onClick={() => setModalVendaAvulsa(true)}
            variant="outline"
            size={isMobile ? 'sm' : 'default'}
            className="border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
          >
            <ShoppingBag className="h-4 w-4 mr-1" />
            {!isMobile && 'Venda'}
          </Button>
        </div>
      </div>

      {/* Resumo simplificado */}
      <div className="flex items-center gap-4 text-sm px-1">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-lunar-success" />
          <span className="text-muted-foreground">Receitas</span>
          <span className="font-semibold text-lunar-success">{formatCurrency(resumo.totalReceitas)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingDown className="h-3.5 w-3.5 text-destructive" />
          <span className="text-muted-foreground">Despesas</span>
          <span className="font-semibold text-destructive">{formatCurrency(resumo.totalDespesas)}</span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 ml-auto">
          <span className="text-muted-foreground">Saldo</span>
          <span className={`font-bold ${resumo.saldo >= 0 ? 'text-lunar-success' : 'text-destructive'}`}>
            {formatCurrency(resumo.saldo)}
          </span>
        </div>
      </div>

      {/* Seções unificadas */}
      <div className="space-y-3">
        {SECOES_ORDEM.map(({ grupo, label }) => {
          const transacoes = transacoesPorGrupo[grupo] || [];
          const info = getInfoPorGrupo(grupo);
          const metricas = calcularMetricasPorGrupo(grupo);
          const isOpen = secoesAbertas[grupo] ?? true;
          const temDados = transacoes.length > 0;

          return (
            <Collapsible
              key={grupo}
              open={isOpen}
              onOpenChange={() => toggleSecao(grupo)}
            >
              <div className={`border-l-[3px] rounded-lg ${info.corBorda} ${!temDados && !isOpen ? 'opacity-50' : ''}`}>
                {/* Header da seção */}
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between px-4 py-2.5 rounded-r-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2">
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className={`text-base font-bold ${info.corTema}`}>
                        {label}
                      </span>
                      {temDados && (
                        <Badge variant="secondary" className="text-[11px] px-1.5 py-0 h-5 font-normal">
                          {transacoes.length}
                        </Badge>
                      )}
                    </div>
                    {temDados && (
                      <span className={`text-sm font-semibold ${info.corTema}`}>
                        {formatCurrency(metricas.total || 0)}
                      </span>
                    )}
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="pl-3 pr-1 pb-2 pt-1">
                    {temDados ? (
                      isMobile ? (
                        <TabelaLancamentosMobile
                          transacoes={transacoes}
                          onAtualizarTransacao={atualizarTransacao}
                          onRemoverTransacao={removerTransacao}
                          onMarcarComoPago={marcarComoPago}
                          grupoAtivo={grupo}
                          obterItensPorGrupo={obterItensPorGrupo}
                        />
                      ) : (
                        <TabelaLancamentos
                          transacoes={transacoes}
                          onAtualizarTransacao={atualizarTransacao}
                          onRemoverTransacao={removerTransacao}
                          onMarcarComoPago={marcarComoPago}
                          grupoAtivo={grupo}
                          obterItensPorGrupo={obterItensPorGrupo}
                        />
                      )
                    ) : (
                      <p className="text-xs text-muted-foreground py-3 pl-7">
                        Nenhum lançamento neste mês.
                      </p>
                    )}

                    {/* Botão contextual de adicionar */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const tipo = (grupo === 'Receita Operacional' || grupo === 'Receita Não Operacional') ? 'receita' : 'despesa';
                        abrirModal(tipo, grupo, true);
                      }}
                      className={`flex items-center gap-1 text-xs ${info.corTema} opacity-60 hover:opacity-100 transition-opacity pl-7 py-1.5`}
                    >
                      <Plus className="h-3 w-3" />
                      Adicionar {label.toLowerCase().replace('receitas', 'receita').replace('despesas', 'despesa').replace('investimentos', 'investimento')}
                    </button>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </div>

      {/* Saldo mobile (bottom) */}
      {isMobile && (
        <div className="flex items-center justify-center gap-1.5 text-sm pt-2 border-t border-border">
          <span className="text-muted-foreground">Saldo</span>
          <span className={`font-bold ${resumo.saldo >= 0 ? 'text-lunar-success' : 'text-destructive'}`}>
            {formatCurrency(resumo.saldo)}
          </span>
        </div>
      )}

      {/* Modal */}
      <ModalNovoLancamentoRefatorado
        aberto={modalAberto}
        onFechar={() => setModalAberto(false)}
        createTransactionEngine={createTransactionEngine}
        obterItensPorGrupo={obterItensPorGrupo}
        grupoAtivo={modalGrupo}
        tipoLancamento={modalTipo}
        filtrarApenasGrupo={modalFiltrarApenas}
      />

      <ModalVendaAvulsa
        aberto={modalVendaAvulsa}
        onFechar={() => setModalVendaAvulsa(false)}
      />
    </div>
  );
});

export default LancamentosTab;
