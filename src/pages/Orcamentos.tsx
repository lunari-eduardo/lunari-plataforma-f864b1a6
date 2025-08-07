import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import MetricasOrcamento from '@/components/orcamentos/MetricasOrcamento';
import NovoOrcamento from '@/components/orcamentos/NovoOrcamento';
import ListaOrcamentos from '@/components/orcamentos/ListaOrcamentos';
import MonthYearSelector from '@/components/orcamentos/MonthYearSelector';
import { ScrollArea } from "@/components/ui/scroll-area";
export default function Orcamentos() {
  const {
    metricas
  } = useOrcamentos();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('lista');
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  // Check for URL parameters when coming from agenda
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const presetDate = searchParams.get('data');
    const presetTime = searchParams.get('hora');

    // If we have preset data from agenda, always go to novo tab
    if (presetDate && presetTime) {
      setActiveTab('novo');
    }
  }, [location.search]);
  return <ScrollArea className="h-[calc(100vh-120px)]">
      <div className="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 p-2 sm:p-4 space-y-4 bg-lunar-bg min-h-screen my-0 py-[33px]">
      <div className="px-2">
        
      </div>

      <MetricasOrcamento selectedMonth={selectedMonth} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 py-0 my-1 border-lunar-accent bg-lunar-surface">
          <TabsTrigger value="lista" className="rounded-sm border-lunar-accent">Orçamentos</TabsTrigger>
          <TabsTrigger value="novo">Novo Orçamento</TabsTrigger>
        </TabsList>

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