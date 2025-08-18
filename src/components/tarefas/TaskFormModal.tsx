import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, useDialogDropdownContext } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles } from 'lucide-react';

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
import TemplateSelector from './TemplateSelector';
import { useTaskTemplates, type TaskTemplate } from '@/hooks/useTaskTemplates';
import TaskTypeSelector from './TaskTypeSelector';
import TaskSimpleForm from './forms/TaskSimpleForm';
import TaskContentForm from './forms/TaskContentForm';
import TaskChecklistForm from './forms/TaskChecklistForm';
import TaskDocumentForm from './forms/TaskDocumentForm';

interface TaskFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Omit<Task, 'id' | 'createdAt' | 'source'> & { source?: Task['source'] }) => void;
  initial?: Partial<Task>;
  mode?: 'create' | 'edit';
}

export default function TaskFormModal({ open, onOpenChange, onSubmit, initial, mode = 'create' }: TaskFormModalProps) {
  const [taskType, setTaskType] = useState<TaskType>(initial?.type ?? 'simple');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [dueDate, setDueDate] = useState<string>(() => initial?.dueDate ? formatDateForInput(initial.dueDate) : '');
  const [priority, setPriority] = useState<TaskPriority>(initial?.priority ?? 'medium');
  const [status, setStatus] = useState<TaskStatus>(initial?.status ?? 'todo');
  const [assigneeName, setAssigneeName] = useState<string>(initial?.assigneeName ?? '');
  const [selectedTags, setSelectedTags] = useState<string[]>(initial?.tags ?? []);
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [templateData, setTemplateData] = useState<Partial<Task> | null>(null);
  
  // Content-specific fields
  const [callToAction, setCallToAction] = useState(initial?.callToAction ?? '');
  const [hashtags, setHashtags] = useState<string[]>(initial?.captions?.[0]?.hashtags ?? []);
  const [socialPlatforms, setSocialPlatforms] = useState<string[]>(initial?.socialPlatforms ?? ['instagram']);
  
  // Checklist-specific fields
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>(initial?.checklistItems ?? []);
  
  // Document-specific fields
  const [attachments, setAttachments] = useState<any[]>(initial?.attachments ?? []);
  
  const dropdownContext = useDialogDropdownContext();

  useEffect(() => {
    if (open) {
      // Template data takes priority over initial data
      const data = templateData || initial;
      setTaskType(data?.type ?? 'simple');
      setTitle(data?.title ?? '');
      setDescription(data?.description ?? '');
      setDueDate(data?.dueDate ? formatDateForInput(data.dueDate) : '');
      setPriority(data?.priority ?? 'medium');
      setStatus(data?.status ?? 'todo');
      setAssigneeName(data?.assigneeName ?? '');
      setSelectedTags(data?.tags ?? []);
      setCallToAction(data?.callToAction ?? '');
      setHashtags(data?.captions?.[0]?.hashtags ?? []);
      setSocialPlatforms(data?.socialPlatforms ?? ['instagram']);
      setChecklistItems(data?.checklistItems ?? []);
      setAttachments(data?.attachments ?? []);
      setOpenDropdowns({});
      
      console.log('🎯 TaskFormModal: Aplicando dados do template/inicial:', {
        hasTemplateData: !!templateData,
        hasInitial: !!initial,
        type: data?.type,
        title: data?.title,
        attachments: data?.attachments?.length || 0,
        captions: data?.captions?.length || 0
      });
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
      setCallToAction('');
      setHashtags([]);
      setSocialPlatforms(['instagram']);
      setChecklistItems([]);
      setAttachments([]);
      setTemplateData(null);
    }
  }, [open, initial, templateData]);

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
  const { applyTemplate } = useTaskTemplates();

  // Prevent modal from closing when clicking on dropdowns
  const handleSelectOpenChange = useCallback((open: boolean, selectType: string) => {
    console.log('🔽 Select open changed:', { selectType, open });
    setOpenDropdowns(prev => ({
      ...prev,
      [selectType]: open
    }));
    dropdownContext?.setHasOpenDropdown(Object.values({...openDropdowns, [selectType]: open}).some(Boolean));
  }, [dropdownContext, openDropdowns]);

  const handleTemplateSelect = useCallback((template: TaskTemplate, variables: Record<string, string>) => {
    const applied = applyTemplate(template.id, variables);
    setTemplateData(applied);
    setTaskType(template.taskType); // Update task type based on template
    setShowTemplateSelector(false);
  }, [applyTemplate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dueIso = dueDate ? formatDateForStorage(dueDate) : undefined;
    
    // Base form data
    const formData = {
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
    
    // Add type-specific data
    const typeSpecificData: any = {};
    
    if (taskType === 'content') {
      typeSpecificData.callToAction = callToAction.trim() || undefined;
      typeSpecificData.socialPlatforms = socialPlatforms.length ? socialPlatforms : undefined;
      if (hashtags.length > 0) {
        typeSpecificData.captions = [{
          id: `cap_${Date.now()}`,
          title: 'Post Principal',
          content: description,
          hashtags,
          platform: 'general',
          createdAt: new Date().toISOString()
        }];
      }
    }
    
    if (taskType === 'checklist') {
      typeSpecificData.checklistItems = checklistItems;
    }
    
    if (taskType === 'document') {
      typeSpecificData.attachments = attachments;
    }
    
    // Merge all data
    const finalData = {
      ...formData,
      ...typeSpecificData,
      ...(templateData?.estimatedHours && { estimatedHours: templateData.estimatedHours }),
    };
    
    console.log('📝 TaskFormModal: Submetendo tarefa:', {
      taskType,
      formData,
      typeSpecificData,
      finalData
    });
    
    onSubmit(finalData as any);
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
    <>
      <Dialog open={open} onOpenChange={handleModalClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-base">{mode === 'create' ? 'Nova tarefa' : 'Editar tarefa'}</DialogTitle>
                <DialogDescription className="text-xs">Preencha os detalhes da tarefa.</DialogDescription>
              </div>
              {mode === 'create' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTemplateSelector(true)}
                  className="flex items-center gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  Templates
                </Button>
              )}
            </div>
          </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <TaskTypeSelector
            value={taskType}
            onValueChange={setTaskType}
            onOpenChange={(open) => handleSelectOpenChange(open, 'taskType')}
          />
          
          {/* Dynamic form based on task type */}
          {taskType === 'simple' && (
            <TaskSimpleForm
              title={title}
              setTitle={setTitle}
              description={description}
              setDescription={setDescription}
            />
          )}
          
          {taskType === 'content' && (
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
          )}
          
          {taskType === 'checklist' && (
            <TaskChecklistForm
              title={title}
              setTitle={setTitle}
              checklistItems={checklistItems}
              setChecklistItems={setChecklistItems}
            />
          )}
          
          {taskType === 'document' && (
            <TaskDocumentForm
              title={title}
              setTitle={setTitle}
              description={description}
              setDescription={setDescription}
              attachments={attachments}
              setAttachments={setAttachments}
            />
          )}
          {/* Common fields for all task types */}
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
    
    <TemplateSelector
      open={showTemplateSelector}
      onOpenChange={setShowTemplateSelector}
      onSelectTemplate={handleTemplateSelect}
    />
    </>
  );
}
