import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FolderTree, Pencil, Trash2 } from 'lucide-react';
import type { ItemFinanceiro, GrupoPrincipal } from '@/types/financas';
import { SidePanel } from '@/modules/finance/presentation/shell/SidePanel';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: 'create' | 'edit';
  grupo: GrupoPrincipal;
  item?: ItemFinanceiro | null;

  createName: string;
  editName: string;
  onEditNameChange: (v: string) => void;

  onSubmitCreate: () => Promise<void> | void;
  onSubmitEdit: (id: string) => Promise<void> | void;
  onDelete?: (id: string, nome: string) => Promise<void> | void;
}

function initialOf(name: string) {
  return (name?.trim()?.[0] ?? '·').toUpperCase();
}

export default function CategoriaSideSheet({
  open,
  onOpenChange,
  mode,
  grupo,
  item,
  createName,
  onCreateNameChange: (v: string) => void;
  editName,
  onEditNameChange,
  onSubmitCreate,
  onSubmitEdit,
  onDelete,
}: Props) {
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) setSaving(false);
  }, [open]);

  const displayName = mode === 'edit' ? editName : createName;

  async function handleSave() {
    setSaving(true);
    try {
      if (mode === 'create') {
        await onSubmitCreate();
      } else if (item) {
        await onSubmitEdit(item.id);
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      icone={mode === 'create' ? FolderTree : Pencil}
      titulo={mode === 'create' ? 'Nova categoria' : 'Editar categoria'}
      subtitulo={
        mode === 'create'
          ? 'Cadastre uma nova categoria dentro do grupo selecionado.'
          : 'Atualize as informações da categoria.'
      }
      width="md"
      footer={
        <SidePanel.Footer
          left={
            mode === 'edit' && item && onDelete ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(item.id, item.nome)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-4 mr-1.5" />
                Excluir
              </Button>
            ) : null
          }
          right={
            <>
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !displayName.trim()}>
                {mode === 'create' ? 'Adicionar' : 'Salvar alterações'}
              </Button>
            </>
          }
        />
      }
    >
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-muted grid place-items-center text-sm font-medium text-muted-foreground">
            {initialOf(displayName || (mode === 'create' ? 'N' : item?.nome ?? '·'))}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {displayName || (mode === 'create' ? 'Nova categoria' : item?.nome)}
            </p>
            <p className="text-xs text-muted-foreground truncate">{grupo}</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cat-nome" className="text-xs font-medium text-muted-foreground">
            Nome da categoria
          </Label>
          <Input
            id="cat-nome"
            autoFocus
            value={displayName}
            onChange={(e) =>
              mode === 'create' ? onCreateNameChange(e.target.value) : onEditNameChange(e.target.value)
            }
            placeholder="Ex.: Aluguel, Adobe, Energia elétrica…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSave();
              }
            }}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground">Grupo</Label>
          <Input value={grupo} disabled readOnly />
          <p className="text-xs text-muted-foreground">
            O grupo é definido pela navegação lateral. Para mover a categoria, selecione outro grupo antes de criar.
          </p>
        </div>
      </div>
    </SidePanel>
  );
}
