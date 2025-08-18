import React, { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, useDialogDropdownContext } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Paperclip } from 'lucide-react';

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
import { formatDateForInput, formatDateForStorage } from '@/utils/dateUtils';
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
  const [dueDate, setDueDate] = useState<string>(() => initial?.dueDate ? formatDateForInput(initial.dueDate) : '');
  const [priority, setPriority] = useState<TaskPriority>(initial?.priority ?? 'medium');
  const [status, setStatus] = useState<TaskStatus>(initial?.status ?? 'todo');
  const [assigneeName, setAssigneeName] = useState<string>(initial?.assigneeName ?? '');
  const [selectedTags, setSelectedTags] = useState<string[]>(initial?.tags ?? []);
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});
  const [filesOpen, setFilesOpen] = useState(false);
  
  const dropdownContext = useDialogDropdownContext();

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? '');
      setDescription(initial?.description ?? '');
      setDueDate(initial?.dueDate ? formatDateForInput(initial.dueDate) : '');
      setPriority(initial?.priority ?? 'medium');
      setStatus(initial?.status ?? 'todo');
      setAssigneeName(initial?.assigneeName ?? '');
      setSelectedTags(initial?.tags ?? []);
      setOpenDropdowns({});
      setFilesOpen(false);
    } else {
      // Reset form when modal closes
      setTitle('');
      setDescription('');
      setDueDate('');
      setPriority('medium');
      setStatus('todo');
      setAssigneeName('');
      setSelectedTags([]);
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
    const dueIso = dueDate ? formatDateForStorage(dueDate) : undefined;
    
    const formData = {
      type: 'simple' as const,
      title: title.trim(),
      description: description.trim() || undefined,
      dueDate: dueIso,
      priority,
      status,
      assigneeName: assigneeName.trim() || undefined,
      tags: selectedTags.length ? selectedTags : undefined,
      source: (initial?.source ?? 'manual') as any,
    };
    
    onSubmit(formData as any);
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
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic fields */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Título *</Label>
            <Input 
              id="title" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              required 
              placeholder="Ex.: Ligar para cliente João" 
            />
          </div>
          
          <div className="space-y-1.5">
            <Label htmlFor="description">Descrição</Label>
            <Textarea 
              id="description" 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              placeholder="Detalhes do que deve ser feito"
              rows={3}
            />
          </div>

          {/* Collapsible Files Section */}
          <Collapsible open={filesOpen} onOpenChange={setFilesOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" type="button" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  Arquivos
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${filesOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="p-3 border border-dashed border-lunar-border rounded-lg bg-lunar-background/50">
                <p className="text-xs text-lunar-textSecondary text-center">
                  Clique aqui ou arraste arquivos para anexar
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Common fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="due">Prazo</Label>
              <Input 
                id="due" 
                type="date" 
                value={dueDate} 
                onChange={e => setDueDate(e.target.value)}
              />
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
