import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  SelectModal as Select,
  SelectModalContent as SelectContent,
  SelectModalItem as SelectItem,
  SelectModalTrigger as SelectTrigger,
  SelectModalValue as SelectValue,
} from '@/components/ui/select-in-modal';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Calendar, User, Plus } from 'lucide-react';
import RichTextEditor from '@/components/ui/rich-text-editor';
import ChecklistEditor from './ChecklistEditor';
import { useSupabaseTaskPeople } from '@/hooks/useSupabaseTaskPeople';
import { useSupabaseTaskTags } from '@/hooks/useSupabaseTaskTags';
import { formatDateForStorage } from '@/utils/dateUtils';
import type { Task, TaskPriority, ChecklistItem } from '@/types/tasks';

interface QuickTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Omit<Task, 'id' | 'createdAt'>) => Promise<unknown> | void;
  defaultStatus: string;
}

const priorityDot: Record<TaskPriority, string> = {
  high: 'bg-red-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

export default function QuickTaskModal({ open, onOpenChange, onSubmit, defaultStatus }: QuickTaskModalProps) {
  const titleRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // advanced
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [assigneeName, setAssigneeName] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [showChecklist, setShowChecklist] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const { people } = useSupabaseTaskPeople();
  const { tags: tagDefs } = useSupabaseTaskTags();

  useEffect(() => {
    if (open) {
      setTitle('');
      setAdvancedOpen(false);
      setDescription('');
      setDueDate('');
      setPriority('medium');
      setAssigneeName('');
      setTags([]);
      setChecklistItems([]);
      setShowChecklist(false);
      requestAnimationFrame(() => titleRef.current?.focus());
    }
  }, [open]);

  const submit = async () => {
    const t = title.trim();
    if (!t || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        title: t,
        description: description.trim() || undefined,
        status: defaultStatus,
        priority,
        type: 'simple',
        source: 'manual',
        dueDate: dueDate ? formatDateForStorage(dueDate) : undefined,
        assigneeName: assigneeName.trim() || undefined,
        tags: tags.length ? tags : undefined,
        checklistItems: checklistItems.length ? checklistItems : undefined,
        activeSections: checklistItems.length ? ['basic', 'checklist'] : ['basic'],
      } as Omit<Task, 'id' | 'createdAt'>);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-modal max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-lunar-text">Nova tarefa</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-4"
        >
          {/* Título — único campo obrigatório */}
          <div className="space-y-1.5">
            <Input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="O que precisa ser feito?"
              required
              autoFocus
              className="text-base"
            />
            <p className="text-2xs text-lunar-textSecondary opacity-70">
              Pressione Enter para criar rapidamente
            </p>
          </div>

          {/* Mais opções */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs text-lunar-textSecondary hover:text-lunar-text transition-colors"
              >
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
                />
                {advancedOpen ? 'Menos opções' : '+ Mais opções'}
              </button>
            </CollapsibleTrigger>

            <CollapsibleContent className="space-y-4 pt-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-lunar-textSecondary">Descrição</Label>
                <RichTextEditor
                  value={description}
                  onChange={setDescription}
                  placeholder="Detalhes opcionais..."
                  minHeight="80px"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-lunar-textSecondary flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Prazo
                  </Label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-lunar-textSecondary">Prioridade</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                    <SelectTrigger>
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${priorityDot[priority]}`} />
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="bg-card dark:bg-foreground border-border/30">
                      <SelectItem value="low">
                        <span className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Baixa
                        </span>
                      </SelectItem>
                      <SelectItem value="medium">
                        <span className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /> Média
                        </span>
                      </SelectItem>
                      <SelectItem value="high">
                        <span className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Alta
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-lunar-textSecondary flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  Responsável
                </Label>
                <Select
                  value={assigneeName || '__none__'}
                  onValueChange={(v) => setAssigneeName(v === '__none__' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sem responsável" />
                  </SelectTrigger>
                  <SelectContent className="bg-card dark:bg-foreground border-border/30">
                    <SelectItem value="__none__">Sem responsável</SelectItem>
                    {people.map((p) => (
                      <SelectItem key={p.id} value={p.name}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-lunar-textSecondary">Etiquetas</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-between font-normal h-10"
                    >
                      <div className="flex flex-wrap gap-1">
                        {tags.length ? (
                          tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-lunar-textSecondary">Selecione etiquetas</span>
                        )}
                      </div>
                      <ChevronDown className="w-4 h-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="z-[10000] bg-card dark:bg-foreground border-border/30 w-[var(--radix-dropdown-menu-trigger-width)] min-w-[12rem]">
                    {tagDefs.length ? (
                      tagDefs.map((tag) => (
                        <DropdownMenuCheckboxItem
                          key={tag.id}
                          checked={tags.includes(tag.name)}
                          onCheckedChange={(checked) =>
                            setTags((prev) =>
                              checked ? [...prev, tag.name] : prev.filter((t) => t !== tag.name)
                            )
                          }
                        >
                          {tag.name}
                        </DropdownMenuCheckboxItem>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-lunar-textSecondary">
                        Nenhuma etiqueta cadastrada.
                      </div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Checklist opcional */}
              <div className="space-y-1.5">
                {!showChecklist ? (
                  <button
                    type="button"
                    onClick={() => setShowChecklist(true)}
                    className="flex items-center gap-1.5 text-xs text-lunar-textSecondary hover:text-lunar-text transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Adicionar checklist
                  </button>
                ) : (
                  <>
                    <Label className="text-xs text-lunar-textSecondary">Checklist</Label>
                    <ChecklistEditor checklistItems={checklistItems} onChange={setChecklistItems} compact />
                  </>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!title.trim() || submitting}>
              Criar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
