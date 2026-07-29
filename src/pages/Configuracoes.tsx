import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Box, Workflow, Shapes, DollarSign, ClipboardList, FileSignature } from 'lucide-react';
import { TableSyncStatus } from '@/components/ui/sync-indicator';
import { useRealtimeConfiguration } from '@/hooks/useRealtimeConfiguration';
import { useAccessControl } from '@/hooks/useAccessControl';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { PAGE_TABS_LIST, PAGE_TABS_TRIGGER, PAGE_TABS_CONTENT, PAGE_SCROLL_SHELL } from '@/components/layout/PageTabs';

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
    <div className={PAGE_SCROLL_SHELL}>
      <PageContainer className="py-4 pb-10">
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


        <Tabs value={tabAtiva} onValueChange={setTabAtiva} className="w-full">
              <TabsList className={PAGE_TABS_LIST}>

                <TabsTrigger value="categorias" className={PAGE_TABS_TRIGGER} title="Categorias">
                  <Shapes className="h-4 w-4" />
                  <span className="hidden sm:inline">Categorias</span>
                </TabsTrigger>
                <TabsTrigger value="precificacao" className={PAGE_TABS_TRIGGER} title="Modelos de preço">
                  <DollarSign className="h-4 w-4" />
                  <span className="hidden sm:inline">Modelos de preço</span>
                </TabsTrigger>
                <TabsTrigger value="pacotes" className={PAGE_TABS_TRIGGER} title="Pacotes">
                  <Package className="h-4 w-4" />
                  <span className="hidden sm:inline">Pacotes</span>
                </TabsTrigger>
                <TabsTrigger value="produtos" className={PAGE_TABS_TRIGGER} title="Produtos">
                  <Box className="h-4 w-4" />
                  <span className="hidden sm:inline">Produtos</span>
                </TabsTrigger>
                <TabsTrigger value="fluxo" className={PAGE_TABS_TRIGGER} title="Etapas">
                  <Workflow className="h-4 w-4" />
                  <span className="hidden sm:inline">Etapas</span>
                </TabsTrigger>
                <TabsTrigger value="formularios" className={PAGE_TABS_TRIGGER} title="Formulários">
                  <ClipboardList className="h-4 w-4" />
                  <span className="hidden sm:inline">Formulários</span>
                </TabsTrigger>
                <TabsTrigger value="contratos" className={PAGE_TABS_TRIGGER} title="Contratos">
                  <FileSignature className="h-4 w-4" />
                  <span className="hidden sm:inline">Contratos</span>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="categorias" className={PAGE_TABS_CONTENT}>
                <Categorias 
                  categorias={configuration.categorias}
                  onAdd={configuration.adicionarCategoria}
                  onUpdate={configuration.atualizarCategoria}
                  onDelete={configuration.removerCategoria}
                  pacotes={configuration.pacotes}
                />
              </TabsContent>
              
              <TabsContent value="pacotes" className={PAGE_TABS_CONTENT}>
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
              
              <TabsContent value="produtos" className={PAGE_TABS_CONTENT}>
                <Produtos 
                  pacotes={configuration.pacotes}
                />
              </TabsContent>
              
              <TabsContent value="precificacao" className={PAGE_TABS_CONTENT}>
                <PrecificacaoFotos categorias={configuration.categorias} />
              </TabsContent>
              
              <TabsContent value="fluxo" className={PAGE_TABS_CONTENT}>
                <FluxoTrabalho 
                  etapas={configuration.etapas}
                  onAdd={configuration.adicionarEtapa}
                  onUpdate={configuration.atualizarEtapa}
                  onDelete={configuration.removerEtapa}
                  onMove={configuration.moverEtapa}
                  hasGalleryAccess={hasGaleryAccess}
                />
              </TabsContent>
              
              <TabsContent value="formularios" className={PAGE_TABS_CONTENT}>
                <FormulariosConfig />
              </TabsContent>
              
              <TabsContent value="contratos" className={PAGE_TABS_CONTENT}>
                <ContratosConfig />
              </TabsContent>
            </Tabs>
      </PageContainer>
    </div>
  );
}
