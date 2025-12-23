import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Edit3, Trash2, Calendar, FileText, ChevronDown, CheckSquare } from 'lucide-react';
import type { Task } from '@/types/tasks';
import { formatDateForDisplay } from '@/utils/dateUtils';
import TaskFormModal from './TaskFormModal';
import TaskAttachmentsSection from './TaskAttachmentsSection';
import RichTextPreview from '@/components/ui/rich-text-preview';
import RichTextEditor from '@/components/ui/rich-text-editor';
import ChecklistEditor from './ChecklistEditor';


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
  const [editOpen, setEditOpen] = useState(false);
  const [notes, setNotes] = useState(task?.notes || '');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');

  // Update notes when task changes
  useEffect(() => {
    setNotes(task?.notes || '');
  }, [task?.id, task?.notes]);

  if (!task) return null;

  const handleNotesUpdate = () => {
    if (notes !== task.notes) {
      onUpdate(task.id, { notes });
    }
  };

  const priorityLabels = {
    low: 'Baixa',
    medium: 'Média', 
    high: 'Alta'
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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-lunar-surface border-lunar-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-lunar-text">
              Detalhes da Tarefa
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Header Info */}
            <div className="space-y-3">
              <h2 className="text-xl font-bold text-lunar-text">{task.title}</h2>
              
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${getPriorityColor(task.priority)}`} />
                  <span className="text-sm text-lunar-textSecondary">
                    Prioridade {priorityLabels[task.priority]}
                  </span>
                </div>
                
                {task.dueDate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-lunar-textSecondary" />
                    <span className="text-sm text-lunar-textSecondary">
                      Prazo: {formatDateForDisplay(task.dueDate)}
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
                    </span>
                  </div>
                )}

                {task.assigneeName && (
                  <Badge variant="secondary" className="text-xs">
                    {task.assigneeName}
                  </Badge>
                )}
              </div>

              {task.tags && task.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {task.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Separator className="bg-lunar-border/60" />

            {/* Description */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-lunar-text">Descrição</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditingDescription(!isEditingDescription);
                    setEditedDescription(task.description || '');
                  }}
                  className="text-xs"
                >
                  {isEditingDescription ? 'Cancelar' : 'Editar'}
                </Button>
              </div>
              
              {isEditingDescription ? (
                <div className="space-y-2">
                  <RichTextEditor
                    value={editedDescription}
                    onChange={setEditedDescription}
                    placeholder="Adicione uma descrição..."
                    minHeight="120px"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        onUpdate(task.id, { description: editedDescription });
                        setIsEditingDescription(false);
                      }}
                    >
                      Salvar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsEditingDescription(false);
                        setEditedDescription('');
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <RichTextPreview 
                  content={task.description} 
                  className="text-sm cursor-pointer hover:bg-lunar-background/50 p-2 rounded border border-transparent hover:border-lunar-border transition-colors"
                  placeholder="Clique em Editar para adicionar uma descrição"
                />
              )}
            </div>

            {/* Checklist */}
            {(task.activeSections?.includes('checklist') || task.checklistItems?.length) && (
              <div className="space-y-2">
                <h3 className="font-medium text-lunar-text flex items-center gap-2">
                  <CheckSquare className="w-4 h-4" />
                  Checklist
                </h3>
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
              <h3 className="font-medium text-lunar-text flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Anexos
              </h3>
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
              <Button
                onClick={() => {
                  onOpenChange(false); // Fechar modal de detalhes primeiro
                  setTimeout(() => setEditOpen(true), 150); // Abrir edição após animação
                }}
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
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <TaskFormModal
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initial={task}
        onSubmit={(data) => {
          onUpdate(task.id, data);
          setEditOpen(false);
        }}
      />
    </>
  );
}