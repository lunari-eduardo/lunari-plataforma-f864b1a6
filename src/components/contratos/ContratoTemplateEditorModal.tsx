import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ContratoRichEditor } from './ContratoRichEditor';
import { VARIAVEIS_DISPONIVEIS } from '@/utils/contratoVariables';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ContratoTemplate } from '@/types/contrato';

interface ContratoTemplateEditorModalProps {
  open: boolean;
  onClose: () => void;
  template?: ContratoTemplate | null;
  onSave: (data: { nome: string; descricao?: string; categoria?: string; conteudo: string; is_padrao?: boolean }) => Promise<void>;
}

export function ContratoTemplateEditorModal({ open, onClose, template, onSave }: ContratoTemplateEditorModalProps) {
  const [nome, setNome] = useState(template?.nome || '');
  const [descricao, setDescricao] = useState(template?.descricao || '');
  const [categoria, setCategoria] = useState(template?.categoria || 'geral');
  const [conteudo, setConteudo] = useState(template?.conteudo || '');
  const [isPadrao, setIsPadrao] = useState(template?.is_padrao || false);
  const [saving, setSaving] = useState(false);

  // Reset state when template changes / modal reopens
  const [lastId, setLastId] = useState(template?.id);
  if (template?.id !== lastId) {
    setLastId(template?.id);
    setNome(template?.nome || '');
    setDescricao(template?.descricao || '');
    setCategoria(template?.categoria || 'geral');
    setConteudo(template?.conteudo || '');
    setIsPadrao(template?.is_padrao || false);
  }

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

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{template ? 'Editar modelo de contrato' : 'Novo modelo de contrato'}</DialogTitle>
          <DialogDescription>
            Use variáveis como <code>{`{{cliente_nome}}`}</code> que serão substituídas automaticamente ao gerar o contrato.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-4 flex-1 overflow-hidden">
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
            <h4 className="text-sm font-semibold mb-2">Variáveis disponíveis</h4>
            <p className="text-[11px] text-muted-foreground mb-3">Clique para adicionar ao final do conteúdo.</p>
            <ScrollArea className="h-[440px] pr-2">
              <div className="space-y-3">
                {(['cliente', 'sessao', 'fotografo', 'contrato'] as const).map((grupo) => (
                  <div key={grupo}>
                    <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">{grupo}</div>
                    <div className="space-y-1">
                      {VARIAVEIS_DISPONIVEIS.filter((v) => v.grupo === grupo).map((v) => (
                        <button
                          key={v.key}
                          type="button"
                          onClick={() => insertVariableAtCursor(v.key)}
                          className="w-full text-left text-[11px] px-2 py-1.5 rounded hover:bg-muted transition-colors"
                        >
                          <div className="font-mono text-primary">{`{{${v.key}}}`}</div>
                          <div className="text-muted-foreground">{v.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
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
