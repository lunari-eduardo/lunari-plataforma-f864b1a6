import { useState, useEffect } from 'react';
import { Plus, GripVertical, Trash2, ChevronDown } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFormularioTemplates } from '@/hooks/useFormularioTemplates';
import { useRealtimeConfiguration } from '@/hooks/useRealtimeConfiguration';
import {
  FormularioTemplate,
  FormularioCampo,
  FormularioCampoTipo,
  CAMPO_TIPO_LABELS,
  CAMPOS_SEM_PLACEHOLDER,
} from '@/types/formulario';

interface FormularioTemplateEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: FormularioTemplate | null;
}

const CAMPO_TIPOS: FormularioCampoTipo[] = [
  'texto_curto',
  'texto_longo',
  'selecao_unica',
  'multipla_escolha',
  'data',
  'upload_referencia',
  'upload_imagem',
  'selecao_cores',
];

export default function FormularioTemplateEditor({
  open,
  onOpenChange,
  template,
}: FormularioTemplateEditorProps) {
  const { createTemplate, updateTemplate, isCreating, isUpdating } = useFormularioTemplates();
  const { categorias, isLoadingCategorias } = useRealtimeConfiguration();
  
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tempoEstimado, setTempoEstimado] = useState(3);
  const [campos, setCampos] = useState<FormularioCampo[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Reset form when opening/closing or template changes
  useEffect(() => {
    if (open) {
      if (template) {
        setNome(template.nome);
        setCategoria(template.categoria);
        setDescricao(template.descricao || '');
        setTempoEstimado(template.tempo_estimado);
        setCampos(template.campos);
      } else {
        setNome('');
        setCategoria('');
        setDescricao('');
        setTempoEstimado(3);
        setCampos([]);
      }
    }
  }, [open, template]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setCampos((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        return newItems.map((item, idx) => ({ ...item, ordem: idx + 1 }));
      });
    }
  };

  const addCampo = (tipo: FormularioCampoTipo) => {
    const newCampo: FormularioCampo = {
      id: `campo_${Date.now()}`,
      tipo,
      label: '',
      placeholder: '',
      ordem: campos.length + 1,
      obrigatorio: false,
      opcoes: tipo === 'selecao_unica' || tipo === 'multipla_escolha' ? [''] : undefined,
    };
    setCampos(prev => [...prev, newCampo]);
  };

  const updateCampo = (id: string, updates: Partial<FormularioCampo>) => {
    setCampos(campos.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const removeCampo = (id: string) => {
    setCampos(campos.filter((c) => c.id !== id).map((c, idx) => ({ ...c, ordem: idx + 1 })));
  };

  const handleSave = async () => {
    if (!nome.trim()) return;
    
    const data = {
      nome: nome.trim(),
      categoria: categoria || 'geral',
      descricao: descricao.trim() || undefined,
      tempo_estimado: tempoEstimado,
      campos,
    };

    if (template) {
      await updateTemplate({ id: template.id, ...data });
    } else {
      await createTemplate(data);
    }
    
    onOpenChange(false);
  };

  const isSaving = isCreating || isUpdating;
  const isValid = nome.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {template ? 'Editar Template' : 'Novo Template de Formulário'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            {/* Informações básicas */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do template *</Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Briefing Ensaio Gestante"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="categoria">Categoria</Label>
                {isLoadingCategorias ? (
                  <div className="h-10 bg-muted animate-pulse rounded-md" />
                ) : (
                  <Select value={categoria} onValueChange={setCategoria}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="geral">Geral</SelectItem>
                      {categorias.map((cat) => (
                        <SelectItem key={cat.id} value={cat.nome}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: cat.cor }}
                            />
                            {cat.nome}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Breve descrição do uso deste template"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tempo">Tempo estimado (minutos)</Label>
                <Input
                  id="tempo"
                  type="number"
                  min={1}
                  max={30}
                  value={tempoEstimado}
                  onChange={(e) => setTempoEstimado(parseInt(e.target.value) || 3)}
                />
              </div>
            </div>

            {/* Lista de campos */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Campos do formulário</Label>
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Plus className="h-4 w-4" />
                      Adicionar campo
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="z-[9999]">
                    {CAMPO_TIPOS.map((tipo) => (
                      <DropdownMenuItem key={tipo} onClick={() => addCampo(tipo)}>
                        {CAMPO_TIPO_LABELS[tipo]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {campos.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Nenhum campo adicionado. Clique em "Adicionar campo" para começar.
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={campos.map((c) => c.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {campos.map((campo) => (
                        <SortableCampoItem
                          key={campo.id}
                          campo={campo}
                          onUpdate={(updates) => updateCampo(campo.id, updates)}
                          onRemove={() => removeCampo(campo.id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!isValid || isSaving}>
            {isSaving ? 'Salvando...' : template ? 'Salvar alterações' : 'Criar template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface SortableCampoItemProps {
  campo: FormularioCampo;
  onUpdate: (updates: Partial<FormularioCampo>) => void;
  onRemove: () => void;
}

function SortableCampoItem({ campo, onUpdate, onRemove }: SortableCampoItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: campo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const showPlaceholder = !CAMPOS_SEM_PLACEHOLDER.includes(campo.tipo);

  const handleOpcoesChange = (value: string, index: number) => {
    const newOpcoes = [...(campo.opcoes || [])];
    newOpcoes[index] = value;
    onUpdate({ opcoes: newOpcoes });
  };

  const addOpcao = () => {
    onUpdate({ opcoes: [...(campo.opcoes || []), ''] });
  };

  const removeOpcao = (index: number) => {
    const newOpcoes = (campo.opcoes || []).filter((_, i) => i !== index);
    onUpdate({ opcoes: newOpcoes });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border bg-card p-4 space-y-3"
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          className="mt-2 cursor-grab touch-none text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {CAMPO_TIPO_LABELS[campo.tipo]}
            </span>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <Label htmlFor={`obrigatorio-${campo.id}`} className="text-xs">
                Obrigatório
              </Label>
              <Switch
                id={`obrigatorio-${campo.id}`}
                checked={campo.obrigatorio}
                onCheckedChange={(checked) => onUpdate({ obrigatorio: checked })}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={onRemove}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className={showPlaceholder ? "grid gap-3 sm:grid-cols-2" : ""}>
            <div className="space-y-1.5">
              <Label className="text-xs">Pergunta</Label>
              <Input
                value={campo.label}
                onChange={(e) => onUpdate({ label: e.target.value })}
                placeholder="Ex: Qual seu nome?"
              />
            </div>
            {showPlaceholder && (
              <div className="space-y-1.5">
                <Label className="text-xs">Placeholder</Label>
                <Input
                  value={campo.placeholder || ''}
                  onChange={(e) => onUpdate({ placeholder: e.target.value })}
                  placeholder="Ex: Digite seu nome"
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Texto de ajuda (opcional)</Label>
            <Input
              value={campo.descricao || ''}
              onChange={(e) => onUpdate({ descricao: e.target.value })}
              placeholder="Informação adicional para o cliente"
            />
          </div>

          {/* Opções para campos de seleção */}
          {(campo.tipo === 'selecao_unica' || campo.tipo === 'multipla_escolha') && (
            <div className="space-y-2">
              <Label className="text-xs">Opções</Label>
              {(campo.opcoes || []).map((opcao, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={opcao}
                    onChange={(e) => handleOpcoesChange(e.target.value, idx)}
                    placeholder={`Opção ${idx + 1}`}
                  />
                  {(campo.opcoes || []).length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => removeOpcao(idx)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={addOpcao}
                className="w-full"
              >
                <Plus className="h-3 w-3 mr-1" />
                Adicionar opção
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
