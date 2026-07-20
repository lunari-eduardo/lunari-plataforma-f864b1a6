import { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Plus, Trash2, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { buildEtapasFromNames, type EtapaProducao } from "@/features/workflow/domain/productFlow";

interface Props {
  etapas: EtapaProducao[];
  onSave: (novasEtapas: EtapaProducao[], nomes: string[]) => void;
}

function SortableRow({
  id, nome, onChange, onRemove,
}: { id: string; nome: string; onChange: (v: string) => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
      className="flex items-center gap-2 bg-muted/40 rounded-md px-2 py-1.5 border"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground hover:text-foreground"
        aria-label="Reordenar etapa"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Input
        value={nome}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 text-xs flex-1"
        placeholder="Nome da etapa"
      />
      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
        aria-label="Remover etapa"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function ProdutoFlowEditPopover({ etapas, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(
    etapas.map((e) => ({ id: e.id, nome: e.nome })),
  );

  useEffect(() => {
    if (open) setItems(etapas.map((e) => ({ id: e.id, nome: e.nome })));
  }, [open, etapas]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    setItems(arrayMove(items, oldIndex, newIndex));
  };

  const handleAdd = () =>
    setItems((prev) => [
      ...prev,
      { id: `tmp_${Date.now()}_${prev.length}`, nome: "Nova etapa" },
    ]);

  const handleSave = () => {
    const nomes = items.map((i) => i.nome.trim()).filter(Boolean);
    if (nomes.length === 0) return;
    const novasEtapas = buildEtapasFromNames(nomes).map((e, i) => ({
      ...e,
      // Preserva done por posição a partir das etapas originais.
      done: etapas[i]?.done ?? false,
    }));
    onSave(novasEtapas, nomes);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]">
          <Pencil className="h-3 w-3 mr-1" /> Editar etapas
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="end">
        <div className="space-y-2">
          <div className="text-xs font-medium">Etapas personalizadas</div>
          <p className="text-[11px] text-muted-foreground">
            Arraste para reordenar. As etapas salvas viram a sugestão padrão para os próximos produtos personalizados.
          </p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {items.map((it, idx) => (
                  <SortableRow
                    key={it.id}
                    id={it.id}
                    nome={it.nome}
                    onChange={(v) =>
                      setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, nome: v } : p)))
                    }
                    onRemove={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={handleAdd}>
            <Plus className="h-3 w-3 mr-1" /> Adicionar etapa
          </Button>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={handleSave}>
              Aplicar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
