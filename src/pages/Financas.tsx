import { useState, useMemo, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useNovoFinancas } from '@/hooks/useNovoFinancas';
import DashboardFinanceiro from '@/components/financas/DashboardFinanceiro';
import { Receipt, CreditCard, PiggyBank, Filter } from 'lucide-react';
import { formatCurrency } from '@/utils/financialUtils';
import { mapearTipoParaGrupo, getInfoPorGrupo } from '@/utils/financialGroupUtils';
import MonthYearNavigator from '@/components/shared/MonthYearNavigator';

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
  
  const metricas = useMemo(() => {
    if (activeTab !== 'despesas-receitas') return null;
    const grupo = mapearTipoParaGrupo(activeSubTab) as any;
    return calcularMetricasPorGrupo(grupo);
  }, [activeTab, activeSubTab, calcularMetricasPorGrupo]);
  const infoTipo = useMemo(() => {
    const grupo = mapearTipoParaGrupo(activeSubTab);
    return getInfoPorGrupo(grupo);
  }, [activeSubTab]);
  return <div className="min-h-screen bg-gradient-to-br from-background to-card">
      <div className="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 p-2 sm:p-4 lg:p-6 space-y-4 sm:space-y-6 bg-lunar-bg py-0 my-[3px]">
        {/* Header Simplificado */}
        

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 h-10 p-1 text-sm bg-card border border-border">
            <TabsTrigger value="resumo" className="text-sm py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              Resumo
            </TabsTrigger>
            <TabsTrigger value="despesas-receitas" className="text-sm py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              Despesas
            </TabsTrigger>
            <TabsTrigger value="categorias" className="text-sm py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              Categorias
            </TabsTrigger>
          </TabsList>

          <TabsContent value="resumo" className="mt-6">
            <DashboardFinanceiro />
          </TabsContent>

          <TabsContent value="despesas-receitas" className="mt-6">
            <div className="space-y-6">
              {/* Navegador de Mês - Mobile */}
              <div className="flex justify-center lg:hidden">
                <MonthYearNavigator 
                  filtroMesAno={filtroMesAno}
                  setFiltroMesAno={setFiltroMesAno}
                  size="sm"
                />
              </div>

              {/* Barra de Métricas */}
              {metricas && (
                <div className="bg-card rounded-lg border border-border p-4 shadow-sm">
                  <div className="flex flex-wrap items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">Total:</span>
                      <span className="font-bold text-foreground">{formatCurrency(metricas.total)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-lunar-success rounded-full"></div>
                      <span className="text-muted-foreground">Pago:</span>
                      <span className="font-semibold text-lunar-success">{formatCurrency(metricas.pago)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-lunar-warning rounded-full"></div>
                      <span className="text-muted-foreground">Agendado:</span>
                      <span className="font-semibold text-lunar-warning">{formatCurrency(metricas.agendado)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-abas Simplificadas */}
              <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <TabsList className="flex h-10 p-1 bg-card border border-border rounded-lg">
                      <TabsTrigger value="fixas" className="flex items-center gap-2 text-sm py-2 px-4 data-[state=active]:bg-muted data-[state=active]:text-destructive">
                        <Receipt className="h-4 w-4" />
                        Fixas
                      </TabsTrigger>
                      <TabsTrigger value="variaveis" className="flex items-center gap-2 text-sm py-2 px-4 data-[state=active]:bg-muted data-[state=active]:text-lunar-warning">
                        <CreditCard className="h-4 w-4" />
                        Variáveis
                      </TabsTrigger>
                      <TabsTrigger value="receitas" className="flex items-center gap-2 text-sm py-2 px-4 data-[state=active]:bg-muted data-[state=active]:text-lunar-success">
                        <PiggyBank className="h-4 w-4" />
                        Receitas
                      </TabsTrigger>
                    </TabsList>

                    {/* Navegador de Mês para Desktop */}
                    <div className="hidden lg:flex">
                      <MonthYearNavigator 
                        filtroMesAno={filtroMesAno}
                        setFiltroMesAno={setFiltroMesAno}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
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