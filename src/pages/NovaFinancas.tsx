import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Receipt, CreditCard, PiggyBank, TrendingUp, FileText } from 'lucide-react';
import { useNovoFinancas } from '@/hooks/useNovoFinancas';
import { formatCurrency } from '@/utils/financialUtils';
import { ScrollArea } from "@/components/ui/scroll-area";
import LancamentosTab from '@/components/financas/LancamentosTab';
import ConfiguracoesFinanceirasTab from '@/components/financas/ConfiguracoesFinanceirasTab';
import DashboardFinanceiro from '@/components/financas/DashboardFinanceiro';
import ExportFinancialPDF from '@/components/financas/ExportFinancialPDF';
import ExtratoTab from '@/components/financas/ExtratoTab';
import DRETab from '@/components/financas/DRETab';
import { DREConfig } from '@/types/dre';

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
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') || 'extrato';
  });

  // Verificar se é MEI para ocultar aba DRE
  const [dreConfig, setDreConfig] = useState<DREConfig | null>(null);
  
  useEffect(() => {
    const loadDREConfig = () => {
      try {
        const saved = localStorage.getItem('dre_config_v1');
        if (saved) {
          const parsed = JSON.parse(saved);
          setDreConfig(parsed);
        } else {
          // Padrão MEI
          setDreConfig({ regimeTributario: 'MEI' } as DREConfig);
        }
      } catch (error) {
        console.error('Erro ao carregar config DRE:', error);
        setDreConfig({ regimeTributario: 'MEI' } as DREConfig);
      }
    };

    loadDREConfig();
    
    // Escutar mudanças na configuração DRE
    const handleStorageChange = () => loadDREConfig();
    window.addEventListener('storage', handleStorageChange);
    
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const isMEI = dreConfig?.regimeTributario === 'MEI';

  // Escutar eventos de drill-down do DRE
  useEffect(() => {
    const handleDrillDown = (event: CustomEvent) => {
      const { tab, filters } = event.detail;
      if (tab) {
        setActiveTab(tab);
        // TODO: Aplicar filtros no Extrato quando implementado
        console.log('DRE Drill-down:', { tab, filters });
      }
    };

    window.addEventListener('dre-drill-down', handleDrillDown as EventListener);
    return () => window.removeEventListener('dre-drill-down', handleDrillDown as EventListener);
  }, []);
  return <ScrollArea className="h-[calc(100vh-120px)]">
      <div className="min-h-screen bg-lunar-bg pr-4">
        <div className="p-2 sm:p-4 lg:p-6 space-y-2 sm:space-y-6 bg-lunar-bg py-0">
        {/* Header */}
        

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Finanças</h1>
          <ExportFinancialPDF variant="dropdown" />
        </div>

        <Tabs value={activeTab} onValueChange={(value) => {
          // Se tentar acessar DRE sendo MEI, redirecionar para extrato
          if (value === 'dre' && isMEI) {
            setActiveTab('extrato');
            return;
          }
          setActiveTab(value);
        }}>
          <TabsList className={`grid w-full h-10 p-1 text-sm bg-card border border-border py-0 ${isMEI ? 'grid-cols-4' : 'grid-cols-5'}`}>
            <TabsTrigger value="extrato" className="text-sm py-2 data-[state=active]:bg-primary/10 text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Extrato
            </TabsTrigger>
            {!isMEI && (
              <TabsTrigger value="dre" className="text-sm py-2 data-[state=active]:bg-primary/10 text-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                DRE
              </TabsTrigger>
            )}
            <TabsTrigger value="lancamentos" className="text-sm py-2 data-[state=active]:bg-primary/10 text-foreground flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Lançamentos
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="text-sm py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-foreground flex items-center gap-2">
              <PiggyBank className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="configuracoes" className="text-sm py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-foreground flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Configurações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="extrato" className="mt-6">
            <ExtratoTab />
          </TabsContent>

          {!isMEI && (
            <TabsContent value="dre" className="mt-6">
              <DRETab />
            </TabsContent>
          )}

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