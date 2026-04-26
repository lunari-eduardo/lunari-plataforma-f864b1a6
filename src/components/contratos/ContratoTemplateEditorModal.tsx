import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ContratoRichEditor } from './ContratoRichEditor';
import { VARIAVEIS_DISPONIVEIS } from '@/utils/contratoVariables';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
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

  // Sincroniza estado quando o modal abre ou troca de origem (template existente vs seed vs novo)
  useEffect(() => {
    if (!open) return;
    if (template) {
      setNome(template.nome);
      setDescricao(template.descricao || '');
      setCategoria(template.categoria || 'geral');
      setConteudo(template.conteudo);
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

  const insertVariableAtCursor = (key: string) => {
    setConteudo((prev) => `${prev}<p>{{${key}}}</p>`);
  };

  const padraoVars = VARIAVEIS_DISPONIVEIS.filter((v) => v.grupo === 'padrao');
  const manualVars = VARIAVEIS_DISPONIVEIS.filter((v) => v.grupo === 'manual' || v.grupo === 'contrato');
  const legacyVars = VARIAVEIS_DISPONIVEIS.filter((v) => ['cliente', 'sessao', 'fotografo'].includes(v.grupo));

  const renderVarButton = (v: typeof VARIAVEIS_DISPONIVEIS[number]) => (
    <button
      key={v.key}
      type="button"
      onClick={() => insertVariableAtCursor(v.key)}
      className="w-full text-left text-[11px] px-2 py-1.5 rounded hover:bg-muted transition-colors"
    >
      <div className="font-mono text-primary">{`{{${v.key}}}`}</div>
      <div className="text-muted-foreground">{v.label}</div>
    </button>
  );

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
              <Label>Conteúdo do contrato</Label>
              <ContratoRichEditor value={conteudo} onChange={setConteudo} minHeight="380px" />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="padrao" checked={isPadrao} onCheckedChange={setIsPadrao} />
              <Label htmlFor="padrao" className="cursor-pointer">Definir como modelo padrão</Label>
            </div>
          </div>

          <div className="border-l border-border pl-4 hidden md:block">
            <h4 className="text-sm font-semibold mb-1">Variáveis</h4>
            <p className="text-[11px] text-muted-foreground mb-3">Clique para adicionar ao final.</p>
            <ScrollArea className="h-[440px] pr-2">
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase text-primary mb-1">Padrão recomendado</div>
                  <div className="space-y-1">{padraoVars.map(renderVarButton)}</div>
                </div>

                <div>
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Manuais & data</div>
                  <div className="space-y-1">{manualVars.map(renderVarButton)}</div>
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
          <Button onClick={handleSave} disabled={saving || !nome.trim() || !conteudo.trim()}>
            {saving ? 'Salvando...' : 'Salvar modelo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
