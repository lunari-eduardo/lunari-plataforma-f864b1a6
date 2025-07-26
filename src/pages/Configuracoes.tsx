import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Package, Box, Workflow, Shapes } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { storage, STORAGE_KEYS } from '@/utils/localStorage';

// Importação dos componentes de configuração
import Categorias from '@/components/configuracoes/Categorias';
import Pacotes from '@/components/configuracoes/Pacotes';
import Produtos from '@/components/configuracoes/Produtos';
import FluxoTrabalho from '@/components/configuracoes/FluxoTrabalho';

// Types
interface Categoria {
  id: string;
  nome: string;
  cor: string;
}
interface ProdutoIncluido {
  produtoId: string;
  quantidade: number;
}
interface Pacote {
  id: string;
  nome: string;
  categoria_id: string;
  valor_base: number;
  valor_foto_extra: number;
  produtosIncluidos: ProdutoIncluido[];
}
interface Produto {
  id: string;
  nome: string;
  preco_custo: number;
  preco_venda: number;
}
interface EtapaTrabalho {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
}
export default function Configuracoes() {
  // Estados para categorias
  const [categorias, setCategorias] = useState<Categoria[]>(() => {
    const saved = storage.load('configuracoes_categorias', []);
    return saved.length > 0 ? saved : [{
      id: "1",
      nome: "Gestante",
      cor: "#FF9500"
    }, {
      id: "2",
      nome: "Newborn",
      cor: "#34C759"
    }, {
      id: "3",
      nome: "Família",
      cor: "#5856D6"
    }, {
      id: "4",
      nome: "Casamento",
      cor: "#FF2D55"
    }, {
      id: "5",
      nome: "Aniversário",
      cor: "#007AFF"
    }];
  });

  // Estados para pacotes
  const [pacotes, setPacotes] = useState<Pacote[]>(() => {
    const saved = storage.load('configuracoes_pacotes', []);
    return saved.length > 0 ? saved : [{
      id: "1",
      nome: "Básico",
      categoria_id: "3",
      valor_base: 450,
      valor_foto_extra: 25,
      produtosIncluidos: []
    }, {
      id: "2",
      nome: "Completo",
      categoria_id: "1",
      valor_base: 980,
      valor_foto_extra: 35,
      produtosIncluidos: []
    }, {
      id: "3",
      nome: "Empresarial",
      categoria_id: "4",
      valor_base: 890,
      valor_foto_extra: 30,
      produtosIncluidos: []
    }];
  });

  // Estados para produtos
  const [produtos, setProdutos] = useState<Produto[]>(() => {
    const saved = storage.load('configuracoes_produtos', []);
    return saved.length > 0 ? saved : [{
      id: "1",
      nome: "Álbum 20x30",
      preco_custo: 180,
      preco_venda: 350
    }, {
      id: "2",
      nome: "Quadro 30x40",
      preco_custo: 120,
      preco_venda: 280
    }];
  });

  // Estados para etapas de trabalho
  const [etapas, setEtapas] = useState<EtapaTrabalho[]>(() => {
    return storage.load(STORAGE_KEYS.WORKFLOW_STATUS, [{
      id: "1",
      nome: "Fotografado",
      cor: "#00B2FF",
      ordem: 1
    }, {
      id: "2",
      nome: "Editando",
      cor: "#FF9500",
      ordem: 2
    }, {
      id: "3",
      nome: "Finalizado",
      cor: "#34C759",
      ordem: 3
    }]);
  });
  const [tabAtiva, setTabAtiva] = useState('categorias');

  // Efeitos para salvar automaticamente no localStorage
  useEffect(() => {
    storage.save('configuracoes_categorias', categorias);
  }, [categorias]);
  useEffect(() => {
    storage.save('configuracoes_pacotes', pacotes);
  }, [pacotes]);
  useEffect(() => {
    storage.save('configuracoes_produtos', produtos);
  }, [produtos]);
  return (
    <ScrollArea className="h-[calc(100vh-120px)]">
      <div className="space-y-6 pr-4">
      <Card>
        <CardHeader className="pb-3 bg-stone-50">
          <CardDescription>
            Configure os parâmetros principais de funcionamento do seu sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="py-[10px] my-[8px] bg-lunar-surface">
          <Tabs value={tabAtiva} onValueChange={setTabAtiva} className="w-full">
            <TabsList className="grid grid-cols-4 mb-2">
              <TabsTrigger value="categorias" className="flex items-center gap-1.5">
                <Shapes className="h-4 w-4" />
                <span className="hidden sm:inline">Categorias</span>
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
              <Categorias categorias={categorias} setCategorias={setCategorias} pacotes={pacotes} />
            </TabsContent>
            
            <TabsContent value="pacotes">
              <Pacotes pacotes={pacotes} setPacotes={setPacotes} categorias={categorias} produtos={produtos} />
            </TabsContent>
            
            <TabsContent value="produtos">
              <Produtos produtos={produtos} setProdutos={setProdutos} />
            </TabsContent>
            
            <TabsContent value="fluxo">
              <FluxoTrabalho etapas={etapas} setEtapas={setEtapas} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      </div>
    </ScrollArea>
  );
}