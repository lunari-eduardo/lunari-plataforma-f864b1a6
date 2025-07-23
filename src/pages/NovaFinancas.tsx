import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Receipt, CreditCard, PiggyBank, TrendingUp } from 'lucide-react';
import { useNovoFinancas } from '@/hooks/useNovoFinancas';
import { formatCurrency } from '@/utils/financialUtils';
import LancamentosTab from '@/components/financas/LancamentosTab';
import ConfiguracoesFinanceirasTab from '@/components/financas/ConfiguracoesFinanceirasTab';
import DashboardFinanceiro from '@/components/financas/DashboardFinanceiro';
export default function NovaFinancas() {
  const {
    filtroMesAno,
    setFiltroMesAno,
    transacoesPorGrupo,
    resumoFinanceiro,
    calcularMetricasPorGrupo,
    // Funções que serão passadas para os componentes filhos
    adicionarItemFinanceiro,
    removerItemFinanceiro,
    atualizarItemFinanceiro,
    obterItensPorGrupo,
    adicionarTransacao,
    atualizarTransacao,
    atualizarTransacaoCompativel,
    removerTransacao,
    createTransactionEngine,
    itensFinanceiros,
    cartoes,
    adicionarCartao,
    atualizarCartao,
    removerCartao
  } = useNovoFinancas();
  const [activeTab, setActiveTab] = useState('lancamentos');
  return <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white bg-lunar-bg">
      <div className="p-2 sm:p-4 lg:p-6 space-y-4 sm:space-y-6 bg-lunar-bg">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Finanças</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 h-10 p-1 text-sm bg-white border border-gray-200 py-0">
            <TabsTrigger value="lancamentos" className="text-sm py-2 data-[state=active]:bg-blue-50 text-stone-700">
              Lançamentos
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="text-sm py-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="configuracoes" className="text-sm py-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
              Configurações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lancamentos" className="mt-6">
            <LancamentosTab filtroMesAno={filtroMesAno} setFiltroMesAno={setFiltroMesAno} transacoesPorGrupo={transacoesPorGrupo} resumoFinanceiro={resumoFinanceiro} calcularMetricasPorGrupo={calcularMetricasPorGrupo} obterItensPorGrupo={obterItensPorGrupo} adicionarTransacao={adicionarTransacao} atualizarTransacao={atualizarTransacaoCompativel} removerTransacao={removerTransacao} createTransactionEngine={createTransactionEngine} />
          </TabsContent>

          <TabsContent value="dashboard" className="mt-6">
            <DashboardFinanceiro />
          </TabsContent>

          <TabsContent value="configuracoes" className="mt-6">
            <ConfiguracoesFinanceirasTab 
              itensFinanceiros={itensFinanceiros} 
              adicionarItemFinanceiro={adicionarItemFinanceiro} 
              removerItemFinanceiro={removerItemFinanceiro} 
              atualizarItemFinanceiro={atualizarItemFinanceiro}
              cartoes={cartoes}
              onCartoesChange={(novoCartoes) => {
                // The ConfiguracaoCartoes component manages its own state
                // This callback is used for direct updates from the component
                const cartoesAtuais = [...cartoes];
                cartoesAtuais.splice(0, cartoesAtuais.length, ...novoCartoes);
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>;
}