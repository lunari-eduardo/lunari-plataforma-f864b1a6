/**
 * TaskQuickModal — modal padrão para criar/editar tarefas na página Tarefas,
 * Agenda e Workflow. Substitui o `UnifiedTaskModal` (que era pesado, sempre
 * mostrava o seletor "Seções da Tarefa" e não tinha botão de excluir).
 *
 * Comportamento:
 *  - Por padrão exibe APENAS campos básicos (título, descrição, prazo,
 *    prioridade, status, responsável, etiquetas).
 *  - Botão "Adicionar seções avançadas ▾" revela o `TaskSectionSelector`
 *    + Checklist / Conteúdo / Documentos.
 *  - Em modo `edit`, exibe o botão "Excluir" com confirmação.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar, ChevronDown, ChevronUp, Trash2, User } from "lucide-react";
import {
  SelectModal as Select,
  SelectModalContent as SelectContent,
  SelectModalItem as SelectItem,
  SelectModalTrigger as SelectTrigger,
  SelectModalValue as SelectValue,
} from "@/components/ui/select-in-modal";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSupabaseTaskPeople } from "@/hooks/useSupabaseTaskPeople";
import { useSupabaseTaskTags } from "@/hooks/useSupabaseTaskTags";
import { useSupabaseTaskStatuses } from "@/hooks/useSupabaseTaskStatuses";
import { formatDateForInput, formatDateForStorage } from "@/utils/dateUtils";
import type {
  ChecklistItem,
  Task,
  TaskPriority,
  TaskSection,
  TaskType,
} from "@/types/tasks";

import TaskSectionSelector from "@/components/tarefas/forms/TaskSectionSelector";
import ChecklistEditor from "@/components/tarefas/ChecklistEditor";
import TaskContentForm from "@/components/tarefas/forms/TaskContentForm";
import TaskDocumentForm from "@/components/tarefas/forms/TaskDocumentForm";

export interface TaskQuickModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "create" | "edit";
  initial?: Partial<Task>;
  onSubmit: (data: Partial<Task> & { title: string }) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
}

function priorityDot(p: string) {
  switch (p) {
    case "high":
      return "bg-red-500";
    case "medium":
      return "bg-yellow-500";
    case "low":
      return "bg-green-500";
    default:
      return "bg-muted-foreground/40";
  }
}

export default function TaskQuickModal({
  open,
  onOpenChange,
  mode = "create",
  initial,
  onSubmit,
  onDelete,
}: TaskQuickModalProps) {
  const { people } = useSupabaseTaskPeople();
  const { tags: tagDefs } = useSupabaseTaskTags();
  const { statuses, getDefaultOpenKey } = useSupabaseTaskStatuses();

  // Estado básico
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState<string>("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [status, setStatus] = useState<string>("todo");
  const [assigneeName, setAssigneeName] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Avançado
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeSections, setActiveSections] = useState<TaskSection[]>(["basic"]);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [callToAction, setCallToAction] = useState("");
  const [socialPlatforms, setSocialPlatforms] = useState<string[]>([]);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);

  // Confirmação de exclusão
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reset / preload quando abrir
  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setDescription(initial?.description ?? "");
    setDueDate(initial?.dueDate ? formatDateForInput(initial.dueDate) : "");
    setPriority(initial?.priority ?? "medium");
    setStatus(initial?.status ?? getDefaultOpenKey() ?? "todo");
    setAssigneeName(initial?.assigneeName ?? "");
    setSelectedTags(initial?.tags ?? []);
    setChecklistItems(initial?.checklistItems ?? []);
    setCallToAction(initial?.callToAction ?? "");
    setSocialPlatforms(initial?.socialPlatforms ?? []);
    setAttachments((initial?.attachments as any[]) ?? []);
    // Decidir seções avançadas iniciais
    const sections: TaskSection[] = ["basic"];
    if (initial?.activeSections && initial.activeSections.length > 1) {
      setActiveSections(initial.activeSections);
      setShowAdvanced(true);
    } else {
      if (initial?.checklistItems?.length) sections.push("checklist");
      if (initial?.callToAction || initial?.socialPlatforms?.length) sections.push("content");
      if (initial?.attachments?.length) sections.push("document");
      setActiveSections(sections);
      setShowAdvanced(sections.length > 1);
    }
  }, [open, initial, getDefaultOpenKey]);

  const statusOptions = useMemo(
    () => statuses.map((s) => ({ value: s.key, label: s.name })),
    [statuses],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const dueIso = dueDate ? formatDateForStorage(dueDate) : undefined;

    const finalSections: TaskSection[] = showAdvanced ? activeSections : ["basic"];
    const primaryType: TaskType =
      finalSections.length === 1 && finalSections[0] === "checklist"
        ? "checklist"
        : finalSections.includes("content")
        ? "content"
        : finalSections.includes("document")
        ? "document"
        : "simple";

    const data: Partial<Task> & { title: string } = {
      title: title.trim(),
      description: description.trim() || undefined,
      dueDate: dueIso,
      priority,
      status,
      assigneeName: assigneeName.trim() || undefined,
      tags: selectedTags.length ? selectedTags : undefined,
      type: primaryType,
      activeSections: finalSections,
    };

    if (showAdvanced) {
      if (finalSections.includes("checklist")) {
        data.checklistItems = checklistItems.length ? checklistItems : undefined;
      }
      if (finalSections.includes("content")) {
        data.callToAction = callToAction.trim() || undefined;
        data.socialPlatforms = socialPlatforms.length ? socialPlatforms : undefined;
      }
      if (finalSections.includes("document")) {
        data.attachments = attachments.length ? attachments : undefined;
      }
    }

    await onSubmit(data);
    onOpenChange(false);
  };

  const renderAdvancedSection = (section: TaskSection) => {
    switch (section) {
      case "checklist":
        return (
          <div
            key="checklist"
            className="space-y-3 p-3 border border-lunar-border rounded-lg bg-lunar-background/30"
          >
            <h4 className="text-sm font-medium text-lunar-text">Checklist</h4>
            <ChecklistEditor checklistItems={checklistItems} onChange={setChecklistItems} />
          </div>
        );
      case "content":
        return (
          <div
            key="content"
            className="space-y-3 p-3 border border-lunar-border rounded-lg bg-lunar-background/30"
          >
            <h4 className="text-sm font-medium text-lunar-text">Conteúdo / Social</h4>
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
          </div>
        );
      case "document":
        return (
          <div
            key="document"
            className="space-y-3 p-3 border border-lunar-border rounded-lg bg-lunar-background/30"
          >
            <h4 className="text-sm font-medium text-lunar-text">Documentos</h4>
            <TaskDocumentForm
              title={title}
              setTitle={setTitle}
              description={description}
              setDescription={setDescription}
              attachments={attachments}
              setAttachments={setAttachments}
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="glass-modal sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-lg font-bold text-lunar-text">
              {mode === "create" ? "Nova tarefa" : "Editar tarefa"}
            </DialogTitle>
            <DialogDescription className="text-xs text-lunar-textSecondary">
              {mode === "create"
                ? "Preencha os dados básicos. Use seções avançadas se precisar."
                : "Atualize os dados da tarefa."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Título */}
            <div className="space-y-1.5">
              <Label htmlFor="task-title" className="text-sm">
                Título *
              </Label>
              <Input
                id="task-title"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Ligar para cliente João"
                required
              />
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <Label htmlFor="task-desc" className="text-sm">
                Descrição
              </Label>
              <Textarea
                id="task-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Detalhes da tarefa (opcional)"
              />
            </div>

            {/* Prazo + Prioridade */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Prazo
                </Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Prioridade</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                  <SelectTrigger>
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${priorityDot(priority)}`} />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500" /> Baixa
                      </div>
                    </SelectItem>
                    <SelectItem value="medium">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" /> Média
                      </div>
                    </SelectItem>
                    <SelectItem value="high">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500" /> Alta
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Status + Responsável */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Responsável
                </Label>
                <Select
                  value={assigneeName || "__none__"}
                  onValueChange={(v) => setAssigneeName(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sem responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem responsável</SelectItem>
                    {people.map((p) => (
                      <SelectItem key={p.id} value={p.name}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Etiquetas */}
            <div className="space-y-1.5">
              <Label className="text-sm">Etiquetas</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between"
                  >
                    <div className="flex flex-wrap gap-1 text-left">
                      {selectedTags.length ? (
                        selectedTags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-lunar-textSecondary text-sm">
                          Selecione etiquetas
                        </span>
                      )}
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="z-[10000] w-[var(--radix-select-trigger-width,16rem)] min-w-[12rem]">
                  {tagDefs.length ? (
                    tagDefs.map((tag) => (
                      <DropdownMenuCheckboxItem
                        key={tag.id}
                        checked={selectedTags.includes(tag.name)}
                        onCheckedChange={(checked) => {
                          setSelectedTags((prev) =>
                            checked ? [...prev, tag.name] : prev.filter((t) => t !== tag.name),
                          );
                        }}
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

            {/* Toggle de seções avançadas */}
            <div className="pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-lunar-textSecondary hover:text-lunar-text"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                {showAdvanced ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5 mr-1" /> Ocultar seções avançadas
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5 mr-1" /> Adicionar seções avançadas
                  </>
                )}
              </Button>
            </div>

            {showAdvanced && (
              <div className="space-y-3">
                <TaskSectionSelector
                  activeSections={activeSections}
                  onChange={setActiveSections}
                />
                {activeSections.filter((s) => s !== "basic").map(renderAdvancedSection)}
              </div>
            )}

            {/* Ações */}
            <div className="flex items-center gap-2 pt-3">
              {mode === "edit" && onDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Excluir
                </Button>
              )}
              <div className="ml-auto flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">
                  {mode === "create" ? "Criar tarefa" : "Salvar alterações"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A tarefa será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                setConfirmDelete(false);
                if (onDelete) await onDelete();
                onOpenChange(false);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
