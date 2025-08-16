import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LeadsKanban from '@/components/leads/LeadsKanban';

export default function Leads() {
  const [activeTab, setActiveTab] = useState('leads');

  return (
    <div className="w-full max-w-full mx-auto px-2 sm:px-4 p-2 space-y-4 bg-lunar-bg min-h-screen my-0 py-0">
      <div className="px-2">
        <h1 className="text-xl font-semibold text-lunar-text mb-4">Gerenciamento de Leads</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 py-0 my-1 border-lunar-accent bg-lunar-surface">
          <TabsTrigger value="leads" className="rounded-sm border-lunar-accent text-sm font-bold">Leads</TabsTrigger>
          <TabsTrigger value="novo" className="text-sm font-bold">Novo Lead</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="mt-4">
          <LeadsKanban />
        </TabsContent>

        <TabsContent value="novo" className="mt-4">
          <div className="bg-lunar-surface rounded-lg p-6">
            <h3 className="text-lg font-semibold text-lunar-text mb-4">Novo Lead</h3>
            <p className="text-lunar-textSecondary">Formulário para criação de novo lead será implementado aqui.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}