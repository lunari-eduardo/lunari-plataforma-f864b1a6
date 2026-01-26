import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Package, Box, Workflow, Shapes, DollarSign } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { TableSyncStatus } from '@/components/ui/sync-indicator';
import { useRealtimeConfiguration } from '@/hooks/useRealtimeConfiguration';
import { useAccessControl } from '@/hooks/useAccessControl';

import Categorias from '@/components/configuracoes/Categorias';
import Pacotes from '@/components/configuracoes/Pacotes';
import Produtos from '@/components/configuracoes/Produtos';
import FluxoTrabalho from '@/components/configuracoes/FluxoTrabalho';
import PrecificacaoFotos from '@/components/configuracoes/PrecificacaoFotos';

export default function Configuracoes() {
  const configuration = useRealtimeConfiguration();
  const { hasGaleryAccess } = useAccessControl();
  const [tabAtiva, setTabAtiva] = useState('categorias');
  
  return (
    <ScrollArea className="h-[calc(100vh-120px)]">
      <div className="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6">
        {/* Header da página */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Configurações</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure os parâmetros principais do seu sistema.
            </p>
          </div>
          <TableSyncStatus 
            categoriasSyncing={configuration.isLoadingCategorias}
            pacotesSyncing={configuration.isLoadingPacotes}
            produtosSyncing={configuration.isLoadingProdutos}
            etapasSyncing={configuration.isLoadingEtapas}
          />
        </div>

        {/* Card com Tabs */}
        <Card className="border border-border">
          <CardContent className="p-6">
            <Tabs value={tabAtiva} onValueChange={setTabAtiva} className="w-full">
              <TabsList className="w-full justify-start border-b border-border mb-4">
                <TabsTrigger value="categorias" className="flex items-center gap-2">
                  <Shapes className="h-4 w-4" />
                  <span className="hidden sm:inline">Categorias</span>
                </TabsTrigger>
                <TabsTrigger value="precificacao" className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  <span className="hidden sm:inline">Modelos de preço</span>
                </TabsTrigger>
                <TabsTrigger value="pacotes" className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  <span className="hidden sm:inline">Pacotes</span>
                </TabsTrigger>
                <TabsTrigger value="produtos" className="flex items-center gap-2">
                  <Box className="h-4 w-4" />
                  <span className="hidden sm:inline">Produtos</span>
                </TabsTrigger>
                <TabsTrigger value="fluxo" className="flex items-center gap-2">
                  <Workflow className="h-4 w-4" />
                  <span className="hidden sm:inline">Etapas</span>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="categorias">
                <Categorias 
                  categorias={configuration.categorias}
                  onAdd={configuration.adicionarCategoria}
                  onUpdate={configuration.atualizarCategoria}
                  onDelete={configuration.removerCategoria}
                  pacotes={configuration.pacotes}
                />
              </TabsContent>
              
              <TabsContent value="pacotes">
                <Pacotes 
                  pacotes={configuration.pacotes}
                  onAdd={configuration.adicionarPacote}
                  onUpdate={configuration.atualizarPacote}
                  onDelete={configuration.removerPacote}
                  categorias={configuration.categorias}
                  produtos={configuration.produtos}
                />
              </TabsContent>
              
              <TabsContent value="produtos">
                <Produtos 
                  pacotes={configuration.pacotes}
                />
              </TabsContent>
              
              <TabsContent value="precificacao">
                <PrecificacaoFotos categorias={configuration.categorias} />
              </TabsContent>
              
              <TabsContent value="fluxo">
                <FluxoTrabalho 
                  etapas={configuration.etapas}
                  onAdd={configuration.adicionarEtapa}
                  onUpdate={configuration.atualizarEtapa}
                  onDelete={configuration.removerEtapa}
                  onMove={configuration.moverEtapa}
                  hasGalleryAccess={hasGaleryAccess}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
