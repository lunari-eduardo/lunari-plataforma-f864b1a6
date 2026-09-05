import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2 } from 'lucide-react';

interface CustomizeSlugModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  slugInput: string;
  setSlugInput: (val: string) => void;
  currentSlug?: string;
  onSave: () => void;
  isPending: boolean;
}

export function CustomizeSlugModal({
  isOpen,
  onOpenChange,
  slugInput,
  setSlugInput,
  currentSlug,
  onSave,
  isPending,
}: CustomizeSlugModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Personalizar Link Público</DialogTitle>
          <DialogDescription>
            Crie um endereço amigável para este material. O endereço atual continuará funcionando.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="slug" className="text-sm font-medium">Link personalizado</label>
            <div className="flex items-center rounded-md border border-input bg-transparent px-3 py-1 shadow-sm focus-within:ring-1 focus-within:ring-ring">
              <span className="text-muted-foreground text-sm select-none truncate max-w-[120px]">
                {window.location.host}/
              </span>
              <input
                id="slug"
                value={slugInput}
                onChange={(e) => setSlugInput(e.target.value)}
                className="flex h-8 w-full rounded-md bg-transparent text-sm shadow-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="ex: gestante-maria"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={onSave}
            disabled={!slugInput.trim() || isPending || slugInput === currentSlug}
            className="gap-2"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Salvar Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
