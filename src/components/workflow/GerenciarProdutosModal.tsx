import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Package } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
interface ProdutoWorkflow {
  nome: string;
  quantidade: number;
  valorUnitario: number;
  tipo: 'incluso' | 'manual';
}
interface ProductOption {
  id: string;
  nome: string;
  valor: string;
}
interface GerenciarProdutosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  clienteName: string;
  produtos: ProdutoWorkflow[];
  productOptions: ProductOption[];
  onSave: (produtos: ProdutoWorkflow[]) => void;
}
export function GerenciarProdutosModal({
  open,
  onOpenChange,
  sessionId,
  clienteName,
  produtos,
  productOptions,
  onSave
}: GerenciarProdutosModalProps) {
  const [localProdutos, setLocalProdutos] = useState<ProdutoWorkflow[]>([]);
  const [novoProductOpen, setNovoProductOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>("");

  // Inicializar produtos locais quando o modal abrir
  useEffect(() => {
    if (open) {
      setLocalProdutos([...produtos]);
    }
  }, [open, produtos]);

  // Calcular total dos produtos manuais
  const totalProdutosManuais = useMemo(() => {
    return localProdutos.filter(p => p.tipo === 'manual').reduce((total, p) => total + p.valorUnitario * p.quantidade, 0);
  }, [localProdutos]);
  const formatCurrency = (value: number) => {
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
  };
  const handleQuantidadeChange = (index: number, novaQuantidade: number) => {
    setLocalProdutos(prev => prev.map((produto, i) => i === index ? {
      ...produto,
      quantidade: Math.max(0, novaQuantidade)
    } : produto));
  };
  const handleRemoverProduto = (index: number) => {
    setLocalProdutos(prev => prev.filter((_, i) => i !== index));
  };
  const handleAdicionarProduto = () => {
    if (!selectedProduct) return;
    const productData = productOptions.find(p => p.nome === selectedProduct);
    if (!productData) return;

    // Verificar se o produto já existe
    const produtoExistente = localProdutos.find(p => p.nome === selectedProduct);
    if (produtoExistente) {
      // Se já existe, incrementar quantidade
      setLocalProdutos(prev => prev.map(p => p.nome === selectedProduct ? {
        ...p,
        quantidade: p.quantidade + 1
      } : p));
    } else {
      // Adicionar novo produto
      const valorUnitario = parseFloat(productData.valor.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
      const novoProduto: ProdutoWorkflow = {
        nome: selectedProduct,
        quantidade: 1,
        valorUnitario,
        tipo: 'manual'
      };
      setLocalProdutos(prev => [...prev, novoProduto]);
    }
    setSelectedProduct("");
    setNovoProductOpen(false);
  };
  const handleSave = () => {
    onSave(localProdutos);
    onOpenChange(false);
  };
  const handleCancel = () => {
    onOpenChange(false);
  };
  return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col py-[17px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Package className="h-5 w-5 text-blue-600" />
            Gerenciar Produtos para: {clienteName}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Adicione, remova ou edite os produtos associados a este projeto.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-[8px]">
          {/* Lista de Produtos Atuais */}
          {localProdutos.length > 0 ? <div className="space-y-3 py-0">
              <Label className="text-sm font-normal ">Produtos Associados</Label>
              <div className="space-y-2">
                {localProdutos.map((produto, index) => <div key={index} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border py-[6px]">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate text-xs">{produto.nome}</span>
                        {produto.tipo === 'incluso' && <Badge variant="secondary" className="text-xs">
                            Incluso no pacote
                          </Badge>}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Preço unit.: {produto.tipo === 'incluso' ? 'R$ 0,00' : formatCurrency(produto.valorUnitario)}</span>
                        <span>Subtotal: {formatCurrency(produto.valorUnitario * produto.quantidade)}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Label className="text-xs">Qtd:</Label>
                        <Input type="number" value={produto.quantidade} onChange={e => handleQuantidadeChange(index, parseInt(e.target.value) || 0)} className="w-16 h-8 text-xs" min="0" />
                      </div>
                      
                      <Button variant="ghost" size="sm" onClick={() => handleRemoverProduto(index)} className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>)}
              </div>
            </div> : <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum produto associado a este projeto.</p>
            </div>}

          {/* Seção Adicionar Novo Produto */}
          <div className="space-y-3 border-t pt-4">
            <Label className="text-sm font-normal ">Adicionar Novo Produto</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Popover open={novoProductOpen} onOpenChange={setNovoProductOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={novoProductOpen} className="w-full justify-between h-7 text-xs">
                      {selectedProduct || "Selecione um produto..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar produto..." className="h-9" />
                      <CommandList>
                        <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                        <CommandGroup>
                          {productOptions.map(product => <CommandItem key={product.id} value={product.nome} onSelect={currentValue => {
                          setSelectedProduct(currentValue === selectedProduct ? "" : currentValue);
                        }}>
                              <Check className={cn("mr-2 h-4 w-4", selectedProduct === product.nome ? "opacity-100" : "opacity-0")} />
                              <div className="flex flex-col">
                                <span className="font-medium">{product.nome}</span>
                                <span className="text-xs text-muted-foreground">{product.valor}</span>
                              </div>
                            </CommandItem>)}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              
              <Button onClick={handleAdicionarProduto} disabled={!selectedProduct} size="sm" className="h-7 text-xs">
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>
          </div>
        </div>

        {/* Resumo Financeiro */}
        {totalProdutosManuais > 0 && <div className="border-t pt-4">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-medium">Valor Total dos Produtos Adicionais:</Label>
              <span className="text-lg font-bold text-green-600">
                {formatCurrency(totalProdutosManuais)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              *Produtos inclusos no pacote não são somados no total
            </p>
          </div>}

        <DialogFooter className="py-0 my-0">
          <Button variant="outline" onClick={handleCancel} className="text-xs">
            Cancelar
          </Button>
          <Button onClick={handleSave} className="text-xs">
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>;
}