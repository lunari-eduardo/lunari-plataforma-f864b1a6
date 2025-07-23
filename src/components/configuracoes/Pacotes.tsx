import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Edit, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
  const [novoPacote, setNovoPacote] = useState({
    nome: '',
    categoria_id: '',
    valor_base: 0,
    valor_foto_extra: 0,
    produtosIncluidos: [] as ProdutoIncluido[]
  });
  const [editandoPacote, setEditandoPacote] = useState<string | null>(null);
  const [openProductSelector, setOpenProductSelector] = useState(false);

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  const getNomeCategoria = (id: string) => {
    const categoria = categorias.find(cat => cat.id === id);
    return categoria ? categoria.nome : 'Categoria não encontrada';
  };

  const adicionarPacote = () => {
    if (novoPacote.nome.trim() === '') {
      toast.error('O nome do pacote não pode estar vazio');
      return;
    }
    if (!novoPacote.categoria_id) {
      toast.error('Selecione uma categoria para o pacote');
      return;
    }
    if (novoPacote.valor_base <= 0) {
      toast.error('O valor base deve ser maior que zero');
      return;
    }
    const newId = String(Date.now());
    setPacotes([...pacotes, {
      id: newId,
      ...novoPacote
    }]);
    setNovoPacote({
      nome: '',
      categoria_id: '',
      valor_base: 0,
      valor_foto_extra: 0,
      produtosIncluidos: []
    });
    toast.success('Pacote adicionado com sucesso!');
  };

  const iniciarEdicaoPacote = (id: string) => {
    setEditandoPacote(id);
  };

  const salvarEdicaoPacote = (id: string, dados: Partial<Pacote>) => {
    setPacotes(pacotes.map(pacote => pacote.id === id ? {
      ...pacote,
      ...dados
    } : pacote));
    setEditandoPacote(null);
    toast.success('Pacote atualizado com sucesso!');
  };

  const removerPacote = (id: string) => {
    setPacotes(pacotes.filter(pacote => pacote.id !== id));
    toast.success('Pacote removido com sucesso!');
  };

  const adicionarProdutoIncluido = (produtoId: string) => {
    const produtoExistente = novoPacote.produtosIncluidos.find(p => p.produtoId === produtoId);
    if (produtoExistente) {
      toast.error('Produto já está incluído no pacote');
      return;
    }
    setNovoPacote({
      ...novoPacote,
      produtosIncluidos: [...novoPacote.produtosIncluidos, { produtoId, quantidade: 1 }]
    });
    setOpenProductSelector(false);
  };

  const removerProdutoIncluido = (produtoId: string) => {
    setNovoPacote({
      ...novoPacote,
      produtosIncluidos: novoPacote.produtosIncluidos.filter(p => p.produtoId !== produtoId)
    });
  };

  const atualizarQuantidadeProduto = (produtoId: string, quantidade: number) => {
    setNovoPacote({
      ...novoPacote,
      produtosIncluidos: novoPacote.produtosIncluidos.map(p => 
        p.produtoId === produtoId ? { ...p, quantidade } : p
      )
    });
  };

  const getNomeProduto = (produtoId: string) => {
    const produto = produtos.find(p => p.id === produtoId);
    return produto ? produto.nome : 'Produto não encontrado';
  };

  return (
    <div className="mt-4 space-y-6">
      <div>
        <h3 className="text-base font-medium">Novo Pacote Fotográfico</h3>
        <p className="text-sm text-muted-foreground mt-1 mb-3">
          Configure os pacotes fotográficos disponíveis para venda.
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label htmlFor="pacote-nome" className="block text-sm font-medium mb-1">
              Nome<span className="text-red-500">*</span>
            </label>
            <Input 
              id="pacote-nome" 
              placeholder="Nome do pacote" 
              value={novoPacote.nome} 
              onChange={e => setNovoPacote({
                ...novoPacote,
                nome: e.target.value
              })} 
            />
          </div>
          
          <div>
            <label htmlFor="pacote-categoria" className="block text-sm font-medium mb-1">
              Categoria<span className="text-red-500">*</span>
            </label>
            <select 
              id="pacote-categoria" 
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm" 
              value={novoPacote.categoria_id} 
              onChange={e => setNovoPacote({
                ...novoPacote,
                categoria_id: e.target.value
              })}
            >
              <option value="">Selecione...</option>
              {categorias.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.nome}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label htmlFor="pacote-valor-base" className="block text-sm font-medium mb-1">
              Valor Base (R$)<span className="text-red-500">*</span>
            </label>
            <Input 
              id="pacote-valor-base" 
              type="number" 
              placeholder="0,00" 
              value={novoPacote.valor_base || ''} 
              onChange={e => setNovoPacote({
                ...novoPacote,
                valor_base: Number(e.target.value)
              })} 
            />
          </div>
          
          <div>
            <label htmlFor="pacote-valor-foto" className="block text-sm font-medium mb-1">
              Valor Foto Extra (R$)
            </label>
            <Input 
              id="pacote-valor-foto" 
              type="number" 
              placeholder="0,00" 
              value={novoPacote.valor_foto_extra || ''} 
              onChange={e => setNovoPacote({
                ...novoPacote,
                valor_foto_extra: Number(e.target.value)
              })} 
            />
          </div>
        </div>
        
        
        {/* Seção de Produtos Incluídos */}
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium mb-3">Produtos Incluídos no Pacote</h4>
          
          <div className="space-y-2">
            {novoPacote.produtosIncluidos.map((produtoIncluido) => (
              <div key={produtoIncluido.produtoId} className="flex items-center gap-2 p-2 bg-white rounded border">
                <span className="flex-1 text-sm">{getNomeProduto(produtoIncluido.produtoId)}</span>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Qtd:</label>
                  <Input
                    type="number"
                    min="1"
                    value={produtoIncluido.quantidade}
                    onChange={(e) => atualizarQuantidadeProduto(produtoIncluido.produtoId, Number(e.target.value))}
                    className="w-16 h-7 text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => removerProdutoIncluido(produtoIncluido.produtoId)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            
            {novoPacote.produtosIncluidos.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-2">
                Nenhum produto incluído. Adicione produtos abaixo.
              </p>
            )}
          </div>
          
          <div className="mt-3">
            <Popover open={openProductSelector} onOpenChange={setOpenProductSelector}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Produto
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0">
                <Command>
                  <CommandInput placeholder="Buscar produto..." />
                  <CommandList>
                    <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                    <CommandGroup>
                      {produtos
                        .filter(produto => !novoPacote.produtosIncluidos.some(p => p.produtoId === produto.id))
                        .map((produto) => (
                        <CommandItem
                          key={produto.id}
                          onSelect={() => adicionarProdutoIncluido(produto.id)}
                          className="cursor-pointer"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{produto.nome}</span>
                            <span className="text-sm text-gray-500">
                              R$ {produto.preco_venda.toFixed(2)}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="mt-3">
          <Button onClick={adicionarPacote} className="flex items-center gap-1 bg-lunar-accent">
            <Plus className="h-4 w-4" />
            <span>Adicionar Pacote</span>
          </Button>
        </div>
      </div>
      
      <div>
        <div className="space-y-2 mb-4">
          <h3 className="text-base font-medium">Pacotes Cadastrados</h3>
          <p className="text-sm text-muted-foreground">
            Lista de todos os pacotes fotográficos disponíveis.
          </p>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-100 overflow-hidden shadow-sm">
          <div className="grid grid-cols-12 bg-gray-50/50 px-4 py-3 border-b border-gray-100 text-sm font-medium">
            <div className="col-span-3 sm:col-span-2 text-gray-700">Nome</div>
            <div className="col-span-2 sm:col-span-2 text-gray-700">Categoria</div>
            <div className="col-span-2 hidden sm:block text-gray-700">Valor Base</div>
            <div className="col-span-2 hidden sm:block text-gray-700">Produtos</div>
            <div className="col-span-3 sm:col-span-2 text-right text-gray-700">Ações</div>
          </div>
          
          <div className="divide-y divide-gray-50">
            {pacotes.map((pacote, index) => (
              <div 
                key={pacote.id} 
                className={`grid grid-cols-12 px-4 py-3 text-sm ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25/30'} hover:bg-gray-50/70 transition-colors`}
              >
                {editandoPacote === pacote.id ? (
                  <>
                    <div className="col-span-4 sm:col-span-3 pr-2">
                      <Input 
                        defaultValue={pacote.nome} 
                        onChange={e => {
                          const novoNome = e.target.value;
                          setPacotes(prev => prev.map(p => p.id === pacote.id ? {
                            ...p,
                            nome: novoNome
                          } : p));
                        }}
                        className="h-8 text-sm" 
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-3 pr-2">
                      <select 
                        className="w-full h-8 rounded-md border border-input bg-background px-3 py-1 text-sm" 
                        defaultValue={pacote.categoria_id} 
                        onChange={e => {
                          const novaCategoriaId = e.target.value;
                          setPacotes(prev => prev.map(p => p.id === pacote.id ? {
                            ...p,
                            categoria_id: novaCategoriaId
                          } : p));
                        }}
                      >
                        {categorias.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.nome}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2 hidden sm:block pr-2">
                      <Input 
                        type="number" 
                        defaultValue={pacote.valor_base} 
                        onChange={e => {
                          const novoValorBase = Number(e.target.value);
                          setPacotes(prev => prev.map(p => p.id === pacote.id ? {
                            ...p,
                            valor_base: novoValorBase
                          } : p));
                        }}
                        className="h-8 text-sm" 
                      />
                    </div>
                    <div className="col-span-2 hidden sm:block pr-2">
                      <Input 
                        type="number" 
                        defaultValue={pacote.valor_foto_extra} 
                        onChange={e => {
                          const novoValorFotoExtra = Number(e.target.value);
                          setPacotes(prev => prev.map(p => p.id === pacote.id ? {
                            ...p,
                            valor_foto_extra: novoValorFotoExtra
                          } : p));
                        }}
                        className="h-8 text-sm" 
                      />
                    </div>
                    <div className="flex justify-end items-center gap-2 col-span-4 sm:col-span-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => salvarEdicaoPacote(pacote.id, pacotes.find(p => p.id === pacote.id) || {})}
                      >
                        Salvar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setEditandoPacote(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="col-span-3 sm:col-span-2">{pacote.nome}</div>
                    <div className="col-span-2 sm:col-span-2">
                      {getNomeCategoria(pacote.categoria_id)}
                    </div>
                    <div className="col-span-2 hidden sm:block">
                      {formatarMoeda(pacote.valor_base)}
                    </div>
                    <div className="col-span-2 hidden sm:block">
                      <div className="text-xs">
                        {pacote.produtosIncluidos && pacote.produtosIncluidos.length > 0 
                          ? `${pacote.produtosIncluidos.length} produto(s)`
                          : 'Nenhum produto'
                        }
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 col-span-3 sm:col-span-2">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-7 w-7" 
                        onClick={() => iniciarEdicaoPacote(pacote.id)}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-7 w-7 text-red-500 hover:text-red-600 hover:border-red-200" 
                        onClick={() => removerPacote(pacote.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          
            {pacotes.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground bg-white">
                Nenhum pacote cadastrado. Adicione seu primeiro pacote acima.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}