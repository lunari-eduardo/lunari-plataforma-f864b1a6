import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import MetricasOrcamento from '@/components/orcamentos/MetricasOrcamento';
import NovoOrcamento from '@/components/orcamentos/NovoOrcamento';
import ListaOrcamentos from '@/components/orcamentos/ListaOrcamentos';
import MonthYearSelector from '@/components/orcamentos/MonthYearSelector';
import LeadsKanban from '@/components/leads/LeadsKanban';
import { ScrollArea } from "@/components/ui/scroll-area";
export default function Orcamentos() {
  const {
    metricas
  } = useOrcamentos();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('lista');
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  // Check for URL parameters when coming from agenda or lead conversion
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const presetDate = searchParams.get('data');
    const presetTime = searchParams.get('hora');
    const presetTab = searchParams.get('tab');

    // If we have preset data from agenda, always go to novo tab
    if (presetDate && presetTime) {
      setActiveTab('novo');
    }

    // If tab is specified in URL (for lead conversion)
    if (presetTab && ['leads', 'lista', 'novo'].includes(presetTab)) {
      setActiveTab(presetTab);
    }
  }, [location.search]);
  return <ScrollArea className="h-[calc(100vh-120px)]">
      <div className="w-full max-w-full mx-auto px-2 sm:px-4 p-2 space-y-4 bg-lunar-bg min-h-screen my-0 py-0">
      <div className="px-2">
        
      </div>

      <MetricasOrcamento selectedMonth={selectedMonth} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 py-0 my-1 border-lunar-accent bg-lunar-surface">
          <TabsTrigger value="leads" className="rounded-sm border-lunar-accent text-sm font-bold">Leads</TabsTrigger>
          <TabsTrigger value="lista" className="rounded-sm border-lunar-accent text-sm font-bold">Orçamentos</TabsTrigger>
          <TabsTrigger value="novo" className="text-sm font-bold">Novo Orçamento</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="mt-4">
          <LeadsKanban />
        </TabsContent>

        <TabsContent value="lista" className="mt-4">
          <MonthYearSelector selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />
          <ListaOrcamentos selectedMonth={selectedMonth} />
        </TabsContent>

        <TabsContent value="novo" className="mt-4">
          <NovoOrcamento />
        </TabsContent>

      </Tabs>
      </div>
    </ScrollArea>;
}