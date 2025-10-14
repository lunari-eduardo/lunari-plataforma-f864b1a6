import { useState, memo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus, Receipt, CreditCard, PiggyBank, TrendingUp } from 'lucide-react';
import { TransacaoComItem, GrupoPrincipal, NovaTransacaoFinanceira, ItemFinanceiro } from '@/types/financas';
import { formatCurrency } from '@/utils/financialUtils';
import { GRUPOS_ORDEM, getInfoPorGrupo } from '@/utils/financialGroupUtils';
import TabelaLancamentos from './TabelaLancamentos';
import TabelaLancamentosMobile from './TabelaLancamentosMobile';
import ModalNovoLancamentoRefatorado from './ModalNovoLancamentoRefatorado';
import MonthYearNavigator from '@/components/shared/MonthYearNavigator';
import { useIsMobile } from '@/hooks/use-mobile';
import { CreateTransactionInput } from '@/hooks/useFinancialTransactionsSupabase';

const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
interface LancamentosTabProps {
  filtroMesAno: {
    mes: number;
    ano: number;
  };
  setFiltroMesAno: (filtro: {
    mes: number;
    ano: number;
  }) => void;
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
  const [activeSubTab, setActiveSubTab] = useState<GrupoPrincipal>('Despesa Fixa');
  const [modalNovoLancamentoAberto, setModalNovoLancamentoAberto] = useState(false);
  const isMobile = useIsMobile();
  const metricas = calcularMetricasPorGrupo(activeSubTab);
  const infoGrupo = getInfoPorGrupo(activeSubTab);
  return <div className="space-y-6">
      {/* Linha 1: Barra de Totais */}
      <div className="rounded-lg border border-border p-4 shadow-sm bg-lunar-bg py-[4px]">
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <div className="flex items-center gap-1">
            <span className="font-medium text-foreground">Total:</span>
            <span className="font-bold text-foreground">{formatCurrency(metricas.total)}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-lunar-success rounded-full"></div>
            <span className="text-muted-foreground">Pago:</span>
            <span className="font-semibold text-lunar-success">{formatCurrency(metricas.pago)}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-lunar-error rounded-full"></div>
            <span className="text-muted-foreground">Faturado:</span>
            <span className="font-semibold text-lunar-error">{formatCurrency(metricas.faturado)}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-lunar-warning rounded-full"></div>
            <span className="text-muted-foreground">Agendado:</span>
            <span className="font-semibold text-lunar-warning">{formatCurrency(metricas.agendado)}</span>
          </div>
        </div>
      </div>

      {/* Linha 2: Barra de Controles */}
      <div className="space-y-4">
        {/* Desktop Layout */}
        {!isMobile && <div className="flex items-center justify-between">
            {/* Grupo da Esquerda: Sub-abas */}
            <Tabs value={activeSubTab} onValueChange={value => setActiveSubTab(value as GrupoPrincipal)}>
              <TabsList className="flex h-10 p-1 bg-card border border-border rounded-lg py-0 px-0">
                <TabsTrigger value="Despesa Fixa" className="flex items-center gap-2 px-4 data-[state=active]:bg-muted data-[state=active]:text-destructive py-[7px] text-xs">
                  <Receipt className="h-4 w-4" />
                  Fixas
                </TabsTrigger>
                <TabsTrigger value="Despesa Variável" className="flex items-center gap-2 px-4 data-[state=active]:bg-muted data-[state=active]:text-lunar-warning py-[5px] text-xs">
                  <CreditCard className="h-4 w-4" />
                  Variáveis
                </TabsTrigger>
                <TabsTrigger value="Investimento" className="flex items-center gap-2 px-4 data-[state=active]:bg-muted data-[state=active]:text-primary py-[5px] text-xs">
                  <TrendingUp className="h-4 w-4" />
                  Investimentos
                </TabsTrigger>
                <TabsTrigger value="Receita Não Operacional" className="flex items-center gap-2 px-4 data-[state=active]:bg-muted data-[state=active]:text-lunar-success py-[5px] text-xs">
                  <PiggyBank className="h-4 w-4" />
                  Receitas
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Grupo da Direita: Botão Novo Lançamento */}
            <Button onClick={() => setModalNovoLancamentoAberto(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs py-0">
              <Plus className="h-4 w-4 mr-2" />
              Novo Lançamento
            </Button>
          </div>}

        {/* Mobile Layout */}
        {isMobile && <div className="space-y-4">
            {/* Sub-abas para Mobile */}
            <Tabs value={activeSubTab} onValueChange={value => setActiveSubTab(value as GrupoPrincipal)}>
              <TabsList className="grid grid-cols-2 h-10 p-1 bg-card border border-border rounded-lg w/full py-0">
                <TabsTrigger value="Despesa Fixa" className="flex items-center gap-1 text-xs data-[state=active]:bg-muted data-[state=active]:text-destructive px-0 py-[2px]">
                  <Receipt className="h-3 w-3" />
                  Fixas
                </TabsTrigger>
                <TabsTrigger value="Despesa Variável" className="flex items-center gap-1 text-xs data-[state=active]:bg-muted data-[state=active]:text-lunar-warning py-[3px] px-0">
                  <CreditCard className="h-3 w-3" />
                  Variáveis
                </TabsTrigger>
              </TabsList>
              
              <TabsList className="grid grid-cols-2 h-10 p-1 bg-card border border-border rounded-lg w-full py-0 px-[4px]">
                <TabsTrigger value="Investimento" className="flex items-center gap-1 text-xs data-[state=active]:bg-muted data-[state=active]:text-primary px-0 py-[2px]">
                  <TrendingUp className="h-3 w-3" />
                  Investimentos
                </TabsTrigger>
                <TabsTrigger value="Receita Não Operacional" className="flex items-center gap-1 text-xs data-[state=active]:bg-muted data-[state=active]:text-lunar-success py-[2px] px-0">
                  <PiggyBank className="h-3 w-3" />
                  Receitas
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Navegador de Mês/Ano e Botão de Novo Lançamento para Mobile */}
            <div className="flex items-center justify-between gap-3">
              <MonthYearNavigator 
                filtroMesAno={filtroMesAno}
                setFiltroMesAno={setFiltroMesAno}
                size="sm"
                className="flex-1 max-w-64"
              />

              {/* Botão de Novo Lançamento Compacto */}
              <Button 
                onClick={() => setModalNovoLancamentoAberto(true)} 
                className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 px-3" 
                size="sm"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>}
      </div>

      {/* Conteúdo das Sub-abas */}
      <Tabs value={activeSubTab} onValueChange={value => setActiveSubTab(value as GrupoPrincipal)}>
        {GRUPOS_ORDEM.map(grupo => <TabsContent key={grupo} value={grupo} className="mt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-6 rounded bg-primary"></div>
                  <h3 className={`text-lg font-semibold ${infoGrupo.corTema}`}>
                    {infoGrupo.titulo} - {meses[filtroMesAno.mes - 1]} {filtroMesAno.ano}
                  </h3>
                </div>
                
                {/* Navegador de Mês/Ano para Desktop/Tablet */}
                {!isMobile && (
                  <MonthYearNavigator 
                    filtroMesAno={filtroMesAno}
                    setFiltroMesAno={setFiltroMesAno}
                  />
                )}
              </div>

              {isMobile ? <TabelaLancamentosMobile transacoes={transacoesPorGrupo[grupo]} onAtualizarTransacao={atualizarTransacao} onRemoverTransacao={removerTransacao} onMarcarComoPago={marcarComoPago} grupoAtivo={grupo} obterItensPorGrupo={obterItensPorGrupo} /> : <TabelaLancamentos transacoes={transacoesPorGrupo[grupo]} onAtualizarTransacao={atualizarTransacao} onRemoverTransacao={removerTransacao} onMarcarComoPago={marcarComoPago} grupoAtivo={grupo} obterItensPorGrupo={obterItensPorGrupo} onAdicionarTransacao={adicionarTransacao} createTransactionEngine={createTransactionEngine} filtroMesAno={filtroMesAno} />}
            </div>
          </TabsContent>)}
      </Tabs>


      {/* Modal de Novo Lançamento */}
      <ModalNovoLancamentoRefatorado 
        aberto={modalNovoLancamentoAberto} 
        onFechar={() => setModalNovoLancamentoAberto(false)} 
        createTransactionEngine={createTransactionEngine} 
        obterItensPorGrupo={obterItensPorGrupo} 
        grupoAtivo={activeSubTab} 
        tipoLancamento={activeSubTab === 'Receita Não Operacional' ? 'receita' : 'despesa'} 
      />
    </div>;
});

export default LancamentosTab;