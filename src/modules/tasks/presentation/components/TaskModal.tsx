/**
 * TaskModal — modal canônico de visualização e edição de tarefas.
 *
 * Redesign aprovado:
 *  - Modo `view`: layout limpo, respiros, pílulas de ação rápidas.
 *  - Modo `edit` / `create`: formulário denso com controles no topo,
 *    checklist inline e múltiplos blocos de texto livres.
 *  - Tipo "Conteúdo/Social" removido. `description` legada e `captions`
 *    legadas são migradas in-memory para blocos de texto.
 *
 * Substitui `TaskQuickModal` e `UnifiedTaskModal`.
 */

import React, { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { tasksStore } from "../store/tasksStore";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Tag as TagIcon,
  Trash2,
  User,
  X,
  ArrowUp,
  ArrowDown,
  FileText,
} from "lucide-react";
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
import { formatDateForInput, formatDateForStorage, formatDateForDisplay } from "@/utils/dateUtils";
import type {
  ChecklistItem,
  Task,
  TaskPriority,
  TaskTextBlock,
} from "@/types/tasks";

export interface TaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "create" | "edit";
  /** Em modo `edit`, controla se abrimos primeiro em visualização (default) ou edição. */
  defaultView?: "view" | "edit";
  initial?: Partial<Task>;
  onSubmit: (data: Partial<Task> & { title: string }) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function priorityDot(p: string) {
  switch (p) {
    case "high": return "bg-red-500";
    case "medium": return "bg-yellow-500";
    case "low": return "bg-green-500";
    default: return "bg-muted-foreground/40";
  }
}

function priorityLabel(p: string) {
  return p === "high" ? "Alta" : p === "low" ? "Baixa" : "Média";
}

function uid(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Migra dados legados (description + captions[]) para o novo formato
 * de `textBlocks`. Mantém a ordem: descrição primeiro (se existir),
 * captions a seguir. Se `textBlocks` já existir, retorna como está.
 */
function deriveTextBlocks(t?: Partial<Task>): TaskTextBlock[] {
  if (!t) return [];
  if (t.textBlocks && t.textBlocks.length) {
    return [...t.textBlocks].sort((a, b) => a.order - b.order);
  }
  const blocks: TaskTextBlock[] = [];
  if (t.description && t.description.trim()) {
    blocks.push({ id: uid("blk"), title: "Descrição", content: t.description, order: 0 });
  }
  if (t.captions?.length) {
    t.captions.forEach((c, i) => {
      blocks.push({
        id: uid("blk"),
        title: c.title || `Bloco ${blocks.length + 1}`,
        content: c.content || "",
        order: blocks.length,
      });
    });
  }
  return blocks;
}

// ─── componente principal ───────────────────────────────────────────────────

export default function TaskModal({
  open,
  onOpenChange,
  mode = "create",
  defaultView,
  initial,
  onSubmit,
  onDelete,
}: TaskModalProps) {
  const isCreate = mode === "create";
  const initialMode: "view" | "edit" = isCreate ? "edit" : defaultView ?? "view";
  const [viewMode, setViewMode] = useState<"view" | "edit">(initialMode);

  const { people } = useSupabaseTaskPeople();
  const { tags: tagDefs } = useSupabaseTaskTags();
  const { statuses, getDefaultOpenKey } = useSupabaseTaskStatuses();

  // Em modo `view`, lê a task ao vivo do store — assim, qualquer update
  // (patch otimista, capability canonical, evento realtime, edição em outro
  // dispositivo) reflete enquanto o modal está aberto. Em `edit` mantemos
  // o estado local intocado para não atropelar o usuário.
  useSyncExternalStore(tasksStore.subscribe, tasksStore.getSnapshot, tasksStore.getSnapshot);
  const liveTask = initial?.id ? tasksStore.getById(initial.id) : undefined;
  const source: Partial<Task> | undefined = viewMode === "view" && liveTask ? liveTask : initial;

  // Estado de edição
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState<string>("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [status, setStatus] = useState<string>("todo");
  const [assigneeName, setAssigneeName] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [textBlocks, setTextBlocks] = useState<TaskTextBlock[]>([]);
  const [showChecklist, setShowChecklist] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);

  // (Re)carrega ao abrir, ao trocar de tarefa, ou ao entrar/sair do modo view.
  // Em modo `edit` o `source` é o `initial` original (não muda), preservando o
  // estado do usuário até ele salvar/cancelar.
  useEffect(() => {
    if (!open) return;
    setViewMode(initialMode);
    setTitle(source?.title ?? "");
    setDueDate(source?.dueDate ? formatDateForInput(source.dueDate) : "");
    setPriority(source?.priority ?? "medium");
    setStatus(source?.status ?? getDefaultOpenKey() ?? "todo");
    setAssigneeName(source?.assigneeName ?? "");
    setSelectedTags(source?.tags ?? []);
    setChecklistItems(source?.checklistItems ?? []);
    setShowChecklist(!!source?.checklistItems?.length);
    setTextBlocks(deriveTextBlocks(source));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id, viewMode === "view" ? source : initial]);


  const statusOptions = useMemo(
    () => statuses.map((s) => ({ value: s.key, label: s.name, color: s.color })),
    [statuses],
  );

  const currentStatusLabel = useMemo(
    () => statusOptions.find((o) => o.value === status)?.label ?? status,
    [statusOptions, status],
  );

  // ─── persistência ──────────────────────────────────────────────────────────
  const buildPayload = (): Partial<Task> & { title: string } => {
    const dueIso = dueDate ? formatDateForStorage(dueDate) : undefined;
    const cleanBlocks: TaskTextBlock[] = textBlocks
      .map((b, i) => ({ ...b, order: i }))
      .filter((b) => b.title.trim() || b.content.trim());

    // Compat: mantém `description` espelhando o primeiro bloco para listas/cards legados.
    const description = cleanBlocks[0]?.content?.trim() || undefined;

    // type derivado: se há checklist usado, marca como 'checklist' (mantém compat com painel fixo);
    // do contrário, 'simple'. Tipo 'content' não é mais criado por aqui.
    const inferredType: Task["type"] =
      showChecklist && checklistItems.length ? "checklist" : "simple";

    return {
      title: title.trim(),
      description,
      dueDate: dueIso,
      priority,
      status,
      assigneeName: assigneeName.trim() || undefined,
      tags: selectedTags.length ? selectedTags : undefined,
      type: inferredType,
      activeSections: showChecklist ? ["basic", "checklist"] : ["basic"],
      checklistItems: showChecklist ? checklistItems : [],
      textBlocks: cleanBlocks,
      // limpa campos legados de "conteúdo social"
      callToAction: undefined,
      socialPlatforms: undefined,
      captions: [],
    };
  };

  const handleSave = () => {
    if (!title.trim()) return;
    const payload = buildPayload();
    // Fecha imediatamente; mutação roda em background. UI já reflete via
    // patch otimista aplicado no handler do caller.
    onOpenChange(false);
    void Promise.resolve(onSubmit(payload));
  };

  // ─── checklist helpers ─────────────────────────────────────────────────────
  const [newChecklistText, setNewChecklistText] = useState("");
  const addChecklistItem = () => {
    if (!newChecklistText.trim()) return;
    setChecklistItems((prev) => [
      ...prev,
      { id: uid("chk"), text: newChecklistText.trim(), completed: false, createdAt: new Date().toISOString() },
    ]);
    setNewChecklistText("");
  };
  const toggleChecklist = (id: string) =>
    setChecklistItems((prev) => prev.map((c) => (c.id === id ? { ...c, completed: !c.completed } : c)));
  const updateChecklistText = (id: string, text: string) =>
    setChecklistItems((prev) => prev.map((c) => (c.id === id ? { ...c, text } : c)));
  const removeChecklistItem = (id: string) =>
    setChecklistItems((prev) => prev.filter((c) => c.id !== id));

  // ─── text-blocks helpers ───────────────────────────────────────────────────
  const addTextBlock = () =>
    setTextBlocks((prev) => [
      ...prev,
      { id: uid("blk"), title: "", content: "", order: prev.length },
    ]);
  const updateBlock = (id: string, patch: Partial<TaskTextBlock>) =>
    setTextBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const removeBlock = (id: string) =>
    setTextBlocks((prev) => prev.filter((b) => b.id !== id));
  const moveBlock = (id: string, dir: -1 | 1) =>
    setTextBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx < 0) return prev;
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((b, i) => ({ ...b, order: i }));
    });

  // ─── render ────────────────────────────────────────────────────────────────
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={
            viewMode === "view"
              ? "glass-modal sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0"
              : "glass-modal sm:max-w-2xl max-h-[90vh] overflow-y-auto"
          }
        >
          {viewMode === "view" ? (
            // ════════════════════════════════ VIEW MODE ════════════════════════════════
            <ViewLayout
              title={title || "Sem título"}
              status={currentStatusLabel}
              statusColor={statusOptions.find((o) => o.value === status)?.color}
              priority={priority}
              dueDate={dueDate}
              assigneeName={assigneeName}
              tags={selectedTags}
              checklistItems={showChecklist ? checklistItems : []}
              textBlocks={textBlocks}
              onToggleChecklist={(id) => {
                toggleChecklist(id);
                // persistir imediatamente alterações de checklist no view mode
                const next = checklistItems.map((c) => (c.id === id ? { ...c, completed: !c.completed } : c));
                void onSubmit({ ...buildPayload(), checklistItems: next });
              }}
              onEdit={() => setViewMode("edit")}
              onClose={() => onOpenChange(false)}
              onDelete={onDelete ? () => setConfirmDelete(true) : undefined}
            />
          ) : (
            // ════════════════════════════════ EDIT MODE ════════════════════════════════
            <>
              <DialogHeader className="space-y-1">
                <DialogTitle className="text-lg font-bold text-lunar-text">
                  {isCreate ? "Nova tarefa" : "Editar tarefa"}
                </DialogTitle>
                <DialogDescription className="text-xs text-lunar-textSecondary">
                  {isCreate ? "Preencha os dados da tarefa." : "Atualize os dados da tarefa."}
                </DialogDescription>
              </DialogHeader>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSave();
                }}
                className="space-y-4"
              >
                {/* Título */}
                <div className="space-y-1.5">
                  <Label htmlFor="task-title" className="text-sm">Título *</Label>
                  <Input
                    id="task-title"
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex.: Ligar para cliente João"
                    required
                  />
                </div>

                {/* Linha 1 — Prazo + Prioridade */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> Prazo
                    </Label>
                    <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
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
                          <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-green-500" /> Baixa</div>
                        </SelectItem>
                        <SelectItem value="medium">
                          <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-yellow-500" /> Média</div>
                        </SelectItem>
                        <SelectItem value="high">
                          <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-red-500" /> Alta</div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Linha 2 — Status + Responsável */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger><SelectValue placeholder="Selecione status" /></SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
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
                      <SelectTrigger><SelectValue placeholder="Sem responsável" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sem responsável</SelectItem>
                        {people.map((p) => (
                          <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Etiquetas */}
                <div className="space-y-1.5">
                  <Label className="text-sm flex items-center gap-1.5">
                    <TagIcon className="w-3.5 h-3.5" /> Etiquetas
                  </Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="outline" className="w-full justify-between">
                        <div className="flex flex-wrap gap-1 text-left">
                          {selectedTags.length ? (
                            selectedTags.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                            ))
                          ) : (
                            <span className="text-lunar-textSecondary text-sm">Selecione etiquetas</span>
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
                        <div className="px-3 py-2 text-sm text-lunar-textSecondary">Nenhuma etiqueta cadastrada.</div>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Blocos de texto */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" /> Blocos de texto
                    </Label>
                    <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={addTextBlock}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar bloco
                    </Button>
                  </div>
                  {textBlocks.length === 0 && (
                    <p className="text-xs text-lunar-textSecondary py-2">
                      Adicione blocos para descrição, notas, roteiros etc.
                    </p>
                  )}
                  <div className="space-y-3">
                    {textBlocks.map((b, i) => (
                      <div key={b.id} className="rounded-lg border border-lunar-border bg-lunar-background/30 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            value={b.title}
                            onChange={(e) => updateBlock(b.id, { title: e.target.value })}
                            placeholder={`Título do bloco ${i + 1}`}
                            className="h-8 text-sm font-medium"
                          />
                          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0"
                                  disabled={i === 0} onClick={() => moveBlock(b.id, -1)}>
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0"
                                  disabled={i === textBlocks.length - 1} onClick={() => moveBlock(b.id, 1)}>
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive"
                                  onClick={() => removeBlock(b.id)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <Textarea
                          value={b.content}
                          onChange={(e) => updateBlock(b.id, { content: e.target.value })}
                          rows={4}
                          placeholder="Conteúdo do bloco..."
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Checklist toggle */}
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs text-lunar-textSecondary hover:text-lunar-text"
                    onClick={() => setShowChecklist((v) => !v)}
                  >
                    {showChecklist ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
                    {showChecklist ? "Ocultar checklist" : "Adicionar checklist"}
                  </Button>

                  {showChecklist && (
                    <div className="rounded-lg border border-lunar-border bg-lunar-background/30 p-3 space-y-2">
                      {checklistItems.map((c) => (
                        <div key={c.id} className="flex items-center gap-2 group">
                          <Checkbox checked={c.completed} onCheckedChange={() => toggleChecklist(c.id)} />
                          <Input
                            value={c.text}
                            onChange={(e) => updateChecklistText(c.id, e.target.value)}
                            className={`h-8 text-sm flex-1 ${c.completed ? "line-through text-lunar-textSecondary" : ""}`}
                          />
                          <Button type="button" variant="ghost" size="sm"
                                  className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100"
                                  onClick={() => removeChecklistItem(c.id)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                      <div className="flex items-center gap-2 pt-1">
                        <Input
                          value={newChecklistText}
                          onChange={(e) => setNewChecklistText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addChecklistItem(); } }}
                          placeholder="Novo item..."
                          className="h-8 text-sm"
                        />
                        <Button type="button" size="sm" onClick={addChecklistItem} disabled={!newChecklistText.trim()}>
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2 pt-3 border-t border-lunar-border/40">
                  {mode === "edit" && onDelete && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" /> Excluir
                    </Button>
                  )}
                  <div className="ml-auto flex gap-2">
                    {!isCreate && (
                      <Button type="button" variant="outline" onClick={() => setViewMode("view")}>
                        Cancelar
                      </Button>
                    )}
                    {isCreate && (
                      <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                      </Button>
                    )}
                    <Button type="submit">{isCreate ? "Criar tarefa" : "Salvar alterações"}</Button>
                  </div>
                </div>
              </form>
            </>
          )}
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

// ────────────────────────────────────────────────────────────────────────────
// View Layout (modo visualização — clean, com respiros)
// ────────────────────────────────────────────────────────────────────────────

interface ViewLayoutProps {
  title: string;
  status: string;
  statusColor?: string;
  priority: TaskPriority;
  dueDate: string;
  assigneeName: string;
  tags: string[];
  checklistItems: ChecklistItem[];
  textBlocks: TaskTextBlock[];
  onToggleChecklist: (id: string) => void;
  onEdit: () => void;
  onClose: () => void;
  onDelete?: () => void;
}

function ViewLayout({
  title, status, statusColor, priority, dueDate, assigneeName, tags,
  checklistItems, textBlocks, onToggleChecklist, onEdit, onClose, onDelete,
}: ViewLayoutProps) {
  const completedCount = checklistItems.filter((c) => c.completed).length;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-lunar-border/30">
        <div className="flex items-start gap-3">
          <h2 className="flex-1 text-2xl font-semibold leading-tight text-lunar-text">{title}</h2>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" /> Editar
          </Button>
        </div>

        {/* Metadados em pílulas */}
        <div className="mt-4 flex flex-wrap gap-2">
          <Pill icon={<div className="h-2 w-2 rounded-full" style={{ background: statusColor || "#6b7280" }} />}>
            {status}
          </Pill>
          <Pill icon={<div className={`h-2 w-2 rounded-full ${priorityDot(priority)}`} />}>
            {priorityLabel(priority)}
          </Pill>
          {dueDate && (
            <Pill icon={<Calendar className="h-3 w-3" />}>
              {formatDateForDisplay(formatDateForStorage(dueDate))}
            </Pill>
          )}
          {assigneeName && (
            <Pill icon={<User className="h-3 w-3" />}>{assigneeName}</Pill>
          )}
        </div>

        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
            ))}
          </div>
        )}
      </div>

      {/* Conteúdo — blocos de texto */}
      <div className="px-6 py-5 space-y-6">
        {textBlocks.length === 0 && checklistItems.length === 0 && (
          <p className="text-sm text-lunar-textSecondary italic">
            Nenhum conteúdo adicional. Clique em "Editar" para adicionar blocos ou checklist.
          </p>
        )}

        {textBlocks.map((b) => (
          <section key={b.id} className="space-y-1.5">
            {b.title && (
              <h3 className="text-sm font-semibold uppercase tracking-wide text-lunar-textSecondary">
                {b.title}
              </h3>
            )}
            <div className="text-sm leading-relaxed text-lunar-text whitespace-pre-wrap">
              {b.content || <span className="italic text-lunar-textSecondary">(vazio)</span>}
            </div>
          </section>
        ))}

        {checklistItems.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-lunar-textSecondary">
              Checklist · {completedCount}/{checklistItems.length}
            </h3>
            <ul className="space-y-1">
              {checklistItems.map((c) => (
                <li key={c.id} className="flex items-center gap-2 py-1">
                  <Checkbox checked={c.completed} onCheckedChange={() => onToggleChecklist(c.id)} />
                  <span className={`text-sm ${c.completed ? "line-through text-lunar-textSecondary" : "text-lunar-text"}`}>
                    {c.text}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 px-6 py-4 border-t border-lunar-border/30">
        {onDelete && (
          <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={onDelete}>
            <Trash2 className="h-4 w-4 mr-1.5" /> Excluir
          </Button>
        )}
        <Button variant="outline" size="sm" className="ml-auto" onClick={onClose}>Fechar</Button>
        <Button size="sm" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
        </Button>
      </div>
    </div>
  );
}

function Pill({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-lunar-border bg-lunar-background/40 px-2.5 py-1 text-xs text-lunar-text">
      {icon}
      {children}
    </span>
  );
}
