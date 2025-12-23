import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  SelectModal as Select, 
  SelectModalContent as SelectContent, 
  SelectModalItem as SelectItem, 
  SelectModalTrigger as SelectTrigger, 
  SelectModalValue as SelectValue 
} from '@/components/ui/select-in-modal';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Edit3, Trash2, Calendar, FileText, ChevronDown, CheckSquare, X, Save, User } from 'lucide-react';
import type { Task, TaskPriority, TaskStatus } from '@/types/tasks';
import { formatDateForDisplay, formatDateForInput, formatDateForStorage } from '@/utils/dateUtils';
import TaskAttachmentsSection from './TaskAttachmentsSection';
import RichTextPreview from '@/components/ui/rich-text-preview';
import RichTextEditor from '@/components/ui/rich-text-editor';
import ChecklistEditor from './ChecklistEditor';
import { useSupabaseTaskPeople } from '@/hooks/useSupabaseTaskPeople';
import { useSupabaseTaskTags } from '@/hooks/useSupabaseTaskTags';

interface TaskDetailsModalProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
  statusOptions: { value: string; label: string }[];
}

export default function TaskDetailsModal({
  task,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
  statusOptions
}: TaskDetailsModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState(task?.notes || '');
  
  // Editable fields state
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editPriority, setEditPriority] = useState<TaskPriority>('medium');
  const [editStatus, setEditStatus] = useState<TaskStatus>('todo');
  const [editAssigneeName, setEditAssigneeName] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);

  const { people } = useSupabaseTaskPeople();
  const { tags: tagDefs } = useSupabaseTaskTags();

  // Update notes when task changes
  useEffect(() => {
    setNotes(task?.notes || '');
  }, [task?.id, task?.notes]);

  // Reset editing state when modal closes
  useEffect(() => {
    if (!open) {
      setIsEditing(false);
    }
  }, [open]);

  // Initialize edit fields when entering edit mode
  const enterEditMode = useCallback(() => {
    if (task) {
      setEditTitle(task.title || '');
      setEditDescription(task.description || '');
      setEditDueDate(task.dueDate ? formatDateForInput(task.dueDate) : '');
      setEditPriority(task.priority || 'medium');
      setEditStatus(task.status || 'todo');
      setEditAssigneeName(task.assigneeName || '');
      setEditTags(task.tags || []);
      setIsEditing(true);
    }
  }, [task]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  const saveChanges = useCallback(() => {
    if (!task) return;
    
    const updates: Partial<Task> = {
      title: editTitle.trim(),
      description: editDescription.trim() || undefined,
      dueDate: editDueDate ? formatDateForStorage(editDueDate) : undefined,
      priority: editPriority,
      status: editStatus,
      assigneeName: editAssigneeName.trim() || undefined,
      tags: editTags.length ? editTags : undefined,
    };
    
    onUpdate(task.id, updates);
    setIsEditing(false);
  }, [task, editTitle, editDescription, editDueDate, editPriority, editStatus, editAssigneeName, editTags, onUpdate]);

  if (!task) return null;

  const handleNotesUpdate = () => {
    if (notes !== task.notes) {
      onUpdate(task.id, { notes });
    }
  };

  const priorityLabels: Record<string, string> = {
    low: 'Baixa',
    medium: 'Média', 
    high: 'Alta'
  };

  const statusLabels: Record<string, string> = {
    todo: 'A Fazer',
    doing: 'Em Andamento',
    waiting: 'Aguardando',
    done: 'Concluída'
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const daysUntilDue = task.dueDate ? Math.ceil((new Date(task.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-lunar-surface border-lunar-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-lunar-text">
            {isEditing ? 'Editar Tarefa' : 'Detalhes da Tarefa'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            {isEditing ? (
              <>
                <Label className="text-sm font-medium text-lunar-textSecondary">Título</Label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Título da tarefa"
                  className="text-lg font-bold bg-lunar-background border-lunar-border"
                />
              </>
            ) : (
              <h2 className="text-xl font-bold text-lunar-text">{task.title}</h2>
            )}
          </div>

          {/* Meta Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Priority */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-lunar-textSecondary">Prioridade</Label>
              {isEditing ? (
                <Select value={editPriority} onValueChange={(v) => setEditPriority(v as TaskPriority)}>
                  <SelectTrigger className="bg-lunar-background border-lunar-border">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${getPriorityColor(editPriority)}`} />
                      <SelectValue />
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
              ) : (
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${getPriorityColor(task.priority)}`} />
                  <span className="text-sm text-lunar-text">{priorityLabels[task.priority]}</span>
                </div>
              )}
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-lunar-textSecondary">Status</Label>
              {isEditing ? (
                <Select value={editStatus} onValueChange={(v) => setEditStatus(v as TaskStatus)}>
                  <SelectTrigger className="bg-lunar-background border-lunar-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-lunar-surface border-lunar-border">
                    <SelectItem value="todo">A Fazer</SelectItem>
                    <SelectItem value="doing">Em Andamento</SelectItem>
                    <SelectItem value="waiting">Aguardando</SelectItem>
                    <SelectItem value="done">Concluída</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  {statusLabels[task.status] || task.status}
                </Badge>
              )}
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-lunar-textSecondary flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Prazo
              </Label>
              {isEditing ? (
                <Input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="bg-lunar-background border-lunar-border"
                />
              ) : (
                <div className="text-sm text-lunar-text">
                  {task.dueDate ? (
                    <>
                      {formatDateForDisplay(task.dueDate)}
                      {daysUntilDue !== null && (
                        <span className={`ml-2 font-medium ${
                          daysUntilDue < 0 ? 'text-red-500' : 
                          daysUntilDue <= 2 ? 'text-yellow-500' : 'text-green-500'
                        }`}>
                          ({daysUntilDue < 0 ? `${Math.abs(daysUntilDue)} dias atrasada` : 
                            daysUntilDue === 0 ? 'Vence hoje' : 
                            `${daysUntilDue} dias restantes`})
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-lunar-textSecondary">Sem prazo definido</span>
                  )}
                </div>
              )}
            </div>

            {/* Assignee */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-lunar-textSecondary flex items-center gap-2">
                <User className="w-4 h-4" />
                Responsável
              </Label>
              {isEditing ? (
                <Select 
                  value={editAssigneeName || '__none__'} 
                  onValueChange={(v) => setEditAssigneeName(v === '__none__' ? '' : v)}
                >
                  <SelectTrigger className="bg-lunar-background border-lunar-border">
                    {editAssigneeName ? (
                      <Badge variant="secondary" className="text-sm">
                        {editAssigneeName}
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
              ) : (
                <div className="text-sm text-lunar-text">
                  {task.assigneeName ? (
                    <Badge variant="secondary" className="text-xs">
                      {task.assigneeName}
                    </Badge>
                  ) : (
                    <span className="text-lunar-textSecondary">Sem responsável</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-lunar-textSecondary">Etiquetas</Label>
            {isEditing ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between bg-lunar-background border-lunar-border hover:bg-lunar-background/80">
                    <div className="flex flex-wrap gap-1">
                      {editTags.length ? (
                        editTags.map(tag => (
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
                        checked={editTags.includes(tag.name)}
                        onCheckedChange={(checked) => {
                          setEditTags((prev) =>
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
            ) : (
              <div className="flex flex-wrap gap-1">
                {task.tags && task.tags.length > 0 ? (
                  task.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-lunar-textSecondary">Sem etiquetas</span>
                )}
              </div>
            )}
          </div>

          <Separator className="bg-lunar-border/60" />

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-lunar-textSecondary">Descrição</Label>
            {isEditing ? (
              <RichTextEditor
                value={editDescription}
                onChange={setEditDescription}
                placeholder="Adicione uma descrição..."
                minHeight="120px"
              />
            ) : (
              <RichTextPreview 
                content={task.description} 
                className="text-sm p-2 rounded border border-lunar-border/50 bg-lunar-background/30 min-h-[60px]"
                placeholder="Sem descrição"
              />
            )}
          </div>

          {/* Checklist */}
          {(task.activeSections?.includes('checklist') || task.checklistItems?.length) && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-lunar-textSecondary flex items-center gap-2">
                <CheckSquare className="w-4 h-4" />
                Checklist
              </Label>
              <ChecklistEditor
                checklistItems={task.checklistItems || []}
                onChange={(items) => onUpdate(task.id, { checklistItems: items })}
                compact
              />
            </div>
          )}

          {/* Notes - Collapsible */}
          <Collapsible defaultOpen={false}>
            <CollapsibleTrigger className="flex items-center gap-2 font-medium text-lunar-text hover:text-lunar-accent transition-colors">
              <ChevronDown className="w-4 h-4 transition-transform data-[state=open]:rotate-180" />
              Notas
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleNotesUpdate}
                placeholder="Adicione suas notas aqui..."
                className="min-h-[100px] bg-lunar-background border-lunar-border"
              />
            </CollapsibleContent>
          </Collapsible>

          {/* Attachments Section */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-lunar-textSecondary flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Anexos
            </Label>
            <TaskAttachmentsSection 
              task={task} 
              onUpdateTask={(updates) => onUpdate(task.id, updates)} 
            />
          </div>

          <Separator className="bg-lunar-border/60" />

          {/* Metadata */}
          <div className="text-xs text-lunar-textSecondary space-y-1">
            <div>Criado em: {formatDateForDisplay(task.createdAt)}</div>
            {task.completedAt && (
              <div>Concluído em: {formatDateForDisplay(task.completedAt)}</div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            {isEditing ? (
              <>
                <Button
                  variant="outline"
                  onClick={cancelEdit}
                  className="flex-1 bg-lunar-background border-lunar-border"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
                <Button
                  onClick={saveChanges}
                  className="flex-1"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Alterações
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={enterEditMode}
                  className="flex-1"
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  Editar Tarefa
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    onDelete(task.id);
                    onOpenChange(false);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
