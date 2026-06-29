import { useState, memo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlusSquare, BarChart3, List, Settings, Target } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  LancamentosView,
  DashboardView,
  ExtratoView,
  MetasView,
  ConfiguracoesView,
} from '@/modules/finance/presentation/components';

const NovaFinancas = memo(function NovaFinancas() {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') || 'lancamentos';
  });

  return (
    <ScrollArea className="h-[calc(100vh-120px)]">
      <div className="min-h-screen pr-4">
        <div className="p-2 sm:p-4 lg:p-6 space-y-1 sm:space-y-6 py-0 my-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full h-10 p-1 text-sm bg-card border border-border py-0 grid-cols-5">
              <TabsTrigger value="lancamentos" className="text-sm py-2 data-[state=active]:bg-primary/10 text-foreground flex items-center gap-2">
                <PlusSquare className="h-4 w-4" />
                {!isMobile && 'Lançamentos'}
              </TabsTrigger>
              <TabsTrigger value="dashboard" className="text-sm py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-foreground flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                {!isMobile && 'Dashboard'}
              </TabsTrigger>
              <TabsTrigger value="extrato" className="text-sm py-2 data-[state=active]:bg-primary/10 text-foreground flex items-center gap-2">
                <List className="h-4 w-4" />
                {!isMobile && 'Extrato'}
              </TabsTrigger>
              <TabsTrigger value="metas" className="text-sm py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-foreground flex items-center gap-2">
                <Target className="h-4 w-4" />
                {!isMobile && 'Metas'}
              </TabsTrigger>
              <TabsTrigger value="configuracoes" className="text-sm py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-foreground flex items-center gap-2">
                <Settings className="h-4 w-4" />
                {!isMobile && 'Configurações'}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="lancamentos" className="mt-6"><LancamentosView /></TabsContent>
            <TabsContent value="dashboard" className="mt-6"><DashboardView /></TabsContent>
            <TabsContent value="extrato" className="mt-6"><ExtratoView /></TabsContent>
            <TabsContent value="metas" className="mt-6"><MetasView /></TabsContent>
            <TabsContent value="configuracoes" className="mt-6"><ConfiguracoesView /></TabsContent>
          </Tabs>
        </div>
      </div>
    </ScrollArea>
  );
});

export default NovaFinancas;
