import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNovoFinancas } from '@/hooks/useNovoFinancas';
import DashboardFinanceiro from '@/components/financas/DashboardFinanceiro';
import IndicadoresFinanceiros from '@/components/financas/IndicadoresFinanceiros';
import TabelaTransacoesInline from '@/components/financas/TabelaTransacoesInline';
import GerenciarCategorias from '@/components/financas/GerenciarCategorias';
import { ChevronLeft, ChevronRight, Receipt, CreditCard, PiggyBank, Filter } from 'lucide-react';
import { formatCurrency } from '@/utils/financialUtils';
const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
export default function Financas() {
  const {
    transacoes,
    transacoesPorGrupo,
    resumoFinanceiro,
    filtroMesAno,
    setFiltroMesAno,
    createTransactionEngine,
    adicionarTransacao,
    atualizarTransacao,
    removerTransacao,
    calcularMetricasPorGrupo,
    obterItensPorGrupo
  } = useNovoFinancas();
  const [activeTab, setActiveTab] = useState('resumo');
  const [activeSubTab, setActiveSubTab] = useState('fixas');
  const navegarMes = (direcao: 'anterior' | 'proximo') => {
    const novoMes = direcao === 'anterior' ? filtroMesAno.mes - 1 : filtroMesAno.mes + 1;
    if (novoMes < 1) {
      setFiltroMesAno({
        ...filtroMesAno,
        mes: 12,
        ano: filtroMesAno.ano - 1
      });
    } else if (novoMes > 12) {
      setFiltroMesAno({
        ...filtroMesAno,
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
  const mapearTipoParaGrupo = (tipo: string) => {
    switch (tipo) {
      case 'fixas': return 'Despesa Fixa';
      case 'variaveis': return 'Despesa Variável';
      case 'receitas': return 'Receita Não Operacional';
      default: return 'Despesa Variável';
    }
  };
  
  const getMetricasAtivas = () => {
    if (activeTab !== 'despesas-receitas') return null;
    const grupo = mapearTipoParaGrupo(activeSubTab) as any;
    return calcularMetricasPorGrupo(grupo);
  };
  const metricas = getMetricasAtivas();
  const getInfoPorTipo = (tipo: string) => {
    switch (tipo) {
      case 'fixas':
        return {
          cor: 'red',
          icone: Receipt,
          titulo: 'Fixas'
        };
      case 'variaveis':
        return {
          cor: 'orange',
          icone: CreditCard,
          titulo: 'Variáveis'
        };
      case 'receitas':
        return {
          cor: 'green',
          icone: PiggyBank,
          titulo: 'Receitas'
        };
      default:
        return {
          cor: 'gray',
          icone: Receipt,
          titulo: 'Geral'
        };
    }
  };
  const infoTipo = getInfoPorTipo(activeSubTab);
  return <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <div className="p-2 sm:p-4 lg:p-6 space-y-4 sm:space-y-6 bg-lunar-bg py-0 my-[3px]">
        {/* Header Simplificado */}
        

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 h-10 p-1 text-sm bg-white border border-gray-200">
            <TabsTrigger value="resumo" className="text-sm py-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-b-2 data-[state=active]:border-blue-500">
              Resumo
            </TabsTrigger>
            <TabsTrigger value="despesas-receitas" className="text-sm py-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-b-2 data-[state=active]:border-blue-500">
              Despesas
            </TabsTrigger>
            <TabsTrigger value="categorias" className="text-sm py-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-b-2 data-[state=active]:border-blue-500">
              Categorias
            </TabsTrigger>
          </TabsList>

          <TabsContent value="resumo" className="mt-6">
            <DashboardFinanceiro />
          </TabsContent>

          <TabsContent value="despesas-receitas" className="mt-6">
            <div className="space-y-6">
              {/* Seletor de Mês Centralizado */}
              <div className="flex justify-center">
                <div className="flex items-center bg-white rounded-lg border border-gray-200 p-2 shadow-sm">
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

              {/* Barra de Totais Atualizada (sem "faturado") */}
              {metricas && <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
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
                </div>}

              {/* Sub-abas Simplificadas */}
              <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
                <div className="flex items-center justify-between">
                  <TabsList className="flex h-10 p-1 bg-white border border-gray-200 rounded-lg">
                    <TabsTrigger value="fixas" className="flex items-center gap-2 text-sm py-2 px-4 data-[state=active]:bg-gray-50 data-[state=active]:text-red-600 data-[state=active]:border-b-2 data-[state=active]:border-red-500">
                      <Receipt className="h-4 w-4" />
                      Fixas
                    </TabsTrigger>
                    <TabsTrigger value="variaveis" className="flex items-center gap-2 text-sm py-2 px-4 data-[state=active]:bg-gray-50 data-[state=active]:text-orange-600 data-[state=active]:border-b-2 data-[state=active]:border-orange-500">
                      <CreditCard className="h-4 w-4" />
                      Variáveis
                    </TabsTrigger>
                    <TabsTrigger value="receitas" className="flex items-center gap-2 text-sm py-2 px-4 data-[state=active]:bg-gray-50 data-[state=active]:text-green-600 data-[state=active]:border-b-2 data-[state=active]:border-green-500">
                      <PiggyBank className="h-4 w-4" />
                      Receitas
                    </TabsTrigger>
                  </TabsList>

                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => createTransactionEngine({
                        valorTotal: 100,
                        dataPrimeiraOcorrencia: '2025-07-16',
                        itemId: '1',
                        observacoes: 'Teste Motor',
                        isRecorrente: false,
                        isParcelado: false
                      })}
                      className="flex items-center gap-2"
                    >
                      Teste Motor
                    </Button>
                    <Button variant="outline" size="sm" className="flex items-center gap-2">
                      <Filter className="h-4 w-4" />
                      Filtros
                    </Button>
                  </div>
                </div>

                <TabsContent value="fixas" className="mt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-6 bg-red-500 rounded"></div>
                        <h3 className="text-lg font-semibold text-red-600">
                          Despesas Fixas - {meses[filtroMesAno.mes - 1]} {filtroMesAno.ano}
                        </h3>
                      </div>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="text-center text-gray-500">
                        Tabela de Despesas Fixas - Nova Arquitetura
                        <div className="mt-2 text-sm">
                          {transacoesPorGrupo['Despesa Fixa'].length} transações encontradas
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="variaveis" className="mt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-6 bg-orange-500 rounded"></div>
                        <h3 className="text-lg font-semibold text-orange-600">
                          Despesas Variáveis - {meses[filtroMesAno.mes - 1]} {filtroMesAno.ano}
                        </h3>
                      </div>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="text-center text-gray-500">
                        Tabela de Despesas Variáveis - Nova Arquitetura
                        <div className="mt-2 text-sm">
                          {transacoesPorGrupo['Despesa Variável'].length} transações encontradas
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="receitas" className="mt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-6 bg-green-500 rounded"></div>
                        <h3 className="text-lg font-semibold text-green-600">
                          Receitas Extras - {meses[filtroMesAno.mes - 1]} {filtroMesAno.ano}
                        </h3>
                      </div>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="text-center text-gray-500">
                        Tabela de Receitas Não Operacionais - Nova Arquitetura
                        <div className="mt-2 text-sm">
                          {transacoesPorGrupo['Receita Não Operacional'].length} transações encontradas
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </TabsContent>

          <TabsContent value="categorias" className="mt-6">
            <div className="text-center text-gray-500 py-8">
              Gerenciamento de categorias será implementado na nova arquitetura
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>;
}