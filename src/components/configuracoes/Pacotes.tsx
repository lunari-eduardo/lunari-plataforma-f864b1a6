import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useDebounce } from '@/hooks/useDebounce';
import PacoteForm from './PacoteForm';
import EditPacoteModal from './EditPacoteModal';

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

interface PacotesProps {
  pacotes: Pacote[];
  setPacotes: React.Dispatch<React.SetStateAction<Pacote[]>>;
  categorias: Categoria[];
  produtos: Produto[];
}

export default function Pacotes({ pacotes, setPacotes, categorias, produtos }: PacotesProps) {
  // Estados para filtros
  const [filtroCategoria, setFiltroCategoria] = useState<string>('');
  const [filtroNome, setFiltroNome] = useState<string>('');
  const [filtroValor, setFiltroValor] = useState<string>('');
  const [editModal, setEditModal] = useState<{ open: boolean; pacote: Pacote | null }>({
    open: false,
    pacote: null
  });

  // Debounce para filtro de nome
  const debouncedFiltroNome = useDebounce(filtroNome, 300);
  const debouncedFiltroValor = useDebounce(filtroValor, 300);

  const formatarMoeda = useCallback((valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  }, []);

  const getNomeCategoria = useCallback((id: string) => {
    const categoria = categorias.find(cat => cat.id === id);
    return categoria ? categoria.nome : 'Categoria não encontrada';
  }, [categorias]);

  const getNomeProduto = useCallback((produtoId: string) => {
    const produto = produtos.find(p => p.id === produtoId);
    return produto ? produto.nome : 'Produto não encontrado';
  }, [produtos]);

  // Lista filtrada de pacotes
  const pacotesFiltrados = useMemo(() => {
    return pacotes.filter(pacote => {
      const matchCategoria = !filtroCategoria || pacote.categoria_id === filtroCategoria;
      const matchNome = !debouncedFiltroNome || 
        pacote.nome.toLowerCase().includes(debouncedFiltroNome.toLowerCase());
      const matchValor = !debouncedFiltroValor || 
        pacote.valor_base.toString().includes(debouncedFiltroValor);
      
      return matchCategoria && matchNome && matchValor;
    });
  }, [pacotes, filtroCategoria, debouncedFiltroNome, debouncedFiltroValor]);

  const adicionarPacote = useCallback((formData: any) => {
    const newId = String(Date.now());
    setPacotes(prev => [...prev, {
      id: newId,
      ...formData
    }]);
    toast.success('Pacote adicionado com sucesso!');
  }, [setPacotes]);

  const iniciarEdicaoPacote = useCallback((pacote: Pacote) => {
    setEditModal({ open: true, pacote });
  }, []);

  const salvarEdicaoPacote = useCallback((id: string, dados: Partial<Pacote>) => {
    setPacotes(prev => prev.map(pacote => pacote.id === id ? {
      ...pacote,
      ...dados
    } : pacote));
  }, [setPacotes]);

  const removerPacote = useCallback((id: string) => {
    setPacotes(prev => prev.filter(pacote => pacote.id !== id));
    toast.success('Pacote removido com sucesso!');
  }, [setPacotes]);

  const limparFiltros = useCallback(() => {
    setFiltroCategoria('');
    setFiltroNome('');
    setFiltroValor('');
  }, []);

  const renderProdutosList = useCallback((produtosIncluidos: ProdutoIncluido[]) => {
    if (!produtosIncluidos || produtosIncluidos.length === 0) {
      return <span className="text-muted-foreground">Nenhum produto</span>;
    }

    const nomesProdutos = produtosIncluidos.map(p => {
      const nome = getNomeProduto(p.produtoId);
      return p.quantidade > 1 ? `${nome} (${p.quantidade}x)` : nome;
    });

    const textoCompleto = nomesProdutos.join(', ');
    const textoTruncado = textoCompleto.length > 40 
      ? `${textoCompleto.substring(0, 37)}...` 
      : textoCompleto;

    if (textoCompleto.length > 40) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help">{textoTruncado}</span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">{textoCompleto}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return <span>{textoCompleto}</span>;
  }, [getNomeProduto]);

  return (
    <div className="mt-4 space-y-6">
      {/* Formulário Novo Pacote */}
      <div>
        <h3 className="text-base font-medium">Novo Pacote Fotográfico</h3>
        <p className="text-sm text-muted-foreground mt-1 mb-3">
          Configure os pacotes fotográficos disponíveis para venda.
        </p>
        
        <PacoteForm
          categorias={categorias}
          produtos={produtos}
          onSubmit={adicionarPacote}
          submitLabel="Adicionar Pacote"
        />
      </div>
      
      {/* Seção Pacotes Cadastrados */}
      <div>
        <div className="space-y-2 mb-4">
          <h3 className="text-base font-medium">Pacotes Cadastrados</h3>
          <p className="text-sm text-muted-foreground">
            Lista de todos os pacotes fotográficos disponíveis.
          </p>
        </div>
        
        {/* Barra de Filtros */}
        <div className="bg-gray-50 p-4 rounded-lg mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4" />
            <span className="text-sm font-medium">Filtros</span>
            <Button
              variant="outline"
              size="sm"
              onClick={limparFiltros}
              className="ml-auto text-xs"
            >
              Limpar Filtros
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Filtrar por Categoria</label>
              <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Todas as categorias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas as categorias</SelectItem>
                  {categorias.map(categoria => (
                    <SelectItem key={categoria.id} value={categoria.id}>
                      {categoria.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block text-xs font-medium mb-1">Filtrar por Nome</label>
              <Input
                placeholder="Digite o nome do pacote..."
                value={filtroNome}
                onChange={(e) => setFiltroNome(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium mb-1">Filtrar por Valor Base</label>
              <Input
                type="number"
                placeholder="Digite o valor..."
                value={filtroValor}
                onChange={(e) => setFiltroValor(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
          
          {(filtroCategoria || debouncedFiltroNome || debouncedFiltroValor) && (
            <div className="mt-2 text-xs text-muted-foreground">
              Mostrando {pacotesFiltrados.length} de {pacotes.length} pacote(s)
            </div>
          )}
        </div>

        {/* Tabela Compacta */}
        <div className="bg-white rounded-lg border border-gray-100 overflow-hidden shadow-sm">
          <div className="grid grid-cols-12 bg-gray-50/50 px-3 py-2 border-b border-gray-100 text-xs font-medium">
            <div className="col-span-2 text-gray-700">Nome</div>
            <div className="col-span-2 text-gray-700">Categoria</div>
            <div className="col-span-2 text-gray-700">Valor Base</div>
            <div className="col-span-2 text-gray-700">Valor Foto Extra</div>
            <div className="col-span-3 text-gray-700">Produtos Incluídos</div>
            <div className="col-span-1 text-right text-gray-700">Ações</div>
          </div>
          
          <div className="divide-y divide-gray-50">
            {pacotesFiltrados.map((pacote, index) => (
              <div 
                key={pacote.id} 
                className={`grid grid-cols-12 px-3 py-2 text-xs ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25/30'} hover:bg-gray-50/70 transition-colors`}
              >
                <div className="col-span-2 font-medium">{pacote.nome}</div>
                <div className="col-span-2 text-muted-foreground">
                  {getNomeCategoria(pacote.categoria_id)}
                </div>
                <div className="col-span-2 font-medium">
                  {formatarMoeda(pacote.valor_base)}
                </div>
                <div className="col-span-2 text-muted-foreground">
                  {formatarMoeda(pacote.valor_foto_extra)}
                </div>
                <div className="col-span-3 text-muted-foreground">
                  {renderProdutosList(pacote.produtosIncluidos)}
                </div>
                <div className="flex justify-end gap-1 col-span-1">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-6 w-6" 
                    onClick={() => iniciarEdicaoPacote(pacote)}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-6 w-6 text-red-500 hover:text-red-600 hover:border-red-200" 
                    onClick={() => removerPacote(pacote.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          
            {pacotesFiltrados.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground bg-white">
                {pacotes.length === 0 
                  ? "Nenhum pacote cadastrado. Adicione seu primeiro pacote acima."
                  : "Nenhum pacote encontrado com os filtros aplicados."
                }
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Edição */}
      <EditPacoteModal
        open={editModal.open}
        onOpenChange={(open) => setEditModal({ open, pacote: open ? editModal.pacote : null })}
        pacote={editModal.pacote}
        categorias={categorias}
        produtos={produtos}
        onSave={salvarEdicaoPacote}
      />
    </div>
  );
}