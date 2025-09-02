import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Package, Box, Workflow, Shapes, DollarSign } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { useConfiguration } from '@/hooks/useConfiguration';

// Importação dos componentes de configuração
import Categorias from '@/components/configuracoes/Categorias';
import Pacotes from '@/components/configuracoes/Pacotes';
import Produtos from '@/components/configuracoes/Produtos';
import FluxoTrabalho from '@/components/configuracoes/FluxoTrabalho';
import PrecificacaoFotos from '@/components/configuracoes/PrecificacaoFotos';
export default function Configuracoes() {
  // Hook unificado para todas as configurações
  const configuration = useConfiguration();
  const [tabAtiva, setTabAtiva] = useState('categorias');
  return <ScrollArea className="h-[calc(100vh-120px)]">
      <div className="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 space-y-6">
      <Card className="bg-card border border-border shadow-sm my-[17px]">
        <CardHeader className="pb-3">
          <CardDescription>
            Configure os parâmetros principais de funcionamento do seu sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="my-[8px] py-[6px]">
          <Tabs value={tabAtiva} onValueChange={setTabAtiva} className="w-full">
            <TabsList className="grid grid-cols-5 mb-2">
              <TabsTrigger value="categorias" className="flex items-center gap-1.5">
                <Shapes className="h-4 w-4" />
                <span className="hidden sm:inline">Categorias</span>
              </TabsTrigger>
              <TabsTrigger value="precificacao" className="flex items-center gap-1.5">
                <DollarSign className="h-4 w-4" />
                <span className="hidden sm:inline">Modelos de preço</span>
              </TabsTrigger>
              <TabsTrigger value="pacotes" className="flex items-center gap-1.5">
                <Package className="h-4 w-4" />
                <span className="hidden sm:inline">Pacotes</span>
              </TabsTrigger>
              <TabsTrigger value="produtos" className="flex items-center gap-1.5">
                <Box className="h-4 w-4" />
                <span className="hidden sm:inline">Produtos</span>
              </TabsTrigger>
              <TabsTrigger value="fluxo" className="flex items-center gap-1.5">
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
                produtos={configuration.produtos}
                onAdd={configuration.adicionarProduto}
                onUpdate={configuration.atualizarProduto}
                onDelete={configuration.removerProduto}
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
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      </div>
    </ScrollArea>;
}