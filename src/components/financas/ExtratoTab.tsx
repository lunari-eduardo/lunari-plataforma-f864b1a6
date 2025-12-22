import React from 'react';
import { useExtrato } from '@/hooks/useExtrato';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, Search } from 'lucide-react';
import ExtratoFilters from '@/components/extrato/ExtratoFilters';
import ExtratoSummaryCards from '@/components/extrato/ExtratoSummaryCards';
import ExtratoTable from '@/components/extrato/ExtratoTable';
import DemonstrativoSection from '@/components/extrato/DemonstrativoSection';

export default function ExtratoTab() {
  const {
    linhas,
    resumo,
    demonstrativo,
    filtros,
    paginacao,
    isLoading,
    atualizarFiltros,
    limparFiltros,
    abrirOrigem,
    prepararDadosExportacao
  } = useExtrato();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6">
        <p className="text-muted-foreground">
          Visão unificada de todas as movimentações financeiras
        </p>
      </div>

      {/* Filtros */}
      <ExtratoFilters 
        filtros={filtros}
        onFiltrosChange={atualizarFiltros}
        onLimparFiltros={limparFiltros}
      />

      {/* Cards de Resumo */}
      <ExtratoSummaryCards resumo={resumo} />

      {/* Tabs para alternar entre vista detalhada e demonstrativo */}
      <Tabs defaultValue="detalhado" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="detalhado" className="flex items-center space-x-2">
            <Search className="h-4 w-4" />
            <span>Vista Detalhada</span>
          </TabsTrigger>
          <TabsTrigger value="demonstrativo" className="flex items-center space-x-2">
            <TrendingUp className="h-4 w-4" />
            <span>Demonstrativo</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="detalhado" className="mt-6">
          <ExtratoTable 
            linhas={linhas}
            onAbrirOrigem={abrirOrigem}
            dadosExportacao={prepararDadosExportacao()}
            paginacao={paginacao}
            isLoading={isLoading}
          />
        </TabsContent>
        
        <TabsContent value="demonstrativo" className="mt-6">
          <DemonstrativoSection 
            demonstrativo={demonstrativo} 
            periodo={{
              inicio: filtros.dataInicio,
              fim: filtros.dataFim
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
