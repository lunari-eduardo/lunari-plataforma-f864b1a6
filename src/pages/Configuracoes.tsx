import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Package, Box, Workflow, Shapes, DollarSign, ClipboardList, FileSignature } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { TableSyncStatus } from '@/components/ui/sync-indicator';
import { useRealtimeConfiguration } from '@/hooks/useRealtimeConfiguration';
import { useAccessControl } from '@/hooks/useAccessControl';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';

import Categorias from '@/components/configuracoes/Categorias';
import Pacotes from '@/components/configuracoes/Pacotes';
import Produtos from '@/components/configuracoes/Produtos';
import FluxoTrabalho from '@/components/configuracoes/FluxoTrabalho';
import PrecificacaoFotos from '@/components/configuracoes/PrecificacaoFotos';
import FormulariosConfig from '@/components/configuracoes/FormulariosConfig';
import ContratosConfig from '@/components/configuracoes/ContratosConfig';

export default function Configuracoes() {
  const configuration = useRealtimeConfiguration();
  const { hasGaleryAccess } = useAccessControl();
  const [tabAtiva, setTabAtiva] = useState('categorias');
  
  return (
    <ScrollArea className="h-[calc(100vh-120px)]">
      <PageContainer variant="wide" className="py-4">
        <PageHeader
          title="Configurações"
          description="Configure os parâmetros principais do seu sistema."
          action={
            <TableSyncStatus
              categoriasSyncing={configuration.isLoadingCategorias}
              pacotesSyncing={configuration.isLoadingPacotes}
              produtosSyncing={configuration.isLoadingProdutos}
              etapasSyncing={configuration.isLoadingEtapas}
            />
          }
        />


        {/* Card com Tabs */}
        <Card className="border-border/20 bg-card/60 shadow-sm">
          <CardContent className="p-6">
            <Tabs value={tabAtiva} onValueChange={setTabAtiva} className="w-full">
              <TabsList className="w-full justify-start border-b border-border/20 mb-4 bg-transparent">

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
                <TabsTrigger value="formularios" className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  <span className="hidden sm:inline">Formulários</span>
                </TabsTrigger>
                <TabsTrigger value="contratos" className="flex items-center gap-2">
                  <FileSignature className="h-4 w-4" />
                  <span className="hidden sm:inline">Contratos</span>
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
                  onNavigateToCategorias={() => setTabAtiva('categorias')}
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
              
              <TabsContent value="formularios">
                <FormulariosConfig />
              </TabsContent>
              
              <TabsContent value="contratos">
                <ContratosConfig />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </PageContainer>
    </ScrollArea>
  );
}
