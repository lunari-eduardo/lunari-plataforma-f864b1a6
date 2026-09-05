import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, LayoutTemplate } from 'lucide-react';

interface SaveTemplateModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  templateName: string;
  setTemplateName: (val: string) => void;
  onSave: () => void;
  isSaving: boolean;
}

export function SaveTemplateModal({
  isOpen,
  onOpenChange,
  templateName,
  setTemplateName,
  onSave,
  isSaving,
}: SaveTemplateModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Salvar como Modelo</DialogTitle>
          <DialogDescription>
            O conteúdo atual desta proposta (blocos + paleta) fica disponível como modelo no wizard de criação.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="template-name" className="text-sm font-medium">Nome do modelo</label>
            <Input
              id="template-name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Ex: Gestante Premium"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={onSave}
            disabled={!templateName.trim() || isSaving}
            className="gap-2"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <LayoutTemplate className="h-4 w-4" />}
            Salvar Modelo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
