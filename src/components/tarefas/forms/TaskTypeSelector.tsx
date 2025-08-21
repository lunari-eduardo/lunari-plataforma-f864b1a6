import React from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FileText, CheckSquare, Megaphone, File } from 'lucide-react';
import type { TaskType } from '@/types/tasks';

interface TaskTypeSelectorProps {
  value: TaskType;
  onChange: (value: TaskType) => void;
}

const taskTypes = [
  {
    value: 'simple' as TaskType,
    label: 'Simples',
    description: 'Tarefa básica com título e descrição',
    icon: FileText
  },
  {
    value: 'checklist' as TaskType,
    label: 'Checklist',
    description: 'Lista de itens para marcar como concluídos',
    icon: CheckSquare
  },
  {
    value: 'content' as TaskType,
    label: 'Conteúdo',
    description: 'Criação de conteúdo para redes sociais',
    icon: Megaphone
  },
  {
    value: 'document' as TaskType,
    label: 'Documento',
    description: 'Tarefa relacionada a documentos',
    icon: File
  }
];

export default function TaskTypeSelector({ value, onChange }: TaskTypeSelectorProps) {
  return (
    <div className="space-y-3">
      <Label className="text-base font-medium text-lunar-text">Tipo de Tarefa</Label>
      <RadioGroup value={value} onValueChange={onChange} className="grid grid-cols-2 gap-3">
        {taskTypes.map((type) => {
          const Icon = type.icon;
          return (
            <div key={type.value} className="flex items-center space-x-3">
              <RadioGroupItem value={type.value} id={type.value} />
              <Label 
                htmlFor={type.value} 
                className="flex items-center gap-2 cursor-pointer flex-1 p-3 rounded-lg border border-lunar-border hover:bg-lunar-background/50 transition-colors"
              >
                <Icon className="h-4 w-4 text-lunar-accent" />
                <div>
                  <div className="font-medium text-lunar-text">{type.label}</div>
                  <div className="text-xs text-lunar-textSecondary">{type.description}</div>
                </div>
              </Label>
            </div>
          );
        })}
      </RadioGroup>
    </div>
  );
}