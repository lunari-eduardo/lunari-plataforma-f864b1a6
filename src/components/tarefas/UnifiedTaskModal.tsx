import React, { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, useDialogDropdownContext } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar, User } from 'lucide-react';

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
import type { Task, TaskPriority, TaskStatus, TaskType, ChecklistItem } from '@/types/tasks';

// Import form components
import TaskTypeSelector from './forms/TaskTypeSelector';
import TaskSimpleForm from './forms/TaskSimpleForm';
import TaskChecklistForm from './forms/TaskChecklistForm';
import TaskContentForm from './forms/TaskContentForm';
import TaskDocumentForm from './forms/TaskDocumentForm';

interface UnifiedTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Omit<Task, 'id' | 'createdAt' | 'source'> & { source?: Task['source'] }) => void;
  initial?: Partial<Task>;
  mode?: 'create' | 'edit';
}

export default function UnifiedTaskModal({ open, onOpenChange, onSubmit, initial, mode = 'create' }: UnifiedTaskModalProps) {
  // Basic form state
  const [taskType, setTaskType] = useState<TaskType>(initial?.type ?? 'simple');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [dueDate, setDueDate] = useState<string>(() => initial?.dueDate ? formatDateForInput(initial.dueDate) : '');
  const [priority, setPriority] = useState<TaskPriority>(initial?.priority ?? 'medium');
  const [status, setStatus] = useState<TaskStatus>(initial?.status ?? 'todo');
  const [assigneeName, setAssigneeName] = useState<string>(initial?.assigneeName ?? '');
  const [selectedTags, setSelectedTags] = useState<string[]>(initial?.tags ?? []);
  
  // Type-specific state
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>(initial?.checklistItems ?? []);
  const [callToAction, setCallToAction] = useState(initial?.callToAction ?? '');
  const [socialPlatforms, setSocialPlatforms] = useState<string[]>(initial?.socialPlatforms ?? []);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});
  const dropdownContext = useDialogDropdownContext();

  useEffect(() => {
    if (open) {
      setTaskType(initial?.type ?? 'simple');
      setTitle(initial?.title ?? '');
      setDescription(initial?.description ?? '');
      setDueDate(initial?.dueDate ? formatDateForInput(initial.dueDate) : '');
      setPriority(initial?.priority ?? 'medium');
      setStatus(initial?.status ?? 'todo');
      setAssigneeName(initial?.assigneeName ?? '');
      setSelectedTags(initial?.tags ?? []);
      setChecklistItems(initial?.checklistItems ?? []);
      setCallToAction(initial?.callToAction ?? '');
      setSocialPlatforms(initial?.socialPlatforms ?? []);
      setOpenDropdowns({});
    } else {
      // Reset form when modal closes
      setTaskType('simple');
      setTitle('');
      setDescription('');
      setDueDate('');
      setPriority('medium');
      setStatus('todo');
      setAssigneeName('');
      setSelectedTags([]);
      setChecklistItems([]);
      setCallToAction('');
      setSocialPlatforms([]);
    }
  }, [open, initial]);

  // Force cleanup on unmount
  useEffect(() => {
    return () => {
      setOpenDropdowns({});
      dropdownContext?.setHasOpenDropdown(false);
    };
  }, [dropdownContext]);

  const { people } = useTaskPeople();
  const { tags: tagDefs } = useTaskTags();

  const handleSelectOpenChange = useCallback((open: boolean, selectType: string) => {
    setOpenDropdowns(prev => ({
      ...prev,
      [selectType]: open
    }));
    dropdownContext?.setHasOpenDropdown(Object.values({...openDropdowns, [selectType]: open}).some(Boolean));
  }, [dropdownContext, openDropdowns]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dueIso = dueDate ? formatDateForStorage(dueDate) : undefined;
    
    const baseData = {
      type: taskType,
      title: title.trim(),
      description: description.trim() || undefined,
      dueDate: dueIso,
      priority,
      status,
      assigneeName: assigneeName.trim() || undefined,
      tags: selectedTags.length ? selectedTags : undefined,
      source: (initial?.source ?? 'manual') as any,
    };

    // Add type-specific fields
    const typeSpecificData: any = {};
    
    if (taskType === 'checklist') {
      typeSpecificData.checklistItems = checklistItems.length ? checklistItems : undefined;
    } else if (taskType === 'content') {
      typeSpecificData.callToAction = callToAction.trim() || undefined;
      typeSpecificData.socialPlatforms = socialPlatforms.length ? socialPlatforms : undefined;
    }
    
    const formData = { ...baseData, ...typeSpecificData };
    
    onSubmit(formData as any);
    onOpenChange(false);
  };

  const handleModalClose = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      setOpenDropdowns({});
      dropdownContext?.setHasOpenDropdown(false);
      
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

  const renderTypeSpecificForm = () => {
    switch (taskType) {
      case 'simple':
        return (
          <TaskSimpleForm 
            title={title}
            setTitle={setTitle}
            description={description}
            setDescription={setDescription}
          />
        );
      case 'checklist':
        return (
          <TaskChecklistForm 
            title={title}
            setTitle={setTitle}
            checklistItems={checklistItems}
            setChecklistItems={setChecklistItems}
          />
        );
      case 'content':
        return (
          <TaskContentForm 
            title={title}
            setTitle={setTitle}
            description={description}
            setDescription={setDescription}
            callToAction={callToAction}
            setCallToAction={setCallToAction}
            hashtags={hashtags}
            setHashtags={setHashtags}
            socialPlatforms={socialPlatforms}
            setSocialPlatforms={setSocialPlatforms}
          />
        );
      case 'document':
        return (
          <TaskDocumentForm 
            title={title}
            setTitle={setTitle}
            description={description}
            setDescription={setDescription}
            attachments={attachments}
            setAttachments={setAttachments}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleModalClose}>
      <DialogContent className="sm:max-w-2xl bg-lunar-surface border-lunar-border max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-xl font-bold text-lunar-text">
            {mode === 'create' ? 'Nova tarefa' : 'Editar tarefa'}
          </DialogTitle>
          <DialogDescription className="text-sm text-lunar-textSecondary">
            Escolha o tipo de tarefa e preencha os detalhes.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Task Type Selector */}
          <TaskTypeSelector value={taskType} onChange={setTaskType} />
          
          {/* Type-specific form */}
          {renderTypeSpecificForm()}

          {/* Common fields: Due Date, Priority, Status, Assignee, Tags */}
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