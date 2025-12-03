import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, Package, ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useRealtimeConfiguration } from '@/hooks/useRealtimeConfiguration';

// Função para normalizar texto (remover acentos e caracteres especiais)
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacríticos
    .replace(/[^a-z0-9\s]/g, ''); // Remove caracteres especiais
};

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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // CORREÇÃO: Usar dados real-time do Supabase (sem loops de sync)
  const { produtos: produtosConfig } = useRealtimeConfiguration();
  
  // FASE 1: Usar refs para controlar inicialização e evitar reset
  const isInitialized = useRef(false);
  const wasOpen = useRef(false);

  // CORREÇÃO: Resetar dropdown APENAS quando modal ABRE (transição false -> true)
  useEffect(() => {
    if (open && !wasOpen.current) {
      // Transição de fechado para aberto - resetar dropdown
      setIsDropdownOpen(false);
      setSearchTerm('');
      setDropdownPosition(null);
    }
    wasOpen.current = open;
  }, [open]);

  // CORREÇÃO: Inicializar produtos locais separadamente (sem afetar searchTerm)
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

  // Filtrar produtos baseado no termo de busca
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return productOptions;
    
    const normalizedSearch = normalizeText(searchTerm);
    return productOptions.filter(product => {
      const normalizedName = normalizeText(product.nome);
      return normalizedName.includes(normalizedSearch);
    });
  }, [productOptions, searchTerm]);

  // Atualizar posição do dropdown baseado no input
  const updateDropdownPosition = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4, // 4px de espaçamento
        left: rect.left,
        width: rect.width
      });
    }
  };

  // Fechar dropdown quando clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Verificar se o clique foi fora do container E fora do dropdown portal
      const isOutsideContainer = containerRef.current && !containerRef.current.contains(target);
      const isOutsideDropdown = !(target as Element).closest?.('[data-product-dropdown]');
      
      if (isOutsideContainer && isOutsideDropdown) {
        setIsDropdownOpen(false);
        setIsEditing(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reposicionar dropdown em scroll/resize
  useEffect(() => {
    if (!isDropdownOpen) return;
    
    const handlePositionUpdate = () => updateDropdownPosition();
    
    window.addEventListener('scroll', handlePositionUpdate, true);
    window.addEventListener('resize', handlePositionUpdate);
    
    return () => {
      window.removeEventListener('scroll', handlePositionUpdate, true);
      window.removeEventListener('resize', handlePositionUpdate);
    };
  }, [isDropdownOpen]);

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setIsEditing(true);
    
    // Calcular posição antes de abrir (caso ainda não esteja aberto)
    if (!isDropdownOpen) {
      requestAnimationFrame(() => {
        updateDropdownPosition();
        setIsDropdownOpen(true);
      });
    } else {
      // Se já está aberto, apenas atualizar posição
      updateDropdownPosition();
    }
  };

  // REFATORAÇÃO: handleInputFocus NÃO abre dropdown automaticamente
  // Isso evita posicionamento incorreto quando modal ainda está animando
  const handleInputFocus = () => {
    setIsEditing(true);
    // NÃO abrir dropdown no focus - apenas preparar estado
  };

  // REFATORAÇÃO: handleInputClick abre dropdown intencionalmente via clique
  const handleInputClick = () => {
    requestAnimationFrame(() => {
      updateDropdownPosition();
      setIsDropdownOpen(true);
    });
  };

  const handleSelectProduct = (product: ProductOption) => {
    const name = product.nome;
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
    setSearchTerm('');
    setIsEditing(false);
    setIsDropdownOpen(false);
    inputRef.current?.blur();
  };
  const handleSave = () => {
    // Garantir que checkboxes (produzido/entregue) são incluídos corretamente
    const produtosParaSalvar = localProdutos.map(p => ({
      ...p,
      produzido: !!p.produzido,
      entregue: !!p.entregue
    }));
    console.log('🔄 GerenciarProdutosModal - Salvando produtos:', produtosParaSalvar);
    console.log('📊 Total de produtos:', produtosParaSalvar.length);
    onSave(produtosParaSalvar);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

    return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[92vw] sm:max-w-2xl max-h-[90vh] flex flex-col py-[17px] px-3 sm:px-6 text-xs sm:text-sm" onPointerDownOutside={e => {
      // Prevenir fechamento do modal quando clicar no popover ou dropdown portal
      const target = e.target as Element;
      if (target.closest('[data-radix-popover-content]') || target.closest('[cmdk-item]') || target.closest('[data-product-dropdown]')) {
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
            <div ref={containerRef} className="relative w-full">
              <div className="relative">
                <Input
                  ref={inputRef}
                  value={searchTerm}
                  onChange={handleInputChange}
                  onFocus={handleInputFocus}
                  onClick={handleInputClick}
                  placeholder="Buscar produto por nome..."
                  className="pr-8 text-xs h-9"
                  autoComplete="off"
                />
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>

              {isDropdownOpen && dropdownPosition && createPortal(
                <div 
                  data-product-dropdown
                  className="fixed z-[99999] bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-auto scrollbar-minimal pointer-events-auto"
                  style={{
                    top: dropdownPosition.top,
                    left: dropdownPosition.left,
                    width: dropdownPosition.width
                  }}
                  onWheel={(e) => e.stopPropagation()}
                >
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((product) => (
                      <div
                        key={product.id}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleSelectProduct(product);
                        }}
                        className="px-3 py-2 cursor-pointer text-xs border-b border-border last:border-b-0 hover:bg-accent bg-popover"
                      >
                        <div className="flex items-center">
                          <Package className="h-3 w-3 mr-2 text-muted-foreground" />
                          <div className="flex-1">
                            <span className="font-medium">{product.nome}</span>
                            <div className="text-[11px] text-muted-foreground">
                              {product.valor}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-xs text-muted-foreground bg-popover">
                      Nenhum produto encontrado
                    </div>
                  )}
                </div>,
                document.body
              )}
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
