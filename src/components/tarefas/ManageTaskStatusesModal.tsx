import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useTaskStatuses } from '@/hooks/useTaskStatuses';
import { useTaskPeople } from '@/hooks/useTaskPeople';
import { useTaskTags } from '@/hooks/useTaskTags';
import { useMemo, useState } from 'react';

function ManagePeopleSection() {
  const { people, addPerson, updatePerson, removePerson, movePerson } = useTaskPeople();
  const [name, setName] = useState('');
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {people.map((p, idx) => (
          <div key={p.id} className="flex items-center gap-2">
            <Input value={p.name} onChange={(e) => updatePerson(p.id, { name: e.target.value })} className="flex-1" />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => movePerson(p.id, 'up')} disabled={idx===0}>↑</Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => movePerson(p.id, 'down')} disabled={idx===people.length-1}>↓</Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removePerson(p.id)} title="Remover">×</Button>
          </div>
        ))}
      </div>
      <Separator />
      <form onSubmit={(e)=>{e.preventDefault(); if(!name.trim()) return; addPerson(name.trim()); setName('');}} className="flex items-center gap-2">
        <Input placeholder="Novo responsável" value={name} onChange={(e)=>setName(e.target.value)} />
        <Button type="submit">Adicionar</Button>
      </form>
    </div>
  );
}

function ManageTagsSection() {
  const { tags, addTag, updateTag, removeTag, moveTag } = useTaskTags();
  const [name, setName] = useState('');
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {tags.map((t, idx) => (
          <div key={t.id} className="flex items-center gap-2">
            <Input value={t.name} onChange={(e)=>updateTag(t.id, { name: e.target.value })} className="flex-1" />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={()=>moveTag(t.id,'up')} disabled={idx===0}>↑</Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={()=>moveTag(t.id,'down')} disabled={idx===tags.length-1}>↓</Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={()=>removeTag(t.id)} title="Remover">×</Button>
          </div>
        ))}
      </div>
      <Separator />
      <form onSubmit={(e)=>{e.preventDefault(); if(!name.trim()) return; addTag(name.trim()); setName('');}} className="flex items-center gap-2">
        <Input placeholder="Nova etiqueta" value={name} onChange={(e)=>setName(e.target.value)} />
        <Button type="submit">Adicionar</Button>
      </form>
    </div>
  );
}

export default function ManageTaskStatusesModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void; }) {
  const { statuses, addStatus, updateStatus, removeStatus, moveStatus } = useTaskStatuses();
  const [newName, setNewName] = useState('');

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
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base">Gerenciar</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="status" className="w-full">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="status">Status</TabsTrigger>
            <TabsTrigger value="people">Responsáveis</TabsTrigger>
            <TabsTrigger value="tags">Etiquetas</TabsTrigger>
          </TabsList>

          <TabsContent value="status">
            <div className="space-y-3">
              <p className="text-2xs text-lunar-textSecondary">Marque qual coluna representa "Concluído". Tarefas finalizadas vão para esse status. Pelo menos um status precisa estar marcado.</p>
              <div className="space-y-2">
                {statuses.map((s, idx) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <Input
                      value={s.name}
                      onChange={(e) => updateStatus(s.id, { name: e.target.value })}
                      className="flex-1"
                    />
                    <Switch
                      checked={!!s.isDone}
                      onCheckedChange={(v) => updateStatus(s.id, { isDone: v })}
                    />
                    <Label className="text-2xs">Concluído</Label>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveStatus(s.id, 'up')} disabled={idx === 0}>↑</Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveStatus(s.id, 'down')} disabled={idx === statuses.length - 1}>↓</Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => canDelete(s.id) && removeStatus(s.id)}
                      disabled={!canDelete(s.id)}
                      title={canDelete(s.id) ? 'Remover' : 'Não é possível remover o único status de concluído'}
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>

              <Separator />

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newName.trim()) return;
                  addStatus(newName.trim());
                  setNewName('');
                }}
                className="flex items-center gap-2"
              >
                <Input placeholder="Novo status" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <Button type="submit">Adicionar</Button>
              </form>
            </div>
          </TabsContent>

          <TabsContent value="people">
            <ManagePeopleSection />
          </TabsContent>

          <TabsContent value="tags">
            <ManageTagsSection />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
