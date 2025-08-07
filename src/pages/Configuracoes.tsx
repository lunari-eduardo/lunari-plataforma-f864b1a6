import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Package, Box, Workflow, Shapes, DollarSign } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import { saveConfigWithNotification } from '@/utils/configNotification';

// Importação dos componentes de configuração
import Categorias from '@/components/configuracoes/Categorias';
import Pacotes from '@/components/configuracoes/Pacotes';
import Produtos from '@/components/configuracoes/Produtos';
import FluxoTrabalho from '@/components/configuracoes/FluxoTrabalho';
import PrecificacaoFotos from '@/components/configuracoes/PrecificacaoFotos';

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

  // Efeitos para salvar automaticamente no localStorage COM NOTIFICAÇÃO
  useEffect(() => {
    saveConfigWithNotification('configuracoes_categorias', categorias);
  }, [categorias]);
  useEffect(() => {
    saveConfigWithNotification('configuracoes_pacotes', pacotes);
  }, [pacotes]);
  useEffect(() => {
    saveConfigWithNotification('configuracoes_produtos', produtos);
  }, [produtos]);
  return <ScrollArea className="h-[calc(100vh-120px)] bg-card ">
      
    </ScrollArea>;
}