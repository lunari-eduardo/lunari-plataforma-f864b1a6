import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import PacoteForm from './PacoteForm';
import type { Pacote, Categoria, Produto, PacoteFormData } from '@/types/configuration';

interface PacoteEditModalProps {
  pacote: Pacote | null;
  categorias: Categoria[];
  produtos: Produto[];
  onSave: (id: string, dados: Partial<Pacote>) => void;
  onClose: () => void;
}

export default function PacoteEditModal({
  pacote,
  categorias,
  produtos,
  onSave,
  onClose
}: PacoteEditModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!pacote) return null;

  const handleSubmit = async (formData: PacoteFormData) => {
    setIsSubmitting(true);
    try {
      await onSave(pacote.id, formData);
      onClose();
    } catch (error) {
      console.error('Erro ao atualizar pacote:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const initialData: PacoteFormData = {
    nome: pacote.nome,
    categoria_id: pacote.categoria_id,
    valor_base: pacote.valor_base,
    valor_foto_extra: pacote.valor_foto_extra || 0,
    fotos_incluidas: pacote.fotos_incluidas || 0,
    produtosIncluidos: pacote.produtosIncluidos
  };

  return (
    <Dialog open={!!pacote} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-lunar-border">
          <DialogTitle className="text-lg font-medium text-foreground">
            Editar Pacote
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="py-4">
          <PacoteForm
            initialData={initialData}
            categorias={categorias}
            produtos={produtos}
            onSubmit={handleSubmit}
            onCancel={onClose}
            submitLabel={isSubmitting ? "Salvando..." : "Salvar Alterações"}
            isEditing={true}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}