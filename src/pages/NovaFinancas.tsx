import { useState, memo, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutDashboard, ArrowLeftRight, SlidersHorizontal } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  DashboardView,
  ConfiguracoesView,
} from '@/modules/finance/presentation/components';
import FluxoFinanceiroView from '@/modules/finance/presentation/fluxo/FluxoFinanceiroView';
import FinanceHeader from '@/modules/finance/presentation/shell/FinanceHeader';
import LancamentoDrawerProvider, {
  useLancamentoDrawer,
} from '@/modules/finance/presentation/shell/LancamentoDrawerProvider';
import { FINANCE_SWITCH_TAB_EVENT, type FinanceTabName } from '@/modules/finance/presentation/navigation';

type FinanceTab = 'visao-geral' | 'fluxo-financeiro' | 'gerenciar';

function resolveInitialTab(): FinanceTab {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('tab');
  switch (raw) {
    case 'visao-geral':
    case 'dashboard':
      return 'visao-geral';
    case 'fluxo-financeiro':
    case 'lancamentos':
    case 'extrato':
    case 'metas':
      return 'fluxo-financeiro';
    case 'gerenciar':
    case 'configuracoes':
      return 'gerenciar';
    default:
      return 'visao-geral';
  }
}

const NovaFinancasInner = memo(function NovaFinancasInner() {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<FinanceTab>(resolveInitialTab);
  const drawer = useLancamentoDrawer();

  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<FinanceTabName>).detail;
      if (detail === 'visao-geral' || detail === 'fluxo-financeiro' || detail === 'gerenciar') {
        setActiveTab(detail);
      }
    };
    window.addEventListener(FINANCE_SWITCH_TAB_EVENT, handler as EventListener);
    return () => window.removeEventListener(FINANCE_SWITCH_TAB_EVENT, handler as EventListener);
  }, []);

  const triggerClass =
    'relative px-1 sm:px-3 py-3 text-sm font-medium bg-transparent rounded-none text-muted-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:after:content-[""] data-[state=active]:after:absolute data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:-bottom-px data-[state=active]:after:h-[2px] data-[state=active]:after:bg-accent-gold flex items-center justify-center gap-2';

  return (
    <ScrollArea className="h-[calc(100vh-120px)]">
      <div className="min-h-screen bg-background pr-4">
        <div className="p-2 sm:p-4 lg:p-6 space-y-4 sm:space-y-6 py-0 my-0">
          {/* Header global do módulo — botão fixo no canto superior direito */}
          <FinanceHeader onSelectTipo={(tipo) => drawer.open({ tipo })} />

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FinanceTab)}>
            <TabsList className="w-full h-auto p-0 bg-transparent border-b border-border rounded-none justify-start gap-2 sm:gap-6">
              <TabsTrigger value="visao-geral" className={triggerClass}>
                <LayoutDashboard className="h-4 w-4" />
                {!isMobile && 'Visão Geral'}
              </TabsTrigger>
              <TabsTrigger value="fluxo-financeiro" className={triggerClass}>
                <ArrowLeftRight className="h-4 w-4" />
                {!isMobile && 'Fluxo Financeiro'}
              </TabsTrigger>
              <TabsTrigger value="gerenciar" className={triggerClass}>
                <SlidersHorizontal className="h-4 w-4" />
                {!isMobile && 'Gerenciar'}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="visao-geral" className="mt-6">
              <DashboardView />
            </TabsContent>

            <TabsContent value="fluxo-financeiro" className="mt-6">
              <FluxoFinanceiroView />
            </TabsContent>

            <TabsContent value="gerenciar" className="mt-6">
              <ConfiguracoesView />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </ScrollArea>
  );
});

const NovaFinancas = memo(function NovaFinancas() {
  return (
    <LancamentoDrawerProvider>
      <NovaFinancasInner />
    </LancamentoDrawerProvider>
  );
});

export default NovaFinancas;
