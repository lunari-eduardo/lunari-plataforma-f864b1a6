import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Edit, Trash2, Star } from 'lucide-react';
import { useCurrencyInput } from '@/hooks/useCurrencyInput';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useRealtimeConfiguration } from '@/hooks/useRealtimeConfiguration';
import { useProdutoEtiquetas } from '@/hooks/useProdutoEtiquetas';
import { formatarMoeda } from '@/utils/precificacaoUtils';
import { calcularMargemLucro } from '@/utils/productUtils';
import { sortProdutos } from '@/utils/produtoSort';
import { filterProdutos } from '@/utils/produtoFilters';
import ConfigSectionHeader from './ConfigSectionHeader';
import ProdutoFormModal from './ProdutoFormModal';
import ProdutoCard from './ProdutoCard';
import EtiquetasManagerModal from './EtiquetasManagerModal';
import ProdutosToolbar from './ProdutosToolbar';
import { ProdutoEtiquetasPopover } from './ProdutoEtiquetasPopover';
import { FavoriteStarToggle } from '@/components/ui/favorite-star-toggle';
import { EtiquetaChip } from '@/components/ui/etiqueta-chip';
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

  const {
    etiquetas,
    linksByProduto,
    contagemPorEtiqueta,
    setProdutoEtiquetas,
  } = useProdutoEtiquetas();

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

  const [novoProduto, setNovoProduto] = useState({ nome: '', preco_custo: 0, preco_venda: 0 });
  const custoInput = useCurrencyInput({
    value: novoProduto.preco_custo,
    onChange: (v) => setNovoProduto(prev => ({ ...prev, preco_custo: v }))
  });
  const vendaInput = useCurrencyInput({
    value: novoProduto.preco_venda,
    onChange: (v) => setNovoProduto(prev => ({ ...prev, preco_venda: v }))
  });

  const [produtoEditando, setProdutoEditando] = useState<Produto | null>(null);
  const [modalEditOpen, setModalEditOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);

  // Filtros
  const [query, setQuery] = useState('');
  const [selectedEtiquetaIds, setSelectedEtiquetaIds] = useState<string[]>([]);
  const [onlyFavoritos, setOnlyFavoritos] = useState(false);

  // Hidratar produtos com etiquetas
  const produtosHidratados = useMemo(() => {
    const etiquetaById = new Map(etiquetas.map(e => [e.id, e]));
    return produtos.map(p => ({
      ...p,
      etiquetas: (linksByProduto.get(p.id) ?? [])
        .map(id => etiquetaById.get(id))
        .filter((e): e is NonNullable<typeof e> => Boolean(e)),
    }));
  }, [produtos, etiquetas, linksByProduto]);

  const produtosFiltradosOrdenados = useMemo(() => {
    const filtered = filterProdutos(produtosHidratados, {
      query,
      etiquetaIds: selectedEtiquetaIds,
      onlyFavoritos,
    });
    return [...filtered].sort(sortProdutos);
  }, [produtosHidratados, query, selectedEtiquetaIds, onlyFavoritos]);

  const produtosComMargem = useMemo(() => {
    return produtosFiltradosOrdenados.map(produto => ({
      produto,
      margem: calcularMargemProduto(produto.preco_custo, produto.preco_venda),
      canDelete: podeRemoverProduto(produto.id),
    }));
  }, [produtosFiltradosOrdenados, calcularMargemProduto, podeRemoverProduto]);

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

  const handleToggleFavorito = useCallback(async (produto: Produto) => {
    await atualizarProduto(produto.id, { favorito: !produto.favorito });
  }, [atualizarProduto]);

  const handleToggleEtiquetaFiltro = useCallback((id: string) => {
    setSelectedEtiquetaIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

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

        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[140px] max-w-[180px] space-y-1.5">
            <label htmlFor="produto-custo" className="text-sm font-medium text-foreground">Preço de Custo</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
              <Input id="produto-custo" {...custoInput.inputProps} placeholder="0,00" className="h-10 pl-8" />
            </div>
          </div>
          <div className="flex-1 min-w-[140px] max-w-[180px] space-y-1.5">
            <label htmlFor="produto-venda" className="text-sm font-medium text-foreground">Preço de Venda</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
              <Input id="produto-venda" {...vendaInput.inputProps} placeholder="0,00" className="h-10 pl-8" />
            </div>
          </div>
          <Button onClick={handleAdicionarProduto} disabled={isLoading || novoProduto.nome.trim() === ''} className="h-10">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Produto
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      {produtos.length > 0 && (
        <ProdutosToolbar
          query={query}
          onQueryChange={setQuery}
          etiquetas={etiquetas}
          selectedEtiquetaIds={selectedEtiquetaIds}
          onToggleEtiqueta={handleToggleEtiquetaFiltro}
          contagemPorEtiqueta={contagemPorEtiqueta}
          onlyFavoritos={onlyFavoritos}
          onToggleOnlyFavoritos={() => setOnlyFavoritos(v => !v)}
          onOpenManager={() => setManagerOpen(true)}
          totalProdutos={produtos.length}
          totalFiltrados={produtosFiltradosOrdenados.length}
        />
      )}

      {/* Lista */}
      <div className="space-y-3">
        {produtos.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-border rounded-lg">
            <p className="text-sm text-muted-foreground">
              Nenhum produto cadastrado. Adicione seu primeiro produto acima.
            </p>
          </div>
        ) : produtosComMargem.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-border rounded-lg">
            <p className="text-sm text-muted-foreground">
              Nenhum produto corresponde aos filtros.
            </p>
            <button
              type="button"
              className="text-xs text-primary hover:underline mt-2"
              onClick={() => { setQuery(''); setSelectedEtiquetaIds([]); setOnlyFavoritos(false); }}
            >
              Limpar filtros
            </button>
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
                onToggleFavorito={() => handleToggleFavorito(produto)}
                etiquetas={etiquetas}
                selectedEtiquetaIds={linksByProduto.get(produto.id) ?? []}
                onChangeEtiquetas={(ids) => setProdutoEtiquetas(produto.id, ids)}
                canDelete={canDelete}
                isDeleting={deletingId === produto.id}
              />
            ))}
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="grid grid-cols-14 px-4 py-2 border-b border-border bg-muted/50 text-sm font-medium" style={{ gridTemplateColumns: '32px 4fr 3fr 1.5fr 1.5fr 2fr 100px' }}>
              <div></div>
              <div className="text-foreground">Produto</div>
              <div className="text-foreground">Etiquetas</div>
              <div className="text-foreground">Custo</div>
              <div className="text-foreground">Venda</div>
              <div className="text-foreground">Margem</div>
              <div className="text-right text-foreground">Ações</div>
            </div>

            {produtosComMargem.map(({ produto, margem, canDelete }, index) => {
              const selectedIds = linksByProduto.get(produto.id) ?? [];
              return (
                <div
                  key={produto.id}
                  className={cn(
                    "grid px-4 py-2.5 text-sm transition-colors items-center relative",
                    index % 2 === 0 ? 'bg-background' : 'bg-muted/30',
                    "hover:bg-accent/50",
                    produto.favorito && 'bg-amber-500/[0.03] dark:bg-amber-500/[0.05]'
                  )}
                  style={{ gridTemplateColumns: '32px 4fr 3fr 1.5fr 1.5fr 2fr 100px' }}
                >
                  {produto.favorito && (
                    <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-400/60" aria-hidden />
                  )}
                  <FavoriteStarToggle
                    favorito={!!produto.favorito}
                    onToggle={() => handleToggleFavorito(produto)}
                    size="sm"
                  />
                  <div className="font-medium truncate pr-2">{produto.nome}</div>
                  <div className="flex flex-wrap gap-1 pr-2">
                    {(produto.etiquetas ?? []).slice(0, 3).map(et => (
                      <EtiquetaChip
                        key={et.id}
                        etiqueta={et}
                        size="xs"
                        active={selectedEtiquetaIds.includes(et.id)}
                        onClick={() => handleToggleEtiquetaFiltro(et.id)}
                      />
                    ))}
                    {(produto.etiquetas?.length ?? 0) > 3 && (
                      <span className="text-[10px] text-muted-foreground self-center">
                        +{(produto.etiquetas!.length - 3)}
                      </span>
                    )}
                    {(produto.etiquetas?.length ?? 0) === 0 && (
                      <span className="text-[11px] text-muted-foreground/60 italic">—</span>
                    )}
                  </div>
                  <div>{formatarMoeda(produto.preco_custo)}</div>
                  <div>{produto.preco_venda ? formatarMoeda(produto.preco_venda) : 'Não definido'}</div>
                  <div className={cn("font-medium", margem.classe)}>
                    {margem.porcentagem === 'N/A'
                      ? 'N/A'
                      : `${formatarMoeda(margem.valor)} (${margem.porcentagem})`
                    }
                  </div>
                  <div className="flex justify-end gap-0.5">
                    <ProdutoEtiquetasPopover
                      produtoId={produto.id}
                      etiquetas={etiquetas}
                      selectedIds={selectedIds}
                      onChange={(ids) => setProdutoEtiquetas(produto.id, ids)}
                    />
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
              );
            })}
          </div>
        )}
      </div>

      <ProdutoFormModal
        open={modalEditOpen}
        onOpenChange={setModalEditOpen}
        produto={produtoEditando}
        onSave={atualizarProduto}
        etiquetas={etiquetas}
        selectedEtiquetaIds={produtoEditando ? (linksByProduto.get(produtoEditando.id) ?? []) : []}
        onChangeEtiquetas={(ids) => produtoEditando && setProdutoEtiquetas(produtoEditando.id, ids)}
      />

      <EtiquetasManagerModal open={managerOpen} onOpenChange={setManagerOpen} />

      <ConfirmDialog
        state={dialogState}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        onClose={handleClose}
      />
    </div>
  );
}
