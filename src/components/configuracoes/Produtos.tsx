import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useRealtimeConfiguration } from '@/hooks/useRealtimeConfiguration';
import { formatarMoeda } from '@/utils/precificacaoUtils';
import { calcularMargemLucro } from '@/utils/productUtils';
import ProdutoFormModal from './ProdutoFormModal';
import ProdutoCard from './ProdutoCard';
import type { Produto, Pacote } from '@/types/configuration';
interface ProdutosProps {
  pacotes: Pacote[];
}

export default function Produtos({ pacotes }: ProdutosProps) {
  // ============= HOOKS =============
  
  const {
    produtos,
    isLoadingProdutos: isLoading,
    adicionarProduto,
    atualizarProduto,
    removerProduto
  } = useRealtimeConfiguration();
  
  const calcularMargemProduto = useCallback((custo: number, venda: number) => {
    return calcularMargemLucro(custo, venda);
  }, []);

  const podeRemoverProduto = useCallback((id: string) => {
    return !pacotes.some(pacote => 
      pacote.produtosIncluidos.some(p => p.produtoId === id)
    );
  }, [pacotes]);
  
  const isMobile = useIsMobile();
  const { confirm, dialogState, handleConfirm, handleCancel, handleClose } = useConfirmDialog();

  // ============= ESTADO LOCAL =============
  
  const [novoProduto, setNovoProduto] = useState({
    nome: '',
    preco_custo: 0,
    preco_venda: 0
  });
  
  const [produtoEditando, setProdutoEditando] = useState<Produto | null>(null);
  const [modalEditOpen, setModalEditOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ============= CÁLCULOS MEMOIZADOS =============
  
  const produtosComMargem = useMemo(() => {
    return produtos.map(produto => ({
      produto,
      margem: calcularMargemProduto(produto.preco_custo, produto.preco_venda),
      canDelete: podeRemoverProduto(produto.id)
    }));
  }, [produtos, calcularMargemProduto, podeRemoverProduto]);

  // ============= HANDLERS =============
  
  const handleAdicionarProduto = useCallback(() => {
    if (novoProduto.nome.trim() === '') {
      return;
    }
    
    adicionarProduto(novoProduto);
    setNovoProduto({
      nome: '',
      preco_custo: 0,
      preco_venda: 0
    });
  }, [novoProduto, adicionarProduto]);

  const handleEditarProduto = useCallback((produto: Produto) => {
    setProdutoEditando(produto);
    setModalEditOpen(true);
  }, []);

  const handleRemoverProduto = useCallback(async (id: string) => {
    const confirmed = await confirm({
      title: 'Confirmar exclusão',
      description: 'Tem certeza que deseja remover este produto?',
      confirmText: 'Sim, remover',
      cancelText: 'Cancelar'
    });
    
    if (confirmed) {
      setDeletingId(id);
      try {
        await removerProduto(id);
      } finally {
        setDeletingId(null);
      }
    }
  }, [confirm, removerProduto]);
  
  // ============= RENDER =============
  
  return (
    <div className="mt-4 space-y-6">
      {/* ============= NOVO PRODUTO ============= */}
      <div className="space-y-4">
        <div>
          <h3 className="font-medium text-sm">Novo Produto</h3>
          <p className="text-muted-foreground mt-1 text-xs">
            Configure os produtos adicionais disponíveis para venda.
          </p>
        </div>
        
        {/* Bloco 1 — Identidade do Produto (Destaque) */}
        <div className="bg-card/50 border-l-4 border-l-primary rounded-lg p-3">
          <div className="space-y-1">
            <label htmlFor="produto-nome" className="text-2xs font-medium text-muted-foreground">
              Nome do Produto <span className="text-destructive">*</span>
            </label>
            <Input 
              id="produto-nome" 
              autoFocus
              placeholder="Ex: Álbum 20x30cm" 
              value={novoProduto.nome} 
              onChange={e => setNovoProduto({
                ...novoProduto,
                nome: e.target.value
              })} 
              className="h-10 text-base font-medium bg-background"
            />
          </div>
        </div>
        
        {/* Bloco 2 — Precificação (Compacto) */}
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[140px] max-w-[180px]">
            <label htmlFor="produto-custo" className="text-2xs font-medium text-muted-foreground mb-1 block">
              Preço de Custo
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                R$
              </span>
              <Input 
                id="produto-custo" 
                type="number" 
                placeholder="0,00" 
                value={novoProduto.preco_custo || ''} 
                onChange={e => setNovoProduto({
                  ...novoProduto,
                  preco_custo: Number(e.target.value)
                })} 
                className="h-8 pl-8 text-sm bg-background"
              />
            </div>
          </div>
          
          <div className="flex-1 min-w-[140px] max-w-[180px]">
            <label htmlFor="produto-venda" className="text-2xs font-medium text-muted-foreground mb-1 block">
              Preço de Venda
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                R$
              </span>
              <Input 
                id="produto-venda" 
                type="number" 
                placeholder="0,00" 
                value={novoProduto.preco_venda || ''} 
                onChange={e => setNovoProduto({
                  ...novoProduto,
                  preco_venda: Number(e.target.value)
                })} 
                className="h-8 pl-8 text-sm bg-background"
              />
            </div>
          </div>
        </div>
        
        {/* Bloco 3 — CTA Único */}
        <div className="flex justify-end pt-1">
          <Button 
            onClick={handleAdicionarProduto} 
            size="sm"
            className="px-6 text-xs font-medium"
            disabled={isLoading || novoProduto.nome.trim() === ''}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Adicionar Produto
          </Button>
        </div>
      </div>
      
      <div>
        <div className="space-y-1 mb-4">
          <h3 className="font-medium text-sm">Produtos Cadastrados</h3>
          <p className="text-muted-foreground text-xs">
            Lista de todos os produtos adicionais disponíveis para venda.
          </p>
        </div>
        
        {produtos.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <div className="rounded-full bg-muted p-3 mb-3">
                <Plus className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Nenhum produto cadastrado. Adicione seu primeiro produto acima.
              </p>
            </CardContent>
          </Card>
        ) : isMobile ? (
          // Layout em cards para mobile
          <div className="space-y-3">
            {produtosComMargem.map(({ produto, margem, canDelete }) => (
              <ProdutoCard
                key={produto.id}
                produto={produto}
                margem={margem}
                onEdit={() => handleEditarProduto(produto)}
                onDelete={() => handleRemoverProduto(produto.id)}
                canDelete={canDelete}
                isDeleting={deletingId === produto.id}
              />
            ))}
          </div>
        ) : (
          // Layout em tabela para desktop
          <div className="bg-card rounded-lg border border-border overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 px-4 py-3 border-b text-xs font-medium bg-lunar-surface">
              <div className="col-span-5 text-foreground">Produto</div>
              <div className="col-span-2 text-foreground">Custo</div>
              <div className="col-span-2 text-foreground">Venda</div>
              <div className="col-span-2 text-foreground">Margem</div>
              <div className="col-span-1 text-right text-foreground">Ações</div>
            </div>
            
            <div className="divide-y divide-border">
              {produtosComMargem.map(({ produto, margem, canDelete }, index) => (
                <div 
                  key={produto.id} 
                  className={`grid grid-cols-12 px-4 py-3 text-xs ${
                    index % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                  } hover:bg-muted/40 transition-colors`}
                >
                  <div className="col-span-5 font-medium">{produto.nome}</div>
                  <div className="col-span-2">{formatarMoeda(produto.preco_custo)}</div>
                  <div className="col-span-2">
                    {produto.preco_venda ? formatarMoeda(produto.preco_venda) : 'Não definido'}
                  </div>
                  <div className={`col-span-2 ${margem.classe} font-medium`}>
                    {margem.porcentagem === 'N/A' 
                      ? 'N/A' 
                      : `${formatarMoeda(margem.valor)} (${margem.porcentagem})`
                    }
                  </div>
                  <div className="flex justify-end gap-1 col-span-1">
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-7 w-7" 
                      onClick={() => handleEditarProduto(produto)}
                      disabled={deletingId === produto.id}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-7 w-7 text-red-500 hover:text-red-600 hover:border-red-200" 
                      onClick={() => handleRemoverProduto(produto.id)}
                      disabled={!canDelete || deletingId === produto.id}
                      title={!canDelete ? 'Produto usado em pacotes' : 'Remover produto'}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Modal de edição */}
      <ProdutoFormModal
        open={modalEditOpen}
        onOpenChange={setModalEditOpen}
        produto={produtoEditando}
        onSave={atualizarProduto}
      />
      
      {/* Dialog de confirmação */}
      <ConfirmDialog
        state={dialogState}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        onClose={handleClose}
      />
    </div>
  );
}