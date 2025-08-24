import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Receipt, CreditCard, PiggyBank, TrendingUp } from 'lucide-react';
import { useNovoFinancas } from '@/hooks/useNovoFinancas';
import { formatCurrency } from '@/utils/financialUtils';
import { ScrollArea } from "@/components/ui/scroll-area";
import LancamentosTab from '@/components/financas/LancamentosTab';
import ConfiguracoesFinanceirasTab from '@/components/financas/ConfiguracoesFinanceirasTab';
import DashboardFinanceiro from '@/components/financas/DashboardFinanceiro';
import ExportFinancialPDF from '@/components/financas/ExportFinancialPDF';

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
    marcarComoPago,
    createTransactionEngine,
    itensFinanceiros,
    cartoes,
    adicionarCartao,
    atualizarCartao,
    removerCartao
  } = useNovoFinancas();
  const [activeTab, setActiveTab] = useState('lancamentos');
  return <ScrollArea className="h-[calc(100vh-120px)]">
      <div className="min-h-screen bg-lunar-bg pr-4">
        <div className="p-2 sm:p-4 lg:p-6 space-y-2 sm:space-y-6 bg-lunar-bg py-0">
        {/* Header */}
        

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Finanças</h1>
          <ExportFinancialPDF variant="dropdown" />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 h-10 p-1 text-sm bg-card border border-border py-0">
            <TabsTrigger value="lancamentos" className="text-sm py-2 data-[state=active]:bg-primary/10 text-foreground">
              Lançamentos
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="text-sm py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-foreground">
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="configuracoes" className="text-sm py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-foreground">
              Configurações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lancamentos" className="mt-6">
            <LancamentosTab filtroMesAno={filtroMesAno} setFiltroMesAno={setFiltroMesAno} transacoesPorGrupo={transacoesPorGrupo} resumoFinanceiro={resumoFinanceiro} calcularMetricasPorGrupo={calcularMetricasPorGrupo} obterItensPorGrupo={obterItensPorGrupo} adicionarTransacao={adicionarTransacao} atualizarTransacao={atualizarTransacaoCompativel} removerTransacao={removerTransacao} marcarComoPago={marcarComoPago} createTransactionEngine={createTransactionEngine} />
          </TabsContent>


          <TabsContent value="dashboard" className="mt-6">
            <DashboardFinanceiro />
          </TabsContent>

          <TabsContent value="configuracoes" className="mt-6">
            <ConfiguracoesFinanceirasTab itensFinanceiros={itensFinanceiros} adicionarItemFinanceiro={adicionarItemFinanceiro} removerItemFinanceiro={removerItemFinanceiro} atualizarItemFinanceiro={atualizarItemFinanceiro} />
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </ScrollArea>;
}