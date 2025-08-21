import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Edit3, Trash2, Calendar, FileText } from 'lucide-react';
import type { Task } from '@/types/tasks';
import { formatDateForDisplay } from '@/utils/dateUtils';
import TaskFormModal from './TaskFormModal';
import TaskAttachmentsSection from './TaskAttachmentsSection';
import RichTextPreview from '@/components/ui/rich-text-preview';


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
            {task.description && (
              <div className="space-y-2">
                <h3 className="font-medium text-lunar-text">Descrição</h3>
                <RichTextPreview 
                  content={task.description} 
                  className="text-sm"
                />
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <h3 className="font-medium text-lunar-text">Notas</h3>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleNotesUpdate}
                placeholder="Adicione suas notas aqui..."
                className="min-h-[100px] bg-lunar-background border-lunar-border"
              />
            </div>

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
                onClick={() => setEditOpen(true)}
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