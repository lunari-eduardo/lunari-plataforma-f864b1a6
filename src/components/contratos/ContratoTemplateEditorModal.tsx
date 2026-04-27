import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ContratoRichEditor, type ContratoRichEditorHandle } from './ContratoRichEditor';
import { VARIAVEIS_DISPONIVEIS } from '@/utils/contratoVariables';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, CheckCircle2, AlertCircle } from 'lucide-react';
import type { ContratoTemplate } from '@/types/contrato';
import type { ContratoSeedTemplate } from '@/utils/contratoSeedTemplates';

interface ContratoTemplateEditorModalProps {
  open: boolean;
  onClose: () => void;
  template?: ContratoTemplate | null;
  /** Pré-preenchimento opcional vindo de um modelo pronto (seed) */
  seedDraft?: ContratoSeedTemplate | null;
  onSave: (data: { nome: string; descricao?: string; categoria?: string; conteudo: string; is_padrao?: boolean }) => Promise<void>;
}

export function ContratoTemplateEditorModal({ open, onClose, template, seedDraft, onSave }: ContratoTemplateEditorModalProps) {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('geral');
  const [conteudo, setConteudo] = useState('');
  const [isPadrao, setIsPadrao] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showLegacy, setShowLegacy] = useState(false);
  const editorRef = useRef<ContratoRichEditorHandle>(null);

  // Origem do conteúdo — usada como key para forçar remount limpo do editor
  const editorKey = template
    ? `template-${template.id}`
    : seedDraft
      ? `seed-${seedDraft.slug}`
      : 'new';

  // Sincroniza estado quando o modal abre ou troca de origem
  useEffect(() => {
    if (!open) return;
    if (template) {
      setNome(template.nome);
      setDescricao(template.descricao || '');
      setCategoria(template.categoria || 'geral');
      setConteudo(template.conteudo || '');
      setIsPadrao(template.is_padrao || false);
    } else if (seedDraft) {
      setNome(seedDraft.nome);
      setDescricao(seedDraft.descricao);
      setCategoria(seedDraft.categoria);
      setConteudo(seedDraft.conteudo);
      setIsPadrao(false);
    } else {
      setNome('');
      setDescricao('');
      setCategoria('geral');
      setConteudo('');
      setIsPadrao(false);
    }
  }, [open, template?.id, seedDraft?.slug]);

  const handleSave = async () => {
    if (!nome.trim() || !conteudo.trim()) return;
    setSaving(true);
    try {
      await onSave({ nome, descricao, categoria, conteudo, is_padrao: isPadrao });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  /** Insere a variável na posição atual do cursor (fallback: append ao final). */
  const insertVariable = (key: string) => {
    if (editorRef.current?.insertVariableAtCursor) {
      editorRef.current.insertVariableAtCursor(key);
      return;
    }
    setConteudo((prev) => {
      const trimmed = (prev || '').trimEnd();
      return `${trimmed}<p>{{${key}}}</p>`;
    });
  };

  const autoVars = VARIAVEIS_DISPONIVEIS.filter((v) => v.tipo === 'auto');
  const editavelVars = VARIAVEIS_DISPONIVEIS.filter((v) => v.tipo === 'editavel');
  const legacyVars = VARIAVEIS_DISPONIVEIS.filter((v) => v.tipo === 'legacy');

  const renderVarButton = (v: typeof VARIAVEIS_DISPONIVEIS[number]) => {
    const isAuto = v.tipo === 'auto';
    const chipClass = isAuto
      ? 'bg-primary/10 text-primary'
      : v.tipo === 'editavel'
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
        : 'bg-muted text-muted-foreground';
    return (
      <button
        key={v.key}
        type="button"
        // Evita roubar o foco do editor ANTES do clique — preserva a seleção/caret.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => insertVariable(v.key)}
        className="w-full text-left text-[11px] px-2 py-1.5 rounded hover:bg-muted transition-colors"
      >
        <div className={`font-mono inline-block px-1.5 py-0.5 rounded ${chipClass}`}>{`{{${v.key}}}`}</div>
        <div className="text-muted-foreground mt-0.5">{v.label}</div>
      </button>
    );
  };

  // Indicador de conteúdo carregado
  const conteudoLimpo = (conteudo || '').replace(/<[^>]+>/g, '').trim();
  const conteudoCharCount = conteudoLimpo.length;
  const temConteudo = conteudoCharCount > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {template ? 'Editar modelo de contrato' : seedDraft ? `Revisar: ${seedDraft.nome}` : 'Novo modelo de contrato'}
          </DialogTitle>
          <DialogDescription>
            Use variáveis como <code>{`{{nome_cliente}}`}</code> que serão substituídas automaticamente ao gerar o contrato.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-4 flex-1 overflow-hidden">
          <div className="space-y-3 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="nome">Nome do modelo</Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Contrato padrão de fotografia" />
              </div>
              <div>
                <Label htmlFor="categoria">Categoria</Label>
                <Input id="categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="geral, casamento..." />
              </div>
            </div>
            <div>
              <Label htmlFor="descricao">Descrição (opcional)</Label>
              <Textarea id="descricao" value={descricao || ''} onChange={(e) => setDescricao(e.target.value)} rows={2} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Conteúdo do contrato</Label>
                <span
                  className={`flex items-center gap-1 text-[11px] ${temConteudo ? 'text-emerald-600' : 'text-amber-600'}`}
                >
                  {temConteudo ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" />
                      Conteúdo carregado · {conteudoCharCount} caracteres
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-3 w-3" />
                      Sem conteúdo
                    </>
                  )}
                </span>
              </div>
              <ContratoRichEditor
                ref={editorRef}
                key={editorKey}
                value={conteudo}
                onChange={setConteudo}
                minHeight="380px"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="padrao" checked={isPadrao} onCheckedChange={setIsPadrao} />
              <Label htmlFor="padrao" className="cursor-pointer">Definir como modelo padrão</Label>
            </div>
          </div>

          <div className="border-l border-border pl-4 hidden md:block">
            <h4 className="text-sm font-semibold mb-1">Variáveis</h4>
            <p className="text-[11px] text-muted-foreground mb-3 leading-snug">
              <span className="inline-block w-2 h-2 rounded-sm bg-primary/40 align-middle mr-1" /> Azul: preenchido pelo sistema.<br/>
              <span className="inline-block w-2 h-2 rounded-sm bg-amber-300 align-middle mr-1" /> Amarelo: campo editável (você ajusta).
            </p>
            <ScrollArea className="h-[440px] pr-2">
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase text-primary mb-1 flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-sm bg-primary/60" />
                    Automáticas (sistema)
                  </div>
                  <div className="space-y-1">{autoVars.map(renderVarButton)}</div>
                </div>

                <div>
                  <div className="text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-sm bg-amber-400" />
                    Campos editáveis
                  </div>
                  <div className="space-y-1">{editavelVars.map(renderVarButton)}</div>
                </div>

                <Collapsible open={showLegacy} onOpenChange={setShowLegacy}>
                  <CollapsibleTrigger className="flex items-center gap-1 text-[10px] font-semibold uppercase text-muted-foreground hover:text-foreground transition-colors w-full">
                    <ChevronDown className={`h-3 w-3 transition-transform ${showLegacy ? '' : '-rotate-90'}`} />
                    Variáveis legadas
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-1 space-y-1">
                    {legacyVars.map(renderVarButton)}
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !nome.trim() || !temConteudo}>
            {saving ? 'Salvando...' : 'Salvar modelo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
