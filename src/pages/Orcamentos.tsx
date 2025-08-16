import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import MetricasOrcamento from '@/components/orcamentos/MetricasOrcamento';
import NovoOrcamento from '@/components/orcamentos/NovoOrcamento';
import ListaOrcamentos from '@/components/orcamentos/ListaOrcamentos';
import MonthYearSelector from '@/components/orcamentos/MonthYearSelector';

export default function Orcamentos() {
  const { metricas } = useOrcamentos();
  const [activeTab, setActiveTab] = useState('lista');
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  return (
    <div className="w-full max-w-full mx-auto px-2 sm:px-4 p-2 space-y-4 bg-lunar-bg min-h-screen my-0 py-0">
      <div className="px-2">
        
      </div>

      <MetricasOrcamento selectedMonth={selectedMonth} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 py-0 my-1 border-lunar-accent bg-lunar-surface">
          <TabsTrigger value="lista" className="rounded-sm border-lunar-accent text-sm font-bold">Orçamentos</TabsTrigger>
          <TabsTrigger value="novo" className="text-sm font-bold">Novo Orçamento</TabsTrigger>
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
  );
}