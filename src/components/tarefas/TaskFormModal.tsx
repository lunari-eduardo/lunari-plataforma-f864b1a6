import React, { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, useDialogDropdownContext } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Paperclip, Calendar, User } from 'lucide-react';

import { 
  SelectModal as Select, 
  SelectModalContent as SelectContent, 
  SelectModalItem as SelectItem, 
  SelectModalTrigger as SelectTrigger, 
  SelectModalValue as SelectValue 
} from '@/components/ui/select-in-modal';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useSupabaseTaskPeople } from '@/hooks/useSupabaseTaskPeople';
import { useSupabaseTaskTags } from '@/hooks/useSupabaseTaskTags';
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

  const { people } = useSupabaseTaskPeople();
  const { tags: tagDefs } = useSupabaseTaskTags();

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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const priorityLabels = {
    low: 'Baixa',
    medium: 'Média', 
    high: 'Alta'
  };

  return (
    <Dialog open={open} onOpenChange={handleModalClose}>
        <DialogContent className="sm:max-w-xl bg-lunar-surface border-lunar-border z-[200]">
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-xl font-bold text-lunar-text">
              {mode === 'create' ? 'Nova tarefa' : 'Editar tarefa'}
            </DialogTitle>
            <DialogDescription className="text-sm text-lunar-textSecondary">
              Preencha os detalhes da tarefa.
            </DialogDescription>
          </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title - Large and prominent */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-base font-medium text-lunar-text">Título</Label>
            <Input 
              id="title" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              required 
              placeholder="Ex.: Ligar para cliente João"
              className="text-lg bg-lunar-background border-lunar-border" 
            />
          </div>
          
          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-base font-medium text-lunar-text">Descrição</Label>
            <Textarea 
              id="description" 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              placeholder="Detalhes do que deve ser feito"
              rows={4}
              className="bg-lunar-background border-lunar-border"
            />
          </div>

          {/* Collapsible Files Section */}
          <Collapsible open={filesOpen} onOpenChange={setFilesOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" type="button" className="w-full justify-between bg-lunar-background border-lunar-border hover:bg-lunar-background/80">
                <span className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  Arquivos
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${filesOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <div className="p-4 border border-dashed border-lunar-border rounded-lg bg-lunar-background/50">
                <p className="text-sm text-lunar-textSecondary text-center">
                  Clique aqui ou arraste arquivos para anexar
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Top row: Due Date and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-base font-medium text-lunar-text flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Prazo
              </Label>
              <Input 
                type="date" 
                value={dueDate} 
                onChange={e => setDueDate(e.target.value)}
                className="bg-lunar-background border-lunar-border"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-base font-medium text-lunar-text">Prioridade</Label>
              <Select 
                value={priority} 
                onValueChange={v => setPriority(v as TaskPriority)}
                onOpenChange={(open) => handleSelectOpenChange(open, 'priority')}
              >
                <SelectTrigger className="bg-lunar-background border-lunar-border">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${getPriorityColor(priority)}`} />
                    <SelectValue placeholder="Selecione prioridade" />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-lunar-surface border-lunar-border">
                  <SelectItem value="low">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      Baixa
                    </div>
                  </SelectItem>
                  <SelectItem value="medium">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      Média
                    </div>
                  </SelectItem>
                  <SelectItem value="high">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      Alta
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Second row: Status and Assignee */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-base font-medium text-lunar-text">Status</Label>
              <Select 
                value={status} 
                onValueChange={v => setStatus(v as TaskStatus)}
                onOpenChange={(open) => handleSelectOpenChange(open, 'status')}
              >
                <SelectTrigger className="bg-lunar-background border-lunar-border">
                  <SelectValue placeholder="Selecione status" />
                </SelectTrigger>
                <SelectContent className="bg-lunar-surface border-lunar-border">
                  <SelectItem value="todo">A Fazer</SelectItem>
                  <SelectItem value="doing">Em Andamento</SelectItem>
                  <SelectItem value="waiting">Aguardando</SelectItem>
                  <SelectItem value="done">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-base font-medium text-lunar-text flex items-center gap-2">
                <User className="w-4 h-4" />
                Responsável
              </Label>
              <Select 
                value={assigneeName || '__none__'} 
                onValueChange={(v) => setAssigneeName(v === '__none__' ? '' : v)}
                onOpenChange={(open) => handleSelectOpenChange(open, 'assignee')}
              >
                <SelectTrigger className="bg-lunar-background border-lunar-border">
                  {assigneeName ? (
                    <Badge variant="secondary" className="text-sm">
                      {assigneeName}
                    </Badge>
                  ) : (
                    <SelectValue placeholder="Selecione responsável" />
                  )}
                </SelectTrigger>
                <SelectContent className="bg-lunar-surface border-lunar-border">
                  <SelectItem value="__none__">Sem responsável</SelectItem>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label className="text-base font-medium text-lunar-text">Etiquetas</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between bg-lunar-background border-lunar-border hover:bg-lunar-background/80">
                  <div className="flex flex-wrap gap-1">
                    {selectedTags.length ? (
                      selectedTags.map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-lunar-textSecondary">Selecione etiquetas</span>
                    )}
                  </div>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="z-[10000] bg-lunar-surface border-lunar-border w-[var(--radix-select-trigger-width,16rem)] min-w-[12rem]">
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
                  <div className="px-3 py-2 text-sm text-lunar-textSecondary">Nenhuma etiqueta cadastrada.</div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="flex-1 bg-lunar-background border-lunar-border hover:bg-lunar-background/80"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              className="flex-1"
            >
              {mode === 'create' ? 'Criar Tarefa' : 'Salvar Alterações'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
