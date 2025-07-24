import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Receipt, CreditCard, PiggyBank, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { TransacaoComItem, GrupoPrincipal, NovaTransacaoFinanceira, ItemFinanceiro } from '@/types/financas';
import { formatCurrency } from '@/utils/financialUtils';
import TabelaLancamentos from './TabelaLancamentos';
import TabelaLancamentosMobile from './TabelaLancamentosMobile';
import ModalNovoLancamento from './ModalNovoLancamento';
import { useIsMobile } from '@/hooks/use-mobile';
import { CreateTransactionInput } from '@/services/FinancialEngine';
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
  itensFinanceiros: ItemFinanceiro[];
  adicionarTransacao: (transacao: Omit<NovaTransacaoFinanceira, 'id' | 'userId' | 'criadoEm'>) => void;
  atualizarTransacao: (id: string, dadosAtualizados: Partial<NovaTransacaoFinanceira>) => void;
  removerTransacao: (id: string) => void;
  createTransactionEngine?: (input: CreateTransactionInput) => void;
}
export default function LancamentosTab({
  filtroMesAno,
  setFiltroMesAno,
  transacoesPorGrupo,
  calcularMetricasPorGrupo,
  obterItensPorGrupo,
  itensFinanceiros,
  adicionarTransacao,
  atualizarTransacao,
  removerTransacao,
  createTransactionEngine
}: LancamentosTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<GrupoPrincipal>('Despesa Fixa');
  const [modalNovoLancamentoAberto, setModalNovoLancamentoAberto] = useState(false);
  const isMobile = useIsMobile();
  const metricas = calcularMetricasPorGrupo(activeSubTab);
  const navegarMes = (direcao: 'anterior' | 'proximo') => {
    const novoMes = direcao === 'anterior' ? filtroMesAno.mes - 1 : filtroMesAno.mes + 1;
    if (novoMes < 1) {
      setFiltroMesAno({
        mes: 12,
        ano: filtroMesAno.ano - 1
      });
    } else if (novoMes > 12) {
      setFiltroMesAno({
        mes: 1,
        ano: filtroMesAno.ano + 1
      });
    } else {
      setFiltroMesAno({
        ...filtroMesAno,
        mes: novoMes
      });
    }
  };
  const getInfoPorGrupo = (grupo: GrupoPrincipal) => {
    switch (grupo) {
      case 'Despesa Fixa':
        return {
          cor: 'red',
          icone: Receipt,
          titulo: 'Despesas Fixas'
        };
      case 'Despesa Variável':
        return {
          cor: 'orange',
          icone: CreditCard,
          titulo: 'Despesas Variáveis'
        };
      case 'Investimento':
        return {
          cor: 'purple',
          icone: TrendingUp,
          titulo: 'Investimentos'
        };
      case 'Receita Não Operacional':
        return {
          cor: 'green',
          icone: PiggyBank,
          titulo: 'Receitas Extras'
        };
      default:
        return {
          cor: 'gray',
          icone: Receipt,
          titulo: 'Geral'
        };
    }
  };
  const infoGrupo = getInfoPorGrupo(activeSubTab);
  return <div className="space-y-6">
      {/* Linha 1: Barra de Totais */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-700">Total:</span>
            <span className="font-bold text-gray-900">{formatCurrency(metricas.total)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-gray-600">Pago:</span>
            <span className="font-semibold text-green-600">{formatCurrency(metricas.pago)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            <span className="text-gray-600">Agendado:</span>
            <span className="font-semibold text-yellow-600">{formatCurrency(metricas.agendado)}</span>
          </div>
        </div>
      </div>

      {/* Linha 2: Barra de Controles */}
      <div className="space-y-4">
        {/* Desktop Layout */}
        {!isMobile && <div className="flex items-center justify-between">
            {/* Grupo da Esquerda: Sub-abas */}
            <Tabs value={activeSubTab} onValueChange={value => setActiveSubTab(value as GrupoPrincipal)}>
              <TabsList className="flex h-10 p-1 bg-white border border-gray-200 rounded-lg py-0 px-0">
                <TabsTrigger value="Despesa Fixa" className="flex items-center gap-2 px-4 data-[state=active]:bg-gray-50 data-[state=active]:text-red-600 py-[7px] text-xs">
                  <Receipt className="h-4 w-4" />
                  Fixas
                </TabsTrigger>
                <TabsTrigger value="Despesa Variável" className="flex items-center gap-2 px-4 data-[state=active]:bg-gray-50 data-[state=active]:text-orange-600 py-[5px] text-xs">
                  <CreditCard className="h-4 w-4" />
                  Variáveis
                </TabsTrigger>
                <TabsTrigger value="Investimento" className="flex items-center gap-2 px-4 data-[state=active]:bg-gray-50 data-[state=active]:text-purple-600 py-[5px] text-xs">
                  <TrendingUp className="h-4 w-4" />
                  Investimentos
                </TabsTrigger>
                <TabsTrigger value="Receita Não Operacional" className="flex items-center gap-2 px-4 data-[state=active]:bg-gray-50 data-[state=active]:text-green-600 py-[5px] text-xs">
                  <PiggyBank className="h-4 w-4" />
                  Receitas
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Grupo Central: Seletor de Mês/Ano */}
            <div className="flex items-center bg-white rounded-lg border border-gray-200 p-2 shadow-sm py-[2px] px-0">
              <Button variant="ghost" size="sm" onClick={() => navegarMes('anterior')} className="h-8 w-8 p-0">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center gap-2 px-[1px]">
                <Select value={filtroMesAno.mes.toString()} onValueChange={value => setFiltroMesAno({
              ...filtroMesAno,
              mes: parseInt(value)
            })}>
                  <SelectTrigger className="w-20 h-8 text-sm border-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {meses.map((mes, index) => <SelectItem key={index} value={(index + 1).toString()} className="text-sm">
                        {mes}
                      </SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={filtroMesAno.ano.toString()} onValueChange={value => setFiltroMesAno({
              ...filtroMesAno,
              ano: parseInt(value)
            })}>
                  <SelectTrigger className="w-20 h-8 text-sm border-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2023, 2024, 2025, 2026].map(ano => <SelectItem key={ano} value={ano.toString()} className="text-sm">
                        {ano}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <Button variant="ghost" size="sm" onClick={() => navegarMes('proximo')} className="h-8 w-8 p-0">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Grupo da Direita: Botão Novo Lançamento */}
            <Button onClick={() => setModalNovoLancamentoAberto(true)} className="bg-blue-600 hover:bg-blue-700 text-white text-xs py-0">
              <Plus className="h-4 w-4 mr-2" />
              Novo Lançamento
            </Button>
          </div>}

        {/* Mobile Layout */}
        {isMobile && <div className="space-y-4">
            {/* Sub-abas para Mobile */}
            <Tabs value={activeSubTab} onValueChange={value => setActiveSubTab(value as GrupoPrincipal)}>
              <TabsList className="grid grid-cols-2 h-10 p-1 bg-white border border-gray-200 rounded-lg w-full py-0">
                <TabsTrigger value="Despesa Fixa" className="flex items-center gap-1 text-xs data-[state=active]:bg-gray-50 data-[state=active]:text-red-600 px-0 py-[2px]">
                  <Receipt className="h-3 w-3" />
                  Fixas
                </TabsTrigger>
                <TabsTrigger value="Despesa Variável" className="flex items-center gap-1 text-xs data-[state=active]:bg-gray-50 data-[state=active]:text-orange-600 py-[3px] px-0">
                  <CreditCard className="h-3 w-3" />
                  Variáveis
                </TabsTrigger>
              </TabsList>
              
              <TabsList className="grid grid-cols-2 h-10 p-1 bg-white border border-gray-200 rounded-lg w-full py-0 px-[4px]">
                <TabsTrigger value="Investimento" className="flex items-center gap-1 text-xs data-[state=active]:bg-gray-50 data-[state=active]:text-purple-600 px-0 py-[2px]">
                  <TrendingUp className="h-3 w-3" />
                  Investimentos
                </TabsTrigger>
                <TabsTrigger value="Receita Não Operacional" className="flex items-center gap-1 text-xs data-[state=active]:bg-gray-50 data-[state=active]:text-green-600 py-[2px] px-0">
                  <PiggyBank className="h-3 w-3" />
                  Receitas
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Seletor de Mês/Ano Centralizado para Mobile */}
            <div className="flex justify-center">
              <div className="flex items-center bg-white rounded-lg border border-gray-200 p-2 shadow-sm py-[2px] px-px">
                <Button variant="ghost" size="sm" onClick={() => navegarMes('anterior')} className="h-8 w-8 p-0">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <div className="flex items-center gap-2 px-4">
                  <Select value={filtroMesAno.mes.toString()} onValueChange={value => setFiltroMesAno({
                ...filtroMesAno,
                mes: parseInt(value)
              })}>
                    <SelectTrigger className="w-20 h-8 text-sm border-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {meses.map((mes, index) => <SelectItem key={index} value={(index + 1).toString()} className="text-sm">
                          {mes}
                        </SelectItem>)}
                    </SelectContent>
                  </Select>

                  <Select value={filtroMesAno.ano.toString()} onValueChange={value => setFiltroMesAno({
                ...filtroMesAno,
                ano: parseInt(value)
              })}>
                    <SelectTrigger className="w-20 h-8 text-sm border-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2023, 2024, 2025, 2026].map(ano => <SelectItem key={ano} value={ano.toString()} className="text-sm">
                          {ano}
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <Button variant="ghost" size="sm" onClick={() => navegarMes('proximo')} className="h-8 w-8 p-0">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>}
      </div>

      {/* Conteúdo das Sub-abas */}
      <Tabs value={activeSubTab} onValueChange={value => setActiveSubTab(value as GrupoPrincipal)}>
        {(['Despesa Fixa', 'Despesa Variável', 'Investimento', 'Receita Não Operacional'] as GrupoPrincipal[]).map(grupo => <TabsContent key={grupo} value={grupo} className="mt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-1 h-6 bg-${infoGrupo.cor}-500 rounded`}></div>
                  <h3 className={`text-lg font-semibold text-${infoGrupo.cor}-600`}>
                    {infoGrupo.titulo} - {meses[filtroMesAno.mes - 1]} {filtroMesAno.ano}
                  </h3>
                </div>
              </div>

              {isMobile ? <TabelaLancamentosMobile transacoes={transacoesPorGrupo[grupo]} onAtualizarTransacao={atualizarTransacao} onRemoverTransacao={removerTransacao} grupoAtivo={grupo} obterItensPorGrupo={obterItensPorGrupo} /> : <TabelaLancamentos transacoes={transacoesPorGrupo[grupo]} onAtualizarTransacao={atualizarTransacao} onRemoverTransacao={removerTransacao} grupoAtivo={grupo} obterItensPorGrupo={obterItensPorGrupo} onAdicionarTransacao={adicionarTransacao} createTransactionEngine={createTransactionEngine} />}
            </div>
          </TabsContent>)}
      </Tabs>

      {/* Floating Action Button para Mobile */}
      {isMobile && <Button onClick={() => setModalNovoLancamentoAberto(true)} className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg z-50" size="icon">
          <Plus className="h-6 w-6" />
        </Button>}

      {/* Modal de Novo Lançamento */}
      <ModalNovoLancamento 
        open={modalNovoLancamentoAberto} 
        onClose={() => setModalNovoLancamentoAberto(false)} 
        itensFinanceiros={itensFinanceiros} 
        onTransacaoCriada={() => {
          // Recarregar dados após criação
          window.location.reload();
        }}
        grupoAtivo={activeSubTab} 
        tipoLancamento={activeSubTab === 'Receita Não Operacional' ? 'receita' : 'despesa'}
      />
    </div>;
}