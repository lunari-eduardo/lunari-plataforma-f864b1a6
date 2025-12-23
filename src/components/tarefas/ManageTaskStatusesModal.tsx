import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useSupabaseTaskStatuses } from '@/hooks/useSupabaseTaskStatuses';
import { useSupabaseTaskPeople } from '@/hooks/useSupabaseTaskPeople';
import { useSupabaseTaskTags } from '@/hooks/useSupabaseTaskTags';
import { useIsMobile } from '@/hooks/use-mobile';
import { useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

function ManagePeopleSection() {
  const { people, addPerson, updatePerson, removePerson, movePerson } = useSupabaseTaskPeople();
  const [name, setName] = useState('');
  const isMobile = useIsMobile();
  
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {people.map((p, idx) => (
          <div key={p.id} className={cn(
            "gap-2",
            isMobile ? "flex flex-col space-y-2" : "flex items-center"
          )}>
            <Input 
              value={p.name} 
              onChange={(e) => updatePerson(p.id, { name: e.target.value })} 
              className="flex-1" 
            />
            <div className="flex items-center justify-end gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className={cn(isMobile ? "h-10 w-10" : "h-8 w-8")} 
                onClick={() => movePerson(p.id, 'up')} 
                disabled={idx===0}
                title="Mover acima"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className={cn(isMobile ? "h-10 w-10" : "h-8 w-8")} 
                onClick={() => movePerson(p.id, 'down')} 
                disabled={idx===people.length-1}
                title="Mover abaixo"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className={cn(isMobile ? "h-10 w-10" : "h-8 w-8")} 
                onClick={() => removePerson(p.id)} 
                title="Remover"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <Separator />
      <form 
        onSubmit={(e)=>{e.preventDefault(); if(!name.trim()) return; addPerson(name.trim()); setName('');}} 
        className={cn(
          "gap-2",
          isMobile ? "flex flex-col space-y-2" : "flex items-center"
        )}
      >
        <Input placeholder="Novo responsável" value={name} onChange={(e)=>setName(e.target.value)} />
        <Button type="submit" className={cn(isMobile && "w-full")}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar
        </Button>
      </form>
    </div>
  );
}

function ManageTagsSection() {
  const { tags, addTag, updateTag, removeTag, moveTag } = useSupabaseTaskTags();
  const [name, setName] = useState('');
  const isMobile = useIsMobile();
  
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {tags.map((t, idx) => (
          <div key={t.id} className={cn(
            "gap-2",
            isMobile ? "flex flex-col space-y-2" : "flex items-center"
          )}>
            <Input 
              value={t.name} 
              onChange={(e)=>updateTag(t.id, { name: e.target.value })} 
              className="flex-1" 
            />
            <div className="flex items-center justify-end gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className={cn(isMobile ? "h-10 w-10" : "h-8 w-8")} 
                onClick={()=>moveTag(t.id,'up')} 
                disabled={idx===0}
                title="Mover acima"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className={cn(isMobile ? "h-10 w-10" : "h-8 w-8")} 
                onClick={()=>moveTag(t.id,'down')} 
                disabled={idx===tags.length-1}
                title="Mover abaixo"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className={cn(isMobile ? "h-10 w-10" : "h-8 w-8")} 
                onClick={()=>removeTag(t.id)} 
                title="Remover"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <Separator />
      <form 
        onSubmit={(e)=>{e.preventDefault(); if(!name.trim()) return; addTag(name.trim()); setName('');}} 
        className={cn(
          "gap-2",
          isMobile ? "flex flex-col space-y-2" : "flex items-center"
        )}
      >
        <Input placeholder="Nova etiqueta" value={name} onChange={(e)=>setName(e.target.value)} />
        <Button type="submit" className={cn(isMobile && "w-full")}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar
        </Button>
      </form>
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
        isMobile ? "mx-4 max-w-[calc(100vw-2rem)] p-4" : "sm:max-w-xl"
      )}>
        <DialogHeader>
          <DialogTitle className="text-base">Gerenciar</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="status" className="w-full">
          <TabsList className={cn(
            "w-full",
            isMobile ? "grid grid-cols-3 text-xs h-8" : "grid grid-cols-3"
          )}>
            <TabsTrigger value="status" className={cn(isMobile && "px-2")}>
              {isMobile ? "Status" : "Status"}
            </TabsTrigger>
            <TabsTrigger value="people" className={cn(isMobile && "px-1")}>
              {isMobile ? "Pessoas" : "Responsáveis"}
            </TabsTrigger>
            <TabsTrigger value="tags" className={cn(isMobile && "px-2")}>
              {isMobile ? "Tags" : "Etiquetas"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="status">
            <div className="space-y-3">
              <p className={cn(
                "text-lunar-textSecondary",
                isMobile ? "text-xs" : "text-2xs"
              )}>
                Marque qual coluna representa "Concluído". Tarefas finalizadas vão para esse status. Pelo menos um status precisa estar marcado.
              </p>
              <div className="space-y-3">
                {statuses.map((s, idx) => (
                  <div key={s.id} className={cn(
                    "gap-2",
                    isMobile ? "flex flex-col space-y-2 p-3 border border-lunar-border/30 rounded-lg" : "flex items-center"
                  )}>
                    {/* Primeira linha: Cor + Nome */}
                    <div className="flex items-center gap-2 w-full">
                      <div 
                        className="w-4 h-4 rounded border border-lunar-border/50 shrink-0" 
                        style={{ backgroundColor: s.color || '#6b7280' }}
                      />
                      {!isMobile && (
                        <input
                          type="color"
                          value={s.color || '#6b7280'}
                          onChange={(e) => updateStatus(s.id, { color: e.target.value })}
                          className="w-8 h-8 rounded border-0 cursor-pointer"
                          title="Escolher cor"
                        />
                      )}
                      <Input
                        value={s.name}
                        onChange={(e) => updateStatus(s.id, { name: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                    
                    {/* Segunda linha: Switch + Botões */}
                    <div className={cn(
                      "flex items-center gap-2",
                      isMobile ? "justify-between w-full" : ""
                    )}>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={!!s.isDone}
                          onCheckedChange={(v) => updateStatus(s.id, { isDone: v })}
                        />
                        <Label className={cn(isMobile ? "text-xs" : "text-2xs")}>Concluído</Label>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={cn(isMobile ? "h-10 w-10" : "h-8 w-8")} 
                          onClick={() => moveStatus(s.id, 'up')} 
                          disabled={idx === 0}
                          title="Mover acima"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={cn(isMobile ? "h-10 w-10" : "h-8 w-8")} 
                          onClick={() => moveStatus(s.id, 'down')} 
                          disabled={idx === statuses.length - 1}
                          title="Mover abaixo"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(isMobile ? "h-10 w-10" : "h-8 w-8")}
                          onClick={() => canDelete(s.id) && removeStatus(s.id)}
                          disabled={!canDelete(s.id)}
                          title={canDelete(s.id) ? 'Remover' : 'Não é possível remover o único status de concluído'}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
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
                className={cn(
                  "gap-2",
                  isMobile ? "flex flex-col space-y-2" : "flex items-center"
                )}
              >
                <Input placeholder="Novo status" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <Button type="submit" className={cn(isMobile && "w-full")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
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
