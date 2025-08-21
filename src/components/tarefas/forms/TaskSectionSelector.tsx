import React from 'react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, CheckSquare, Megaphone, File } from 'lucide-react';
import type { TaskSection } from '@/types/tasks';

interface TaskSectionSelectorProps {
  activeSections: TaskSection[];
  onChange: (sections: TaskSection[]) => void;
}

const availableSections = [
  {
    value: 'basic' as TaskSection,
    label: 'Descrição Básica',
    description: 'Título e descrição detalhada da tarefa',
    icon: FileText,
    required: true
  },
  {
    value: 'checklist' as TaskSection,
    label: 'Checklist',
    description: 'Lista de itens para marcar como concluídos',
    icon: CheckSquare,
    required: false
  },
  {
    value: 'content' as TaskSection,
    label: 'Conteúdo/Social',
    description: 'Criação de conteúdo para redes sociais',
    icon: Megaphone,
    required: false
  },
  {
    value: 'document' as TaskSection,
    label: 'Documentos',
    description: 'Anexos e documentos relacionados',
    icon: File,
    required: false
  }
];

export default function TaskSectionSelector({ activeSections, onChange }: TaskSectionSelectorProps) {
  const handleSectionToggle = (section: TaskSection, checked: boolean) => {
    if (checked) {
      onChange([...activeSections, section]);
    } else {
      onChange(activeSections.filter(s => s !== section));
    }
  };

  return (
    <div className="space-y-3">
      <Label className="text-base font-medium text-lunar-text">Seções da Tarefa</Label>
      <div className="space-y-3">
        {availableSections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSections.includes(section.value);
          const isRequired = section.required;
          
          return (
            <div key={section.value} className="flex items-start space-x-3">
              <Checkbox
                id={section.value}
                checked={isActive}
                onCheckedChange={(checked) => handleSectionToggle(section.value, !!checked)}
                disabled={isRequired}
                className="mt-1"
              />
              <Label 
                htmlFor={section.value} 
                className={`flex items-start gap-3 cursor-pointer flex-1 p-3 rounded-lg border transition-colors ${
                  isActive 
                    ? 'border-lunar-accent bg-lunar-accent/5' 
                    : 'border-lunar-border hover:bg-lunar-background/50'
                } ${isRequired ? 'opacity-75' : ''}`}
              >
                <Icon className={`h-4 w-4 mt-0.5 ${isActive ? 'text-lunar-accent' : 'text-lunar-textSecondary'}`} />
                <div>
                  <div className={`font-medium ${isActive ? 'text-lunar-accent' : 'text-lunar-text'}`}>
                    {section.label}
                    {isRequired && <span className="text-xs text-lunar-textSecondary ml-1">(obrigatória)</span>}
                  </div>
                  <div className="text-xs text-lunar-textSecondary mt-0.5">{section.description}</div>
                </div>
              </Label>
            </div>
          );
        })}
      </div>
      
      {activeSections.length > 1 && (
        <div className="text-xs text-lunar-accent bg-lunar-accent/10 p-2 rounded border border-lunar-accent/20">
          💡 Tarefa combinada: {activeSections.map(s => availableSections.find(a => a.value === s)?.label).join(' + ')}
        </div>
      )}
    </div>
  );
}