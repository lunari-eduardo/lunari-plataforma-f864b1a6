import React from 'react';
import { Label } from '@/components/ui/label';
import { 
  SelectModal as Select, 
  SelectModalContent as SelectContent, 
  SelectModalItem as SelectItem, 
  SelectModalTrigger as SelectTrigger, 
  SelectModalValue as SelectValue 
} from '@/components/ui/select-in-modal';
import type { TaskType } from '@/types/tasks';

interface TaskTypeSelectorProps {
  value: TaskType;
  onValueChange: (value: TaskType) => void;
  onOpenChange?: (open: boolean) => void;
}

const TASK_TYPES = [
  { value: 'simple', label: 'Tarefa Simples', icon: '📝', description: 'Tarefa básica com campos essenciais' },
  { value: 'content', label: 'Legenda/Conteúdo', icon: '📱', description: 'Conteúdo para redes sociais com CTA' },
  { value: 'checklist', label: 'Checklist/Processo', icon: '✅', description: 'Lista de etapas organizadas' },
  { value: 'document', label: 'Documento/Arquivo', icon: '📄', description: 'Foco em uploads e anexos' },
] as const;

export default function TaskTypeSelector({ value, onValueChange, onOpenChange }: TaskTypeSelectorProps) {
  const selectedType = TASK_TYPES.find(t => t.value === value);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">Tipo de Tarefa *</Label>
      <Select value={value} onValueChange={onValueChange} onOpenChange={onOpenChange}>
        <SelectTrigger className="w-full">
          <SelectValue>
            {selectedType && (
              <div className="flex items-center gap-2">
                <span>{selectedType.icon}</span>
                <span>{selectedType.label}</span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {TASK_TYPES.map((type) => (
            <SelectItem key={type.value} value={type.value}>
              <div className="flex items-start gap-3 py-1">
                <span className="text-base">{type.icon}</span>
                <div>
                  <div className="font-medium">{type.label}</div>
                  <div className="text-xs text-lunar-textSecondary">{type.description}</div>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}