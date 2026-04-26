import { useState, useMemo } from 'react';
import { useContratoTemplates } from '@/hooks/useContratoTemplates';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, Pencil, Trash2, Star, FileText, Sparkles, PackagePlus } from 'lucide-react';
import { ContratoTemplateEditorModal } from '@/components/contratos/ContratoTemplateEditorModal';
import { Badge } from '@/components/ui/badge';
import type { ContratoTemplate } from '@/types/contrato';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { CONTRATO_SEED_TEMPLATES, type ContratoSeedTemplate } from '@/utils/contratoSeedTemplates';
import { toast } from '@/hooks/use-toast';

const normalize = (s?: string | null) =>
  (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();

export default function ContratosConfig() {
  const { templates, isLoading, create, update, remove } = useContratoTemplates();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ContratoTemplate | null>(null);
  const [draftSeed, setDraftSeed] = useState<ContratoSeedTemplate | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ContratoTemplate | null>(null);
  const [bulkAdding, setBulkAdding] = useState(false);

  // Identifica seeds ainda não criados pelo usuário (compara nome ou categoria)
  const existingKeys = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((t) => {
      set.add(normalize(t.nome));
      if (t.categoria) set.add(`cat:${normalize(t.categoria)}`);
    });
    return set;
  }, [templates]);

  const isSeedAlreadyCreated = (seed: ContratoSeedTemplate) =>
    existingKeys.has(normalize(seed.nome)) || existingKeys.has(`cat:${normalize(seed.categoria)}`);

  const seedsFaltando = CONTRATO_SEED_TEMPLATES.filter((s) => !isSeedAlreadyCreated(s));

  const handleNew = () => {
    setEditing(null);
    setDraftSeed(null);
    setEditorOpen(true);
  };

  const handleUseSeed = (seed: ContratoSeedTemplate) => {
    setEditing(null);
    setDraftSeed(seed);
    setEditorOpen(true);
  };

  const handleSave = async (data: any) => {
    if (editing) {
      await update({ id: editing.id, ...data });
    } else {
      await create(data);
    }
    setDraftSeed(null);
  };

  const handleEditorClose = () => {
    setEditorOpen(false);
    setDraftSeed(null);
  };

  const handleAddAllSeeds = async () => {
    const lista = seedsFaltando;
    if (lista.length === 0) {
      toast({ title: 'Tudo certo', description: 'Todos os modelos profissionais já estão na sua lista.' });
      return;
    }
    setBulkAdding(true);
    try {
      let criados = 0;
      for (const seed of lista) {
        // eslint-disable-next-line no-await-in-loop
        await create({
          nome: seed.nome,
          descricao: seed.descricao,
          categoria: seed.categoria,
          conteudo: seed.conteudo,
          is_padrao: false,
        });
        criados += 1;
      }
      toast({ title: `${criados} modelo${criados > 1 ? 's' : ''} adicionado${criados > 1 ? 's' : ''}` });
    } finally {
      setBulkAdding(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold">Modelos de contrato</h3>
          <p className="text-sm text-muted-foreground">Crie modelos reutilizáveis com variáveis dinâmicas.</p>
        </div>
        {templates.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {seedsFaltando.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddAllSeeds}
                disabled={bulkAdding}
                title="Adiciona todos os modelos profissionais que ainda não estão na sua lista"
              >
                <PackagePlus className="h-4 w-4 mr-1" />
                {bulkAdding ? 'Adicionando...' : `Adicionar ${seedsFaltando.length} modelo${seedsFaltando.length > 1 ? 's' : ''} profissional${seedsFaltando.length > 1 ? 'is' : ''}`}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Sparkles className="h-4 w-4 mr-1" />
                  Modelo pronto
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Adicionar modelo profissional</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {CONTRATO_SEED_TEMPLATES.map((seed) => (
                  <DropdownMenuItem key={seed.slug} onClick={() => handleUseSeed(seed)} className="cursor-pointer">
                    <span className="mr-2 text-base">{seed.emoji}</span>
                    <div className="flex flex-col">
                      <span className="font-medium">{seed.nome.replace('Contrato — ', '')}</span>
                      <span className="text-[10px] text-muted-foreground line-clamp-1">{seed.descricao}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={handleNew} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Novo modelo
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>
      ) : templates.length === 0 ? (
        <Card className="p-6 border-dashed">
          <div className="text-center mb-5">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
            <h4 className="font-medium mb-1">Comece com modelos prontos</h4>
            <p className="text-sm text-muted-foreground">
              Modelos profissionais já formatados — adicione todos de uma vez ou escolha um para revisar.
            </p>
          </div>

          <div className="flex justify-center mb-4">
            <Button onClick={handleAddAllSeeds} disabled={bulkAdding}>
              <PackagePlus className="h-4 w-4 mr-1" />
              {bulkAdding ? 'Adicionando...' : `Adicionar os ${CONTRATO_SEED_TEMPLATES.length} modelos profissionais`}
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CONTRATO_SEED_TEMPLATES.map((seed) => (
              <button
                key={seed.slug}
                type="button"
                onClick={() => handleUseSeed(seed)}
                className="text-left p-4 rounded-lg border border-border bg-card hover:border-primary hover:bg-accent/40 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0 group-hover:scale-110 transition-transform">{seed.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <h5 className="font-medium text-sm mb-1">{seed.nome.replace('Contrato — ', '')}</h5>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">{seed.descricao}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-5 pt-4 border-t flex justify-center">
            <Button variant="ghost" onClick={handleNew} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Ou criar do zero
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <Card key={t.id} className="p-4 flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h4 className="font-medium truncate">{t.nome}</h4>
                  {t.is_padrao && (
                    <Badge variant="secondary" className="gap-1">
                      <Star className="h-3 w-3" />
                      Padrão
                    </Badge>
                  )}
                  {t.categoria && t.categoria !== 'geral' && (
                    <Badge variant="outline">{t.categoria}</Badge>
                  )}
                </div>
                {t.descricao && <p className="text-xs text-muted-foreground line-clamp-1">{t.descricao}</p>}
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => { setEditing(t); setDraftSeed(null); setEditorOpen(true); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(t)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ContratoTemplateEditorModal
        open={editorOpen}
        onClose={handleEditorClose}
        template={editing}
        seedDraft={draftSeed}
        onSave={handleSave}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover modelo?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.nome}" será excluído. Contratos já gerados a partir deste modelo permanecerão intactos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (confirmDelete) await remove(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
