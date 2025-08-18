import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Filter, Check, ChevronsUpDown, ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import PacoteForm from './PacoteForm';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { obterConfiguracaoPrecificacao } from '@/utils/precificacaoUtils';
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
export default function Pacotes({
  pacotes,
  setPacotes,
  categorias,
  produtos
}: PacotesProps) {
  // Estados para filtros
  const [filtroCategoria, setFiltroCategoria] = useState<string>('all');
  const [filtroNome, setFiltroNome] = useState<string>('');
  const [filtroValor, setFiltroValor] = useState<string>('');
  const [editingPackage, setEditingPackage] = useState<string | null>(null);
  const [novoPacoteAberto, setNovoPacoteAberto] = useState(false);

  // Verificar modelo de precificação atual
  const configPrecificacao = obterConfiguracaoPrecificacao();
  const isFixedPricing = configPrecificacao.modelo === 'fixo';

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
      const matchCategoria = !filtroCategoria || filtroCategoria === 'all' || pacote.categoria_id === filtroCategoria;
      const matchNome = !debouncedFiltroNome || pacote.nome.toLowerCase().includes(debouncedFiltroNome.toLowerCase());
      const matchValor = !debouncedFiltroValor || pacote.valor_base.toString().includes(debouncedFiltroValor);
      return matchCategoria && matchNome && matchValor;
    });
  }, [pacotes, filtroCategoria, debouncedFiltroNome, debouncedFiltroValor]);
  const adicionarPacote = useCallback((formData: any) => {
    const newId = String(Date.now());
    setPacotes(prev => [...prev, {
      id: newId,
      ...formData
    }]);
  }, [setPacotes]);
  const atualizarPacote = useCallback((id: string, campo: keyof Pacote, valor: any) => {
    setPacotes(prev => prev.map(pacote => pacote.id === id ? {
      ...pacote,
      [campo]: valor
    } : pacote));
  }, [setPacotes]);
  const adicionarProdutoAoPacote = useCallback((pacoteId: string, produtoId: string) => {
    setPacotes(prev => prev.map(pacote => {
      if (pacote.id === pacoteId) {
        const produtoExistente = pacote.produtosIncluidos.find(p => p.produtoId === produtoId);
        if (produtoExistente) {
          return {
            ...pacote,
            produtosIncluidos: pacote.produtosIncluidos.map(p => p.produtoId === produtoId ? {
              ...p,
              quantidade: p.quantidade + 1
            } : p)
          };
        } else {
          return {
            ...pacote,
            produtosIncluidos: [...pacote.produtosIncluidos, {
              produtoId,
              quantidade: 1
            }]
          };
        }
      }
      return pacote;
    }));
  }, [setPacotes]);
  const removerProdutoDoPacote = useCallback((pacoteId: string, produtoId: string) => {
    setPacotes(prev => prev.map(pacote => {
      if (pacote.id === pacoteId) {
        return {
          ...pacote,
          produtosIncluidos: pacote.produtosIncluidos.filter(p => p.produtoId !== produtoId)
        };
      }
      return pacote;
    }));
  }, [setPacotes]);
  const removerPacote = useCallback((id: string) => {
    setPacotes(prev => prev.filter(pacote => pacote.id !== id));
  }, [setPacotes]);
  const limparFiltros = useCallback(() => {
    setFiltroCategoria('all');
    setFiltroNome('');
    setFiltroValor('');
  }, []);
  const ProdutoDropdown = useCallback(({
    pacote
  }: {
    pacote: Pacote;
  }) => {
    const [open, setOpen] = useState(false);
    const produtosDisponiveis = produtos.filter(produto => !pacote.produtosIncluidos.some(p => p.produtoId === produto.id));
    return <div className="space-y-1">
        {/* Lista de produtos incluídos */}
        <div className="flex flex-wrap gap-1 mb-2">
          {pacote.produtosIncluidos.map(produto => {
          const nomeProduto = getNomeProduto(produto.produtoId);
          return <div key={produto.produtoId} className="inline-flex items-center gap-1 bg-lunar-accent/10 text-lunar-accent px-2 py-1 rounded text-xs border border-lunar-accent/20">
                <span>{nomeProduto}</span>
                {produto.quantidade > 1 && <span className="font-medium">({produto.quantidade}x)</span>}
                <button onClick={() => removerProdutoDoPacote(pacote.id, produto.produtoId)} className="text-lunar-accent hover:text-lunar-accentHover ml-1">
                  ×
                </button>
              </div>;
        })}
        </div>
        
        {/* Dropdown para adicionar produtos */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-6 text-xs w-full justify-between" disabled={produtosDisponiveis.length === 0}>
              <Plus className="h-3 w-3 mr-1" />
              Adicionar produto
              <ChevronsUpDown className="h-3 w-3 ml-1" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0 z-[10000]" align="start">
            <Command>
              <CommandInput placeholder="Buscar produto..." className="h-8 text-xs" />
              <CommandList>
                <CommandEmpty className="py-2 text-xs text-muted-foreground">
                  Nenhum produto encontrado.
                </CommandEmpty>
                <CommandGroup>
                  {produtosDisponiveis.map(produto => <CommandItem key={produto.id} onSelect={() => {
                  adicionarProdutoAoPacote(pacote.id, produto.id);
                  setOpen(false);
                }} className="text-xs cursor-pointer">
                      <div className="flex flex-col">
                        <span className="font-medium">{produto.nome}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatarMoeda(produto.preco_venda)}
                        </span>
                      </div>
                    </CommandItem>)}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>;
  }, [produtos, getNomeProduto, adicionarProdutoAoPacote, removerProdutoDoPacote, formatarMoeda]);
  return <div className="mt-4 space-y-6">
      {/* Formulário Novo Pacote */}
      <div className="bg-muted rounded-lg border border-border p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-center">
            <Collapsible open={novoPacoteAberto} onOpenChange={setNovoPacoteAberto} className="w-full">
              <CollapsibleTrigger asChild>
                <Button className="bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30 flex items-center justify-center gap-2 px-4 py-2 rounded-lg mx-auto">
                  <span className="text-sm">📦</span>
                  {novoPacoteAberto ? <>
                      Fechar Formulário
                      <ChevronUp className="h-4 w-4" />
                    </> : <>
                      [+] Novo Pacote
                      <ChevronDown className="h-4 w-4" />
                    </>}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-6 border-t border-neutral-300/30 pt-6">
                  <div className="mb-4 text-center">
                    <h3 className="font-medium text-sm">Novo Pacote Fotográfico</h3>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Configure os pacotes fotográficos disponíveis para venda.
                    </p>
                  </div>
                  
                  <div className="bg-card rounded-lg border border-border p-4">
                    <PacoteForm categorias={categorias} produtos={produtos} onSubmit={adicionarPacote} submitLabel="Adicionar Pacote" />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      </div>
      
      {/* Seção Pacotes Cadastrados */}
      <div>
        <div className="space-y-2 mb-4 rounded-lg px-[15px] bg-muted">
          <h3 className="font-medium text-sm text-inherit">Pacotes Cadastrados</h3>
          <p className="text-muted-foreground text-xs">Lista de todos os pacotes disponíveis.</p>
        </div>
        
        {/* Barra de Filtros */}
        <div className="bg-muted p-4 rounded-lg mb-4 py-[10px]">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-3 w-3" />
            <span className="font-medium text-xs">Filtros</span>
            <Button variant="outline" size="sm" onClick={limparFiltros} className="ml-auto text-xs">
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
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {categorias.map(categoria => <SelectItem key={categoria.id} value={categoria.id}>
                      {categoria.nome}
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block text-xs font-medium mb-1">Filtrar por Nome</label>
              <Input placeholder="Digite o nome do pacote..." value={filtroNome} onChange={e => setFiltroNome(e.target.value)} className="h-8 text-sm" />
            </div>
            
            <div>
              <label className="block text-xs font-medium mb-1">Filtrar por Valor Base</label>
              <Input type="number" placeholder="Digite o valor..." value={filtroValor} onChange={e => setFiltroValor(e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
          
          {filtroCategoria !== 'all' || debouncedFiltroNome || debouncedFiltroValor}
        </div>

        {/* Tabela Responsiva */}
        <div className="overflow-x-auto scrollbar-elegant">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-medium w-[120px]">Nome</TableHead>
                <TableHead className="text-xs font-medium w-[100px]">Categoria</TableHead>
                <TableHead className="text-xs font-medium w-[90px]">Valor Base</TableHead>
                <TableHead className="text-xs font-medium w-[90px]">Foto Extra</TableHead>
                <TableHead className="text-xs font-medium min-w-[200px]">Produtos Incluídos</TableHead>
                <TableHead className="text-xs font-medium w-[60px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pacotesFiltrados.map(pacote => <TableRow key={pacote.id} className="hover:bg-muted/60">
                  {/* Nome - Editável */}
                  <TableCell className="p-2">
                    <Input value={pacote.nome} onChange={e => atualizarPacote(pacote.id, 'nome', e.target.value)} className="h-7 text-xs border-0 bg-transparent hover:bg-muted/50 focus:bg-card focus:border-border" />
                  </TableCell>
                  
                  {/* Categoria - Seletor */}
                  <TableCell className="p-2">
                    <Select value={pacote.categoria_id} onValueChange={value => atualizarPacote(pacote.id, 'categoria_id', value)}>
                      <SelectTrigger className="h-7 text-xs border-0 bg-transparent hover:bg-muted/50 focus:bg-card focus:border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categorias.map(categoria => <SelectItem key={categoria.id} value={categoria.id} className="text-xs">
                            {categoria.nome}
                          </SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  
                  {/* Valor Base - Editável */}
                  <TableCell className="p-2">
                    <Input type="number" value={pacote.valor_base} onChange={e => atualizarPacote(pacote.id, 'valor_base', parseFloat(e.target.value) || 0)} className="h-7 text-xs border-0 bg-transparent hover:bg-muted/50 focus:bg-card focus:border-border" />
                  </TableCell>
                  
                  {/* Valor Foto Extra - Editável apenas no modelo fixo */}
                  <TableCell className="p-2">
                    {isFixedPricing ? <Input type="number" value={pacote.valor_foto_extra} onChange={e => atualizarPacote(pacote.id, 'valor_foto_extra', parseFloat(e.target.value) || 0)} className="h-7 text-xs border-0 bg-transparent hover:bg-muted/50 focus:bg-card focus:border-border" /> : <div className="h-7 flex items-center text-xs text-muted-foreground px-2">
                        {configPrecificacao.modelo === 'global' ? 'Tabela Global' : 'Por Categoria'}
                      </div>}
                  </TableCell>
                  
                  {/* Produtos Incluídos - Dropdown para edição */}
                  <TableCell className="p-2">
                    <ProdutoDropdown pacote={pacote} />
                  </TableCell>
                  
                  {/* Ações */}
                  <TableCell className="p-2 text-right">
                    <Button variant="outline" size="icon" className="h-6 w-6 text-red-500 hover:text-red-600 hover:border-red-200" onClick={() => removerPacote(pacote.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>)}
              
              {pacotesFiltrados.length === 0 && <TableRow>
                  <TableCell colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {pacotes.length === 0 ? "Nenhum pacote cadastrado. Adicione seu primeiro pacote acima." : "Nenhum pacote encontrado com os filtros aplicados."}
                  </TableCell>
                </TableRow>}
            </TableBody>
          </Table>
        </div>
      </div>

    </div>;
}