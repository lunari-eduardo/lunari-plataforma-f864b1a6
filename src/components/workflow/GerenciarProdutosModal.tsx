import { useState, useEffect, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, useDialogDropdownContext } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, Package } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { useRealtimeConfiguration } from '@/hooks/useRealtimeConfiguration';

interface ProdutoWorkflow {
  nome: string;
  quantidade: number;
  valorUnitario: number;
  tipo: 'incluso' | 'manual';
  produzido?: boolean;
  entregue?: boolean;
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
  
  // CORREÇÃO: Usar dados real-time do Supabase (sem loops de sync)
  const { produtos: produtosConfig } = useRealtimeConfiguration();
  
  // FASE 1: Usar ref para controlar inicialização e evitar reset
  const isInitialized = useRef(false);
  
  // FASE 2: Ref para focar o input de pesquisa
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // FASE 2: Usar contexto do Dialog para notificar sobre dropdowns abertos
  const dialogContext = useDialogDropdownContext();

  // FASE 2: Focar manualmente quando o Popover abre
  useEffect(() => {
    if (novoProductOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [novoProductOpen]);

  // CORREÇÃO: Inicializar produtos locais APENAS quando modal abre
  useEffect(() => {
    // Só inicializar quando o modal ABRIR e não estiver inicializado
    if (open && !isInitialized.current) {
      console.log('🔄 GerenciarProdutosModal - Inicializando produtos:', produtos);
      
      const produtosCorrigidos = produtos.map(produto => {
        // CORREÇÃO: Resolver nome do produto se estiver vazio ou for um ID
        let nomeProduto = produto.nome;
        
        if (!nomeProduto || nomeProduto.startsWith('Produto ID:')) {
          // Tentar encontrar o produto nos dados de configuração
          const produtoEncontrado = produtosConfig.find(p => 
            p.nome === produto.nome || 
            p.id === produto.nome ||
            produto.nome?.includes(p.id)
          ) || productOptions.find(p => 
            p.nome === produto.nome || 
            p.id === produto.nome ||
            produto.nome?.includes(p.id)
          );
          
          if (produtoEncontrado) {
            nomeProduto = produtoEncontrado.nome;
            console.log('✅ Produto resolvido:', { original: produto.nome, resolvido: nomeProduto });
          }
        }
        
        return {
          ...produto,
          nome: nomeProduto,
          valorUnitario: produto.tipo === 'incluso' ? 0 : produto.valorUnitario,
          produzido: produto.produzido ?? false,
          entregue: produto.entregue ?? false
        };
      });
      
      console.log('📦 Produtos corrigidos:', produtosCorrigidos);
      setLocalProdutos(produtosCorrigidos);
      isInitialized.current = true;  // Marcar como inicializado
    }
    
    // Resetar flag quando modal fechar
    if (!open) {
      isInitialized.current = false;
    }
  }, [open, produtos, produtosConfig, productOptions]);

  // Calcular totais dos produtos
  const totais = useMemo(() => {
    const produtosManuais = localProdutos.filter(p => p.tipo === 'manual');
    const produtosInclusos = localProdutos.filter(p => p.tipo === 'incluso');
    const totalManuais = produtosManuais.reduce((total, p) => total + p.valorUnitario * p.quantidade, 0);
    const totalInclusos = produtosInclusos.reduce((total, p) => total + p.valorUnitario * p.quantidade, 0);
    return {
      manuais: totalManuais,
      inclusos: totalInclusos,
      geral: totalManuais + totalInclusos
    };
  }, [localProdutos]);

  const formatCurrency = (value: number | undefined | null) => {
    const numValue = Number(value) || 0;
    return `R$ ${numValue.toFixed(2).replace('.', ',')}`;
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

  const handleSetFlag = (index: number, key: 'produzido' | 'entregue', value: boolean) => {
    setLocalProdutos(prev => prev.map((p, i) => (i === index ? { ...p, [key]: value } : p)));
  };

  const handleAdicionarProduto = (productName?: string) => {
    const name = productName ?? selectedProduct;
    if (!name) return;
    const productData = productOptions.find(p => p.nome === name);
    if (!productData) return;

    // Verificar se o produto já existe
    const produtoExistente = localProdutos.find(p => p.nome === name);
    if (produtoExistente) {
      // Se já existe, incrementar quantidade
      setLocalProdutos(prev => prev.map(p => (p.nome === name ? { ...p, quantidade: p.quantidade + 1 } : p)));
    } else {
    // Adicionar novo produto - converter valor corretamente
    const valorString = productData.valor || 'R$ 0,00';
    const valorUnitario = parseFloat(valorString.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    console.log('💰 Valor do produto:', { valorString, valorUnitario });
      const novoProduto: ProdutoWorkflow = {
        nome: name,
        quantidade: 1,
        valorUnitario,
        tipo: 'manual',
        produzido: false,
        entregue: false
      };
      setLocalProdutos(prev => [...prev, novoProduto]);
    }
    setSelectedProduct("");
    setNovoProductOpen(false);
  };
  const handleSave = () => {
    console.log('🔄 GerenciarProdutosModal - Salvando produtos:', localProdutos);
    console.log('📊 Total de produtos:', localProdutos.length);
    onSave(localProdutos);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

    return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[92vw] sm:max-w-2xl max-h-[90vh] flex flex-col py-[17px] px-3 sm:px-6 text-xs sm:text-sm" onPointerDownOutside={e => {
      // Prevenir fechamento do modal quando clicar no popover
      const target = e.target as Element;
      if (target.closest('[data-radix-popover-content]') || target.closest('[cmdk-item]')) {
        e.preventDefault();
      }
    }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Package className="h-5 w-5 text-blue-600" />
            Gerenciar Produtos para: {clienteName}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Adicione, remova ou edite os produtos associados a este projeto.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-[8px] scrollbar-elegant">
          {/* Lista de Produtos Atuais */}
          {localProdutos.length > 0 ? <div className="space-y-3 py-0">
              <Label className="text-sm font-normal ">Produtos Associados</Label>
              <div className="space-y-2">
                {localProdutos.map((produto, index) => <div key={index} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                    <div className="flex-1 min-w-0 w-full">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate text-xs sm:text-sm" title={produto.nome}>{produto.nome}</span>
                        {produto.tipo === 'incluso' && <Badge variant="secondary" className="text-xs">
                            Incluso no pacote
                          </Badge>}
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:text-xs text-muted-foreground">
                        <span>Preço unit.: {produto.tipo === 'incluso' ? 'R$ 0,00 (incluso)' : formatCurrency(produto.valorUnitario)}</span>
                        <span>Subtotal: {produto.tipo === 'incluso' ? 'R$ 0,00 (incluso)' : formatCurrency(produto.valorUnitario * produto.quantidade)}</span>
                      </div>
                    </div>
                    
                    <div className="w-full sm:w-auto flex flex-wrap items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-0">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <Checkbox
                            id={`prod-${index}`}
                            checked={!!produto.produzido}
                            onCheckedChange={(checked) => handleSetFlag(index, 'produzido', !!checked)}
                            className="h-4 w-4"
                          />
                          <Label htmlFor={`prod-${index}`} className="text-[11px]">Produção</Label>
                        </div>
                        <div className="flex items-center gap-1">
                          <Checkbox
                            id={`ent-${index}`}
                            checked={!!produto.entregue}
                            onCheckedChange={(checked) => handleSetFlag(index, 'entregue', !!checked)}
                            className="h-4 w-4"
                          />
                          <Label htmlFor={`ent-${index}`} className="text-[11px]">Entrega</Label>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Label className="text-[11px]">Qtd:</Label>
                          <Input type="number" value={produto.quantidade} onChange={e => handleQuantidadeChange(index, parseInt(e.target.value) || 0)} className="w-14 h-8 text-xs" min="0" />
                        </div>
                        
                        <Button variant="ghost" size="sm" onClick={() => handleRemoverProduto(index)} className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
                <Popover 
                  open={novoProductOpen} 
                  onOpenChange={(open) => {
                    setNovoProductOpen(open);
                    dialogContext?.setHasOpenDropdown(open);
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={novoProductOpen} className="w-full justify-between h-7 text-xs">
                      {selectedProduct || "Selecione um produto..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-[--radix-popover-trigger-width] p-0" 
                    align="start"
                    sideOffset={4}
                    onOpenAutoFocus={(e) => {
                      // Permitir auto-focus no input de pesquisa
                    }}
                    onCloseAutoFocus={e => e.preventDefault()}
                  >
                    <Command>
                      <CommandInput ref={searchInputRef} placeholder="Buscar produto..." className="h-9" />
                      <CommandList>
                        <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                        <CommandGroup>
                          {productOptions.map(product => (
                            <CommandItem 
                              key={product.id} 
                              value={product.nome}
                              onSelect={() => handleAdicionarProduto(product.nome)}
                              className="cursor-pointer"
                            >
                              <Check className={cn("mr-2 h-4 w-4", selectedProduct === product.nome ? "opacity-100" : "opacity-0")} />
                              <div className="flex flex-col">
                                <span className="font-medium">{product.nome}</span>
                                <span className="text-xs text-muted-foreground">{product.valor}</span>
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
          </div>
        </div>

        {/* Resumo Financeiro - Sempre mostrado quando há produtos */}
        {localProdutos.length > 0 && <div className="border-t pt-4 space-y-3">
            <Label className="text-sm font-medium">Resumo Financeiro</Label>
            
            {/* Detalhamento por tipo */}
            <div className="space-y-2 text-sm">
              {totais.inclusos > 0 && <div className="flex justify-between items-center text-muted-foreground">
                  <span>Produtos inclusos no pacote:</span>
                  <span>{formatCurrency(totais.inclusos)}</span>
                </div>}
              
              {totais.manuais > 0 && <div className="flex justify-between items-center">
                  <span className="text-xs">Produtos adicionais:</span>
                  <span className="font-medium text-green-600">{formatCurrency(totais.manuais)}</span>
                </div>}
              
              {totais.inclusos > 0 && totais.manuais > 0 && <div className="flex justify-between items-center pt-2 border-t">
                  <span className="font-medium">Total geral dos produtos:</span>
                  <span className="text-lg font-bold text-green-600">{formatCurrency(totais.geral)}</span>
                </div>}
              
              {totais.manuais === 0 && totais.inclusos > 0 && <div className="flex justify-between items-center">
                  <span>Valor adicional a pagar:</span>
                  <span className="text-lg font-bold text-green-600">R$ 0,00</span>
                </div>}
              
              {totais.manuais > 0 && totais.inclusos === 0 && <div className="flex justify-between items-center pt-2 border-t">
                  <span className="font-medium">Total a pagar:</span>
                  <span className="text-lg font-bold text-green-600">{formatCurrency(totais.manuais)}</span>
                </div>}
            </div>
            
            <p className="text-xs text-muted-foreground">*Produtos inclusos no pacote já estão contabilizados no pacote</p>
          </div>}

        <DialogFooter className="py-0 my-0">
          <Button variant="outline" onClick={handleCancel} className="h-9 text-xs">
            Cancelar
          </Button>
          <Button onClick={handleSave} className="h-9 text-xs">
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>;
}
