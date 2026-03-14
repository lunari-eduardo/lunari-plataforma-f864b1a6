import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useSupabaseTaskStatuses } from '@/hooks/useSupabaseTaskStatuses';
import { useSupabaseTaskPeople } from '@/hooks/useSupabaseTaskPeople';
import { useSupabaseTaskTags } from '@/hooks/useSupabaseTaskTags';
import { useIsMobile } from '@/hooks/use-mobile';
import { useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Compact row for People / Tags ── */
function CompactRow({
  name,
  onNameChange,
  onMoveUp,
  onMoveDown,
  onRemove,
  disableUp,
  disableDown,
  disableRemove,
}: {
  name: string;
  onNameChange: (v: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  disableUp: boolean;
  disableDown: boolean;
  disableRemove?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-muted/40 transition-colors group">
      <Input
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        className="flex-1 h-8 text-sm"
      />
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveUp} disabled={disableUp}>
          <ChevronUp className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveDown} disabled={disableDown}>
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/70 hover:text-destructive" onClick={onRemove} disabled={disableRemove}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/* ── Add form row ── */
function AddRow({ placeholder, onAdd }: { placeholder: string; onAdd: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; onAdd(name.trim()); setName(''); }}
      className="flex items-center gap-2 pt-2"
    >
      <Input placeholder={placeholder} value={name} onChange={(e) => setName(e.target.value)} className="flex-1 h-8 text-sm" />
      <Button type="submit" size="sm" className="h-8 px-3">
        <Plus className="h-3.5 w-3.5 mr-1" />
        Adicionar
      </Button>
    </form>
  );
}

function ManagePeopleSection() {
  const { people, addPerson, updatePerson, removePerson, movePerson } = useSupabaseTaskPeople();

  return (
    <div className="space-y-1">
      <div className="divide-y divide-border/40">
        {people.map((p, idx) => (
          <CompactRow
            key={p.id}
            name={p.name}
            onNameChange={(v) => updatePerson(p.id, { name: v })}
            onMoveUp={() => movePerson(p.id, 'up')}
            onMoveDown={() => movePerson(p.id, 'down')}
            onRemove={() => removePerson(p.id)}
            disableUp={idx === 0}
            disableDown={idx === people.length - 1}
          />
        ))}
        {people.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">Nenhum responsável cadastrado</p>
        )}
      </div>
      <AddRow placeholder="Novo responsável" onAdd={addPerson} />
    </div>
  );
}

function ManageTagsSection() {
  const { tags, addTag, updateTag, removeTag, moveTag } = useSupabaseTaskTags();

  return (
    <div className="space-y-1">
      <div className="divide-y divide-border/40">
        {tags.map((t, idx) => (
          <CompactRow
            key={t.id}
            name={t.name}
            onNameChange={(v) => updateTag(t.id, { name: v })}
            onMoveUp={() => moveTag(t.id, 'up')}
            onMoveDown={() => moveTag(t.id, 'down')}
            onRemove={() => removeTag(t.id)}
            disableUp={idx === 0}
            disableDown={idx === tags.length - 1}
          />
        ))}
        {tags.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma etiqueta cadastrada</p>
        )}
      </div>
      <AddRow placeholder="Nova etiqueta" onAdd={addTag} />
    </div>
  );
}

export default function ManageTaskStatusesModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void; }) {
  const { statuses, addStatus, updateStatus, removeStatus, moveStatus } = useSupabaseTaskStatuses();
  const [newName, setNewName] = useState('');
  const isMobile = useIsMobile();

  const canDelete = useMemo(() => {
    const doneCount = statuses.filter(s => s.isDone).length;
    return (id: string) => {
      const target = statuses.find(s => s.id === id);
      if (!target) return false;
      if (target.isDone && doneCount <= 1) return false;
      return true;
    };
  }, [statuses]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "max-h-[90vh] overflow-y-auto",
        isMobile ? "mx-4 max-w-[calc(100vw-2rem)] p-4" : "sm:max-w-lg"
      )}>
        <DialogHeader>
          <DialogTitle className="text-base">Configurações de Tarefas</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="status" className="w-full">
          <TabsList className="w-full grid grid-cols-3 h-9">
            <TabsTrigger value="status" className="text-xs">Status</TabsTrigger>
            <TabsTrigger value="people" className="text-xs">Responsáveis</TabsTrigger>
            <TabsTrigger value="tags" className="text-xs">Etiquetas</TabsTrigger>
          </TabsList>

          <TabsContent value="status" className="mt-3">
            <p className="text-xs text-muted-foreground mb-3">
              Marque qual coluna representa "Concluído". Pelo menos um status precisa estar marcado.
            </p>
            <div className="divide-y divide-border/40">
              {statuses.map((s, idx) => (
                <div key={s.id} className="flex items-center gap-2.5 py-2.5 px-2 rounded-lg hover:bg-muted/40 transition-colors group">
                  {/* Color dot */}
                  <div
                    className="w-3.5 h-3.5 rounded-full shrink-0 ring-1 ring-black/10 dark:ring-white/10"
                    style={{ backgroundColor: s.color || '#6b7280' }}
                  />

                  {/* Name */}
                  <Input
                    value={s.name}
                    onChange={(e) => updateStatus(s.id, { name: e.target.value })}
                    className="flex-1 h-8 text-sm"
                  />

                  {/* Done switch */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Switch
                      checked={!!s.isDone}
                      onCheckedChange={(v) => updateStatus(s.id, { isDone: v })}
                      className="scale-90"
                    />
                    <Label className="text-2xs text-muted-foreground whitespace-nowrap">
                      {isMobile ? '✓' : 'Concluído'}
                    </Label>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveStatus(s.id, 'up')} disabled={idx === 0}>
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveStatus(s.id, 'down')} disabled={idx === statuses.length - 1}>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive/70 hover:text-destructive"
                      onClick={() => canDelete(s.id) && removeStatus(s.id)}
                      disabled={!canDelete(s.id)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <AddRow placeholder="Novo status" onAdd={(name) => { addStatus(name); setNewName(''); }} />
          </TabsContent>

          <TabsContent value="people" className="mt-3">
            <ManagePeopleSection />
          </TabsContent>

          <TabsContent value="tags" className="mt-3">
            <ManageTagsSection />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
