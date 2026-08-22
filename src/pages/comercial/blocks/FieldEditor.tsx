import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Trash2, Loader2, Image as ImageIcon, ChevronUp, ChevronDown, Plus, Sparkles, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BlockField } from './registry';
import { uploadProposalImage } from './uploadImage';
import { useAiFieldRewrite } from '@/hooks/useProposalAI';

interface FieldEditorProps {
  field: BlockField;
  value: any;
  onChange: (value: any) => void;
  /** Contexto para a IA ajudar neste campo */
  aiContext?: {
    blockType: string;
    materialTitle?: string;
    sessionType?: string;
    tone?: string;
  };
  /** Sufixo de unicidade para o estado de loading da IA (itens de lista) */
  aiKeySuffix?: string;
}

// ============================================================
// FIELD EDITOR — renderiza um campo do schema do registry.
// Todos os formulários do painel de propriedades são gerados
// a partir daqui; adicionar um campo novo = editar o registry.
// ============================================================

const AI_ACTIONS = [
  { key: 'improve', label: 'Melhorar', description: 'Mais fluidez e persuasão' },
  { key: 'rewrite', label: 'Reescrever', description: 'Outra abordagem criativa' },
  { key: 'shorten', label: 'Encurtar', description: 'Direto ao ponto' },
  { key: 'expand', label: 'Ampliar', description: 'Mais detalhes e benefícios' },
] as const;

/** Rótulo + menu de IA (para campos textuais). Sem aiContext, rótulo simples. */
function FieldLabelWithAi({ field, value, onChange, aiContext, aiKeySuffix }: FieldEditorProps & { value: string }) {
  const { rewrite, pendingField } = useAiFieldRewrite();
  const fieldKey = aiContext ? `${aiContext.blockType}.${field.key}${aiKeySuffix ? `.${aiKeySuffix}` : ''}` : field.key;
  const isPending = pendingField === fieldKey;

  if (!aiContext) {
    return <Label className="text-xs text-muted-foreground">{field.label}</Label>;
  }

  const runAi = async (action: string) => {
    if (!value?.trim()) {
      toast.info('Escreva algum texto primeiro para a IA melhorar.');
      return;
    }
    const result = await rewrite({
      action: action as any,
      blockType: aiContext.blockType,
      fieldLabel: field.label,
      currentText: value,
      context: { materialTitle: aiContext.materialTitle, sessionType: aiContext.sessionType, tone: aiContext.tone },
      fieldKey,
    });
    if (result) {
      onChange(result);
      toast.success('Texto atualizado pela IA. Revise antes de publicar!');
    }
  };

  return (
    <div className="flex items-center justify-between">
      <Label className="text-xs text-muted-foreground">{field.label}</Label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] gap-1 text-primary hover:text-primary"
            disabled={isPending}
            title="Ajuda de texto com IA"
          >
            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            IA
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {AI_ACTIONS.map((a) => (
            <DropdownMenuItem key={a.key} onClick={() => runAi(a.key)} className="gap-2 py-2 cursor-pointer">
              <Wand2 className="h-3.5 w-3.5 text-primary" />
              <div className="flex flex-col">
                <span className="text-sm">{a.label}</span>
                <span className="text-[10px] text-muted-foreground">{a.description}</span>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function FieldEditor(props: FieldEditorProps) {
  const { field, value, onChange } = props;

  switch (field.kind) {
    case 'text':
      return (
        <div className="space-y-2">
          <FieldLabelWithAi {...props} value={value ?? ''} />
          <Input
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
          />
        </div>
      );

    case 'textarea':
      return (
        <div className="space-y-2">
          <FieldLabelWithAi {...props} value={value ?? ''} />
          <Textarea
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="min-h-[80px]"
          />
        </div>
      );

    case 'url':
      return (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">{field.label}</Label>
          <Input
            type="url"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
          />
        </div>
      );

    case 'select':
      return (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">{field.label}</Label>
          <Select value={value ?? field.options?.[0]?.value ?? ''} onValueChange={(v) => onChange(v)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );

    case 'stringlist':
      return (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">{field.label}</Label>
          <Textarea
            value={Array.isArray(value) ? value.join('\n') : ''}
            onChange={(e) => onChange(e.target.value.split('\n'))}
            placeholder={field.placeholder}
            className="min-h-[100px] font-mono text-xs"
          />
        </div>
      );

    case 'image':
      return <ImageField field={field} value={value} onChange={onChange} />;

    case 'list':
      return <ListField field={field} value={value} onChange={onChange} />;

    default:
      return null;
  }
}

function ImageField({ field, value, onChange }: FieldEditorProps) {
  const [isUploading, setIsUploading] = useState(false);
  const inputId = `img-${field.key}-${Math.random().toString(36).slice(2, 7)}`;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await uploadProposalImage(file);
      onChange(url);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao enviar imagem para a nuvem. Verifique sua conexão e tente novamente.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">{field.label}</Label>
      <div className="flex gap-3 items-center">
        <div className="h-20 w-32 shrink-0 rounded-lg border border-border bg-muted flex items-center justify-center overflow-hidden">
          {value ? (
            <img src={value} alt={field.label} className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
          )}
        </div>
        <div className="flex flex-col gap-2 flex-1">
          <Label htmlFor={inputId} className="cursor-pointer">
            <div className="flex h-8 w-full items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm hover:bg-accent hover:text-accent-foreground">
              {isUploading ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
              {value ? 'Trocar imagem' : 'Enviar imagem'}
            </div>
            <input
              type="file"
              id={inputId}
              className="hidden"
              accept="image/*"
              onChange={handleUpload}
              disabled={isUploading}
            />
          </Label>
          {value ? (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs h-8 text-destructive hover:bg-destructive/10"
              onClick={() => onChange('')}
            >
              Remover
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ListField({ field, value, onChange, aiContext }: FieldEditorProps) {
  const items: Record<string, any>[] = Array.isArray(value) ? value : [];

  const updateItem = (idx: number, itemKey: string, itemValue: any) => {
    const next = [...items];
    next[idx] = { ...next[idx], [itemKey]: itemValue };
    onChange(next);
  };

  const addItem = () => {
    onChange([...items, field.itemFactory ? field.itemFactory() : {}]);
  };

  const removeItem = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <Label className="text-xs font-bold uppercase tracking-wider text-foreground">
          {field.label}
        </Label>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[10px]"
          onClick={addItem}
        >
          <Plus className="h-3 w-3 mr-1" /> Adicionar
        </Button>
      </div>

      {items.length === 0 && (
        <p className="text-xs text-muted-foreground bg-muted/30 rounded-md p-2">
          Nenhum item ainda. Clique em "Adicionar" para criar o primeiro.
        </p>
      )}

      {items.map((item, idx) => (
        <div key={item.id ?? idx} className="space-y-2 bg-muted/30 p-2 rounded-md border border-border/50">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {field.itemLabel} {idx + 1}
            </span>
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveItem(idx, -1)} disabled={idx === 0}>
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1}>
                <ChevronDown className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:bg-destructive/10"
                onClick={() => removeItem(idx)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
          {(field.itemFields ?? []).map((sub) => (
            <FieldEditor
              key={sub.key}
              field={sub}
              value={item[sub.key]}
              onChange={(v) => updateItem(idx, sub.key, v)}
              aiContext={aiContext}
              aiKeySuffix={String(idx)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
