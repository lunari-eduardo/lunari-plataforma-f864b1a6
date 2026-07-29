import { useCallback, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useNovoFinancas } from '@/hooks/useNovoFinancas';
import { useFinancialItemsManagement } from '@/hooks/useFinancialItemsManagement';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { GrupoPrincipal, ItemFinanceiro } from '@/types/financas';
import CategoriaSideSheet from './CategoriaSideSheet';

interface Props {
  onBack: () => void;
}

const GRUPOS: { value: GrupoPrincipal; label: string }[] = [
  { value: 'Receita Operacional', label: 'Receitas Operacionais' },
  { value: 'Receita Não Operacional', label: 'Receitas Não Operacionais' },
  { value: 'Despesa Fixa', label: 'Despesas Fixas' },
  { value: 'Despesa Variável', label: 'Despesas Variáveis' },
  { value: 'Investimento', label: 'Investimentos' },
];

function normalize(v: string) {
  return v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function initialOf(name: string) {
  return (name?.trim()?.[0] ?? '·').toUpperCase();
}

export default function CategoriasPanel({ onBack }: Props) {
  const {
    itensFinanceiros,
    adicionarItemFinanceiro,
    removerItemFinanceiro,
    atualizarItemFinanceiro,
  } = useNovoFinancas();

  const itemsManagement = useFinancialItemsManagement({
    itensFinanceiros,
    adicionarItemFinanceiro,
    removerItemFinanceiro,
    atualizarItemFinanceiro,
  });

  const { dialogState, confirm, handleConfirm, handleCancel, handleClose } = useConfirmDialog();

  const countsByGroup = useMemo(() => {
    const counts: Record<GrupoPrincipal, number> = {
      'Receita Operacional': 0,
      'Receita Não Operacional': 0,
      'Despesa Fixa': 0,
      'Despesa Variável': 0,
      'Investimento': 0,
    };
    for (const item of itensFinanceiros) {
      if (item.ativo === false) continue;
      counts[item.grupo_principal] = (counts[item.grupo_principal] ?? 0) + 1;
    }
    return counts;
  }, [itensFinanceiros]);

  const [grupoSelecionado, setGrupoSelecionado] = useState<GrupoPrincipal>(() => {
    return (
      GRUPOS.map((g) => g.value).find((g) => (countsByGroup[g] ?? 0) > 0) ??
      'Despesa Fixa'
    );
  });

  const [query, setQuery] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<'create' | 'edit'>('create');
  const [editingItem, setEditingItem] = useState<ItemFinanceiro | null>(null);

  const grupoLabel = GRUPOS.find((g) => g.value === grupoSelecionado)?.label ?? '';
  const grupoCount = countsByGroup[grupoSelecionado] ?? 0;

  const filteredItems = useMemo(() => {
    const q = normalize(query);
    return itensFinanceiros
      .filter(
        (i) =>
          i.grupo_principal === grupoSelecionado &&
          i.ativo !== false &&
          (q.length === 0 || normalize(i.nome).includes(q))
      )
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [itensFinanceiros, grupoSelecionado, query]);

  const openCreate = useCallback(() => {
    itemsManagement.updateItemState({ novoNome: '', novoGrupo: grupoSelecionado });
    setSheetMode('create');
    setEditingItem(null);
    setSheetOpen(true);
  }, [grupoSelecionado, itemsManagement]);

  const openEdit = useCallback(
    (item: ItemFinanceiro) => {
      itemsManagement.handleEditarItem(item);
      setSheetMode('edit');
      setEditingItem(item);
      setSheetOpen(true);
    },
    [itemsManagement]
  );

  const handleDelete = useCallback(
    async (id: string, nome: string) => {
      const ok = await confirm({
        title: 'Excluir categoria',
        description: `"${nome}" será removida definitivamente. Todos os lançamentos vinculados também serão apagados. Esta ação não pode ser desfeita.`,
        confirmText: 'Excluir definitivamente',
        cancelText: 'Cancelar',
        variant: 'destructive',
      });
      if (ok) {
        await itemsManagement.handleRemoverItem(id);
        setSheetOpen(false);
      }
    },
    [confirm, itemsManagement]
  );

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft className="size-4" />
        Voltar para Gerenciar
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6 lg:gap-10">
        {/* Sidebar (desktop) */}
        <aside className="hidden lg:block">
          <nav className="space-y-0.5">
            {GRUPOS.map((g) => {
              const active = g.value === grupoSelecionado;
              const count = countsByGroup[g.value] ?? 0;
              return (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => {
                    setGrupoSelecionado(g.value);
                    setQuery('');
                  }}
                  className={[
                    'w-full flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                  ].join(' ')}
                >
                  <span className="truncate">{g.label}</span>
                  <span className={active ? 'text-background/70 text-xs' : 'text-muted-foreground/70 text-xs'}>
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Sidebar (mobile - horizontal chips) */}
        <div className="lg:hidden">
          <ScrollArea className="w-full">
            <div className="flex items-center gap-2 pb-3">
              {GRUPOS.map((g) => {
                const active = g.value === grupoSelecionado;
                const count = countsByGroup[g.value] ?? 0;
                return (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => {
                      setGrupoSelecionado(g.value);
                      setQuery('');
                    }}
                    className={[
                      'shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors border',
                      active
                        ? 'bg-foreground text-background border-foreground'
                        : 'bg-transparent text-muted-foreground border-border hover:text-foreground',
                    ].join(' ')}
                  >
                    <span>{g.label}</span>
                    <span className={active ? 'text-background/70' : 'text-muted-foreground/70'}>{count}</span>
                  </button>
                );
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>

        {/* Main area */}
        <section className="min-w-0">
          <header className="mb-6">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">{grupoLabel}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {grupoCount} {grupoCount === 1 ? 'categoria cadastrada' : 'categorias cadastradas'}
            </p>
          </header>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar categoria..."
                className="pl-9 bg-muted/40 border-transparent focus-visible:border-border focus-visible:bg-background"
              />
            </div>
            <Button onClick={openCreate} className="sm:w-auto w-full">
              <Plus className="size-4 mr-1.5" />
              Nova categoria
            </Button>
          </div>

          {filteredItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 py-12 text-center">
              <p className="text-sm text-muted-foreground mb-4">
                {query
                  ? 'Nenhuma categoria encontrada para a busca.'
                  : `Nenhuma categoria em ${grupoLabel.toLowerCase()}.`}
              </p>
              {!query && (
                <Button variant="outline" onClick={openCreate}>
                  <Plus className="size-4 mr-1.5" />
                  Criar primeira categoria
                </Button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {filteredItems.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    className="w-full flex items-center gap-3 px-2 py-3 rounded-md hover:bg-muted/40 transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    <span className="size-8 rounded-full bg-muted grid place-items-center text-xs font-medium text-muted-foreground shrink-0">
                      {initialOf(item.nome)}
                    </span>
                    <span className="text-sm text-foreground flex-1 truncate">{item.nome}</span>
                    <ChevronRight className="size-4 text-muted-foreground/70 shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <CategoriaSideSheet
        open={sheetOpen}
        onOpenChange={(v) => {
          setSheetOpen(v);
          if (!v) itemsManagement.handleCancelarEdicao();
        }}
        mode={sheetMode}
        grupo={grupoSelecionado}
        item={editingItem}
        createName={itemsManagement.itemState.novoNome}
        onCreateNameChange={(v) => itemsManagement.updateItemState({ novoNome: v })}
        editName={itemsManagement.itemState.nomeEditando}
        onEditNameChange={(v) => itemsManagement.updateItemState({ nomeEditando: v })}
        onSubmitCreate={itemsManagement.handleAdicionarItem}
        onSubmitEdit={itemsManagement.handleSalvarEdicao}
        onDelete={handleDelete}
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
