import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, useDialogDropdownContext } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CalendarIcon } from 'lucide-react';
import { 
  SelectModal as Select, 
  SelectModalContent as SelectContent, 
  SelectModalItem as SelectItem, 
  SelectModalTrigger as SelectTrigger, 
  SelectModalValue as SelectValue 
} from '@/components/ui/select-in-modal';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTaskPeople } from '@/hooks/useTaskPeople';
import { useTaskTags } from '@/hooks/useTaskTags';
import type { Task, TaskPriority, TaskStatus } from '@/types/tasks';

interface TaskFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Omit<Task, 'id' | 'createdAt' | 'source'> & { source?: Task['source'] }) => void;
  initial?: Partial<Task>;
  mode?: 'create' | 'edit';
}

export default function TaskFormModal({ open, onOpenChange, onSubmit, initial, mode = 'create' }: TaskFormModalProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [dueDate, setDueDate] = useState<string>(() => initial?.dueDate ? initial.dueDate.slice(0, 10) : '');
  const [priority, setPriority] = useState<TaskPriority>(initial?.priority ?? 'medium');
  const [status, setStatus] = useState<TaskStatus>(initial?.status ?? 'todo');
  const [assigneeName, setAssigneeName] = useState<string>(initial?.assigneeName ?? '');
  const [selectedTags, setSelectedTags] = useState<string[]>(initial?.tags ?? []);
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});
  
  const dropdownContext = useDialogDropdownContext();

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? '');
      setDescription(initial?.description ?? '');
      setDueDate(initial?.dueDate ? initial.dueDate.slice(0, 10) : '');
      setPriority(initial?.priority ?? 'medium');
      setStatus(initial?.status ?? 'todo');
      setAssigneeName(initial?.assigneeName ?? '');
      setSelectedTags(initial?.tags ?? []);
      setOpenDropdowns({});
    }
  }, [open, initial]);

  // Force cleanup on unmount
  useEffect(() => {
    return () => {
      // Force close any open dropdowns
      setOpenDropdowns({});
      dropdownContext?.setHasOpenDropdown(false);
      
      // Aggressive cleanup of Radix Select portals
      document.querySelectorAll('[data-radix-select-content]').forEach(el => {
        if (el.parentNode) {
          el.parentNode.removeChild(el);
        }
      });
      
      // Reset pointer events on any stuck overlays
      document.querySelectorAll('[data-radix-select-trigger]').forEach(el => {
        (el as HTMLElement).style.pointerEvents = '';
      });
    };
  }, [dropdownContext]);

  const { people } = useTaskPeople();
  const { tags: tagDefs } = useTaskTags();

  // Prevent modal from closing when clicking on dropdowns
  const handleSelectOpenChange = useCallback((open: boolean, selectType: string) => {
    console.log('🔽 Select open changed:', { selectType, open });
    setOpenDropdowns(prev => ({
      ...prev,
      [selectType]: open
    }));
    dropdownContext?.setHasOpenDropdown(Object.values({...openDropdowns, [selectType]: open}).some(Boolean));
  }, [dropdownContext, openDropdowns]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dueIso = dueDate ? new Date(`${dueDate}T23:59:59`).toISOString() : undefined;
    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      dueDate: dueIso,
      priority,
      status,
      assigneeName: assigneeName.trim() || undefined,
      tags: selectedTags.length ? selectedTags : undefined,
      // allow override but default to manual
      source: (initial?.source ?? 'manual') as any,
    } as any);
    onOpenChange(false);
  };

  const handleModalClose = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      // Force close all dropdowns before closing modal
      setOpenDropdowns({});
      dropdownContext?.setHasOpenDropdown(false);
      
      // Cleanup portal elements immediately
      setTimeout(() => {
        document.querySelectorAll('[data-radix-select-content]').forEach(el => {
          if (el.parentNode) {
            el.parentNode.removeChild(el);
          }
        });
      }, 50);
    }
    onOpenChange(newOpen);
  }, [onOpenChange, dropdownContext]);

  return (
    <Dialog open={open} onOpenChange={handleModalClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">{mode === 'create' ? 'Nova tarefa' : 'Editar tarefa'}</DialogTitle>
          <DialogDescription className="text-xs">Preencha os detalhes da tarefa.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="title">Título</Label>
            <Input id="title" value={title} onChange={e => setTitle(e.target.value)} required placeholder="Ex.: Ligar para cliente" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Descrição</Label>
            <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalhes do que deve ser feito" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="due">Prazo</Label>
              <div className="relative">
                <Input 
                  id="due" 
                  type="date" 
                  value={dueDate} 
                  onChange={e => setDueDate(e.target.value)}
                  className="pr-10"
                />
                <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-lunar-textSecondary pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select 
                value={priority} 
                onValueChange={v => setPriority(v as TaskPriority)}
                onOpenChange={(open) => handleSelectOpenChange(open, 'priority')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select 
                value={status} 
                onValueChange={v => setStatus(v as TaskStatus)}
                onOpenChange={(open) => handleSelectOpenChange(open, 'status')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">A Fazer</SelectItem>
                  <SelectItem value="doing">Em Andamento</SelectItem>
                  <SelectItem value="waiting">Aguardando</SelectItem>
                  <SelectItem value="done">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Responsável</Label>
              <Select 
                value={assigneeName || '__none__'} 
                onValueChange={(v) => setAssigneeName(v === '__none__' ? '' : v)}
                onOpenChange={(open) => handleSelectOpenChange(open, 'assignee')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem responsável</SelectItem>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Etiquetas</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {selectedTags.length ? selectedTags.join(', ') : 'Selecione etiquetas'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="z-[10000] bg-lunar-bg w-[var(--radix-select-trigger-width,16rem)] min-w-[12rem]">
                {tagDefs.length ? (
                  tagDefs.map((tag) => (
                    <DropdownMenuCheckboxItem
                      key={tag.id}
                      checked={selectedTags.includes(tag.name)}
                      onCheckedChange={(checked) => {
                        setSelectedTags((prev) =>
                          checked ? [...prev, tag.name] : prev.filter((t) => t !== tag.name)
                        )
                      }}
                    >
                      {tag.name}
                    </DropdownMenuCheckboxItem>
                  ))
                ) : (
                  <div className="px-3 py-2 text-2xs text-lunar-textSecondary">Nenhuma etiqueta cadastrada.</div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <p className="text-2xs text-lunar-textSecondary">Gerencie as opções em "Gerenciar".</p>
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit">{mode === 'create' ? 'Criar' : 'Salvar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
