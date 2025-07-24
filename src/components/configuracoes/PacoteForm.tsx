import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X } from 'lucide-react';
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
interface PacoteFormData {
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
interface PacoteFormProps {
  initialData?: PacoteFormData;
  categorias: Categoria[];
  produtos: Produto[];
  onSubmit: (data: PacoteFormData) => void;
  onCancel?: () => void;
  submitLabel?: string;
  isEditing?: boolean;
}
export default function PacoteForm({
  initialData,
  categorias,
  produtos,
  onSubmit,
  onCancel,
  submitLabel = "Salvar",
  isEditing = false
}: PacoteFormProps) {
  const [formData, setFormData] = useState<PacoteFormData>(initialData || {
    nome: '',
    categoria_id: '',
    valor_base: 0,
    valor_foto_extra: 0,
    produtosIncluidos: []
  });
  const [openProductSelector, setOpenProductSelector] = useState(false);
  const handleSubmit = () => {
    if (formData.nome.trim() === '') {
      toast.error('O nome do pacote não pode estar vazio');
      return;
    }
    if (!formData.categoria_id) {
      toast.error('Selecione uma categoria para o pacote');
      return;
    }
    if (formData.valor_base <= 0) {
      toast.error('O valor base deve ser maior que zero');
      return;
    }
    onSubmit(formData);
    if (!isEditing) {
      setFormData({
        nome: '',
        categoria_id: '',
        valor_base: 0,
        valor_foto_extra: 0,
        produtosIncluidos: []
      });
    }
  };
  const adicionarProdutoIncluido = (produtoId: string) => {
    const produtoExistente = formData.produtosIncluidos.find(p => p.produtoId === produtoId);
    if (produtoExistente) {
      toast.error('Produto já está incluído no pacote');
      return;
    }
    setFormData({
      ...formData,
      produtosIncluidos: [...formData.produtosIncluidos, {
        produtoId,
        quantidade: 1
      }]
    });
    setOpenProductSelector(false);
  };
  const removerProdutoIncluido = (produtoId: string) => {
    setFormData({
      ...formData,
      produtosIncluidos: formData.produtosIncluidos.filter(p => p.produtoId !== produtoId)
    });
  };
  const atualizarQuantidadeProduto = (produtoId: string, quantidade: number) => {
    setFormData({
      ...formData,
      produtosIncluidos: formData.produtosIncluidos.map(p => p.produtoId === produtoId ? {
        ...p,
        quantidade
      } : p)
    });
  };
  const getNomeProduto = (produtoId: string) => {
    const produto = produtos.find(p => p.id === produtoId);
    return produto ? produto.nome : 'Produto não encontrado';
  };
  return <div className="space-y-2 py-0">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="pacote-nome" className="block text-sm font-medium mb-1">
            Nome<span className="text-red-500">*</span>
          </label>
          <Input id="pacote-nome" placeholder="Nome do pacote" value={formData.nome} onChange={e => setFormData({
          ...formData,
          nome: e.target.value
        })} className="bg-neutral-50" />
        </div>
        
        <div>
          <label htmlFor="pacote-categoria" className="block text-sm font-medium mb-1">
            Categoria<span className="text-red-500">*</span>
          </label>
          <select id="pacote-categoria" value={formData.categoria_id} onChange={e => setFormData({
          ...formData,
          categoria_id: e.target.value
        })} className="w-full h-7 rounded-md border border-input px-3 text-base ring-0 file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm py-[1px] bg-neutral-50">
            <option value="">Selecione...</option>
            {categorias.map(cat => <option key={cat.id} value={cat.id}>{cat.nome}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="pacote-valor-base" className="block text-sm font-medium mb-1">
            Valor Base (R$)<span className="text-red-500">*</span>
          </label>
          <Input id="pacote-valor-base" type="number" placeholder="0,00" value={formData.valor_base || ''} onChange={e => setFormData({
          ...formData,
          valor_base: Number(e.target.value)
        })} className="bg-neutral-50" />
        </div>
        
        <div>
          <label htmlFor="pacote-valor-foto" className="block text-sm font-medium mb-1">
            Valor Foto Extra (R$)
          </label>
          <Input id="pacote-valor-foto" type="number" placeholder="0,00" value={formData.valor_foto_extra || ''} onChange={e => setFormData({
          ...formData,
          valor_foto_extra: Number(e.target.value)
        })} className="bg-neutral-50" />
        </div>
      </div>
      
      {/* Seção de Produtos Incluídos */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium mb-3 text-center">Produtos Incluídos no Pacote</h4>
        
        <div className="space-y-2">
          {formData.produtosIncluidos.map(produtoIncluido => <div key={produtoIncluido.produtoId} className="flex items-center gap-2 p-2 bg-white rounded border">
              <span className="flex-1 text-sm">{getNomeProduto(produtoIncluido.produtoId)}</span>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Qtd:</label>
                <Input type="number" min="1" value={produtoIncluido.quantidade} onChange={e => atualizarQuantidadeProduto(produtoIncluido.produtoId, Number(e.target.value))} className="w-16 h-7 text-xs" />
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => removerProdutoIncluido(produtoIncluido.produtoId)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>)}
          
          {formData.produtosIncluidos.length === 0 && <p className="text-xs text-gray-500 text-center py-0">
              Nenhum produto incluído. Adicione produtos abaixo.
            </p>}
        </div>
        
        <div className="mt-3">
          <Popover open={openProductSelector} onOpenChange={setOpenProductSelector}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Produto
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 z-[10000] bg-background border shadow-lg">
              <Command>
                <CommandInput placeholder="Buscar produto..." />
                <CommandList>
                  <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                  <CommandGroup>
                    {produtos.filter(produto => !formData.produtosIncluidos.some(p => p.produtoId === produto.id)).map(produto => <CommandItem 
                        key={produto.id} 
                        onSelect={(value) => {
                          console.log('Produto selecionado:', produto.nome);
                          adicionarProdutoIncluido(produto.id);
                        }} 
                        className="cursor-pointer hover:bg-accent"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          adicionarProdutoIncluido(produto.id);
                        }}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{produto.nome}</span>
                          <span className="text-sm text-gray-500">
                            R$ {produto.preco_venda.toFixed(2)}
                          </span>
                        </div>
                      </CommandItem>)}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="flex gap-2 pt-1 py-0">
        <Button onClick={handleSubmit} className="bg-lunar-accent">
          {submitLabel}
        </Button>
        {onCancel && <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>}
      </div>
    </div>;
}