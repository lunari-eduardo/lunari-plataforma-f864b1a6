import { useCallback, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Plus, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useNovoFinancas } from '@/hooks/useNovoFinancas';
import { useFinancialItemsManagement } from '@/hooks/useFinancialItemsManagement';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/hooks/use-toast';
import type { GrupoPrincipal, ItemFinanceiro } from '@/types/financas';
import CategoriaSideSheet from './CategoriaSideSheet';

interface Props {
  onBack: () => void;
}

interface GrupoConfig {
  value: GrupoPrincipal;
  label: string;
  autoGerenciado: boolean;
}

const GRUPOS: GrupoConfig[] = [
  { value: 'Receita Operacional', label: 'Receitas de vendas', autoGerenciado: true },
  { value: 'Receita Não Operacional', label: 'Outras receitas', autoGerenciado: false },
  { value: 'Despesa Fixa', label: 'Despesas fixas', autoGerenciado: false },
  { value: 'Despesa Variável', label: 'Gastos do dia a dia', autoGerenciado: false },
  { value: 'Investimento', label: 'Investimentos', autoGerenciado: false },
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
  const { toast } = useToast();
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
      'Receita Operacional'
    );
  });

  const [novaCategoriaNome, setNovaCategoriaNome] = useState('');
  const [salvandoRapido, setSalvandoRapido] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<'create' | 'edit'>('edit');
  const [editingItem, setEditingItem] = useState<ItemFinanceiro | null>(null);

  const currentGrupo = useMemo(
    () => GRUPOS.find((g) => g.value === grupoSelecionado) ?? GRUPOS[0],
    [grupoSelecionado]
  );
  const grupoLabel = currentGrupo.label;
  const isAutoGerenciado = currentGrupo.autoGerenciado;
  const grupoCount = countsByGroup[grupoSelecionado] ?? 0;

  const itensDoGrupo = useMemo(() => {
    return itensFinanceiros
      .filter(
        (i) =>
          i.grupo_principal === grupoSelecionado &&
          i.ativo !== false
      )
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [itensFinanceiros, grupoSelecionado]);

  const handleAdicionarRapido = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const nomeTrim = novaCategoriaNome.trim();
    if (!nomeTrim || salvandoRapido || isAutoGerenciado) return;

    const jaExiste = itensFinanceiros.some(
      (i) =>
        i.ativo !== false &&
        i.grupo_principal === grupoSelecionado &&
        normalize(i.nome) === normalize(nomeTrim)
    );

    if (jaExiste) {
      toast({
        title: 'Categoria já existe',
        description: `Já existe uma categoria chamada "${nomeTrim}" neste grupo.`,
        variant: 'destructive',
      });
      return;
    }

    setSalvandoRapido(true);
    try {
      await adicionarItemFinanceiro(nomeTrim, grupoSelecionado);
      setNovaCategoriaNome('');
      toast({
        title: 'Categoria adicionada',
        description: `"${nomeTrim}" foi adicionada com sucesso em ${grupoLabel.toLowerCase()}.`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao adicionar categoria',
        description: error?.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setSalvandoRapido(false);
    }
  };

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
                    setNovaCategoriaNome('');
                  }}
                  className={[
                    'w-full flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-foreground text-background font-medium'
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
                      setNovaCategoriaNome('');
                    }}
                    className={[
                      'shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors border',
                      active
                        ? 'bg-foreground text-background border-foreground font-medium'
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
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">{grupoLabel}</h2>
              {isAutoGerenciado && (
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground border border-border/50">
                  Gerenciada automaticamente
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {isAutoGerenciado
                ? 'Controlada automaticamente pelo sistema a partir dos seus ensaios e vendas'
                : `${grupoCount} ${grupoCount === 1 ? 'categoria cadastrada' : 'categorias cadastradas'}`}
            </p>
          </header>

          {/* Adição rápida inline (apenas para grupos personalizáveis) */}
          {!isAutoGerenciado && (
            <form onSubmit={handleAdicionarRapido} className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
              <div className="relative flex-1">
                <Input
                  value={novaCategoriaNome}
                  onChange={(e) => setNovaCategoriaNome(e.target.value)}
                  placeholder="Nova categoria..."
                  disabled={salvandoRapido}
                  className="bg-muted/40 border-transparent focus-visible:border-border focus-visible:bg-background"
                />
              </div>
              <Button
                type="submit"
                disabled={salvandoRapido || !novaCategoriaNome.trim()}
                className="sm:w-auto w-full shrink-0"
              >
                {salvandoRapido ? (
                  <Loader2 className="size-4 mr-1.5 animate-spin" />
                ) : (
                  <Plus className="size-4 mr-1.5" />
                )}
                Nova categoria
              </Button>
            </form>
          )}

          {/* Estado de Receitas de Vendas (Auto gerenciado) */}
          {isAutoGerenciado ? (
            itensDoGrupo.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 py-12 px-6 text-center bg-card/20">
                <div className="mx-auto size-12 rounded-full bg-accent-gold/10 text-accent-gold flex items-center justify-center mb-3.5 ring-1 ring-accent-gold/20">
                  <Sparkles className="size-5" />
                </div>
                <h3 className="text-base font-medium text-foreground mb-1.5">
                  Categoria gerenciada automaticamente
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                  As receitas de vendas são registradas diretamente através das suas sessões fotográficas, contratos e vendas avulsas. Não é necessário criar categorias manuais neste grupo.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-border/50 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                  Esta categoria é gerenciada automaticamente pelo sistema a partir das sessões e vendas avulsas.
                </div>
                <ul className="divide-y divide-border/40">
                  {itensDoGrupo.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 px-2 py-3">
                      <span className="size-8 rounded-full bg-muted grid place-items-center text-xs font-medium text-muted-foreground shrink-0">
                        {initialOf(item.nome)}
                      </span>
                      <span className="text-sm text-foreground flex-1 truncate">{item.nome}</span>
                      <span className="text-xs text-muted-foreground">Automática</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          ) : itensDoGrupo.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 py-12 px-6 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhuma categoria em {grupoLabel.toLowerCase()}. Digite o nome no campo acima e clique em &ldquo;Nova categoria&rdquo; para adicionar.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {itensDoGrupo.map((item) => (
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
