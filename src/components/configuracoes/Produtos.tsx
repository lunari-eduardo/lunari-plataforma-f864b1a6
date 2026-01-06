import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useRealtimeConfiguration } from '@/hooks/useRealtimeConfiguration';
import { formatarMoeda } from '@/utils/precificacaoUtils';
import { calcularMargemLucro } from '@/utils/productUtils';
import ConfigSectionHeader from './ConfigSectionHeader';
import ProdutoFormModal from './ProdutoFormModal';
import ProdutoCard from './ProdutoCard';
import type { Produto, Pacote } from '@/types/configuration';

interface ProdutosProps {
  pacotes: Pacote[];
}

export default function Produtos({ pacotes }: ProdutosProps) {
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

  const [novoProduto, setNovoProduto] = useState({
    nome: '',
    preco_custo: 0,
    preco_venda: 0
  });
  
  const [produtoEditando, setProdutoEditando] = useState<Produto | null>(null);
  const [modalEditOpen, setModalEditOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const produtosComMargem = useMemo(() => {
    return produtos.map(produto => ({
      produto,
      margem: calcularMargemProduto(produto.preco_custo, produto.preco_venda),
      canDelete: podeRemoverProduto(produto.id)
    }));
  }, [produtos, calcularMargemProduto, podeRemoverProduto]);

  const handleAdicionarProduto = useCallback(() => {
    if (novoProduto.nome.trim() === '') return;
    adicionarProduto(novoProduto);
    setNovoProduto({ nome: '', preco_custo: 0, preco_venda: 0 });
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

  return (
    <div className="space-y-6 py-4">
      <ConfigSectionHeader
        title="Produtos"
        subtitle="Configure os produtos adicionais disponíveis para venda."
      />

      {/* Formulário Novo Produto */}
      <div className="space-y-4 p-4 border border-border rounded-lg bg-card">
        <div className="space-y-1.5">
          <label htmlFor="produto-nome" className="text-sm font-medium text-foreground">
            Nome do Produto <span className="text-destructive">*</span>
          </label>
          <Input
            id="produto-nome"
            placeholder="Ex: Álbum 20x30cm"
            value={novoProduto.nome}
            onChange={e => setNovoProduto({ ...novoProduto, nome: e.target.value })}
            className="h-10"
          />
        </div>
        
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[140px] max-w-[180px] space-y-1.5">
            <label htmlFor="produto-custo" className="text-sm font-medium text-foreground">
              Preço de Custo
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                R$
              </span>
              <Input
                id="produto-custo"
                type="number"
                placeholder="0,00"
                value={novoProduto.preco_custo || ''}
                onChange={e => setNovoProduto({ ...novoProduto, preco_custo: Number(e.target.value) })}
                className="h-10 pl-8"
              />
            </div>
          </div>
          
          <div className="flex-1 min-w-[140px] max-w-[180px] space-y-1.5">
            <label htmlFor="produto-venda" className="text-sm font-medium text-foreground">
              Preço de Venda
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                R$
              </span>
              <Input
                id="produto-venda"
                type="number"
                placeholder="0,00"
                value={novoProduto.preco_venda || ''}
                onChange={e => setNovoProduto({ ...novoProduto, preco_venda: Number(e.target.value) })}
                className="h-10 pl-8"
              />
            </div>
          </div>
        </div>
        
        <div className="flex justify-end">
          <Button
            onClick={handleAdicionarProduto}
            disabled={isLoading || novoProduto.nome.trim() === ''}
            className="h-10"
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Produto
          </Button>
        </div>
      </div>

      {/* Lista de Produtos */}
      <div className="space-y-3">
        {produtos.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-border rounded-lg">
            <p className="text-sm text-muted-foreground">
              Nenhum produto cadastrado. Adicione seu primeiro produto acima.
            </p>
          </div>
        ) : isMobile ? (
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
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="grid grid-cols-12 px-4 py-2 border-b border-border bg-muted/50 text-sm font-medium">
              <div className="col-span-5 text-foreground">Produto</div>
              <div className="col-span-2 text-foreground">Custo</div>
              <div className="col-span-2 text-foreground">Venda</div>
              <div className="col-span-2 text-foreground">Margem</div>
              <div className="col-span-1 text-right text-foreground">Ações</div>
            </div>
            
            {produtosComMargem.map(({ produto, margem, canDelete }, index) => (
              <div
                key={produto.id}
                className={cn(
                  "grid grid-cols-12 px-4 py-3 text-sm transition-colors",
                  index % 2 === 0 ? 'bg-background' : 'bg-muted/30',
                  "hover:bg-accent/50"
                )}
              >
                <div className="col-span-5 font-medium">{produto.nome}</div>
                <div className="col-span-2">{formatarMoeda(produto.preco_custo)}</div>
                <div className="col-span-2">
                  {produto.preco_venda ? formatarMoeda(produto.preco_venda) : 'Não definido'}
                </div>
                <div className={cn("col-span-2 font-medium", margem.classe)}>
                  {margem.porcentagem === 'N/A' 
                    ? 'N/A' 
                    : `${formatarMoeda(margem.valor)} (${margem.porcentagem})`
                  }
                </div>
                <div className="flex justify-end gap-1 col-span-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleEditarProduto(produto)}
                    disabled={deletingId === produto.id}
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleRemoverProduto(produto.id)}
                    disabled={!canDelete || deletingId === produto.id}
                    title={!canDelete ? 'Produto usado em pacotes' : 'Remover produto'}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <ProdutoFormModal
        open={modalEditOpen}
        onOpenChange={setModalEditOpen}
        produto={produtoEditando}
        onSave={atualizarProduto}
      />
      
      <ConfirmDialog
        state={dialogState}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        onClose={handleClose}
      />
    </div>
  );
}
