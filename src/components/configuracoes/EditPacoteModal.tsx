import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PacoteForm from './PacoteForm';
import { toast } from 'sonner';
import type { 
  Categoria, 
  Pacote, 
  Produto, 
  EditPacoteModalProps 
} from '@/types/configuration';


export default function EditPacoteModal({ 
  open, 
  onOpenChange, 
  pacote, 
  categorias, 
  produtos, 
  onSave 
}: EditPacoteModalProps) {
  const handleSubmit = (formData: any) => {
    if (!pacote) return;
    
    onSave(pacote.id, formData);
    onOpenChange(false);
    toast.success('Pacote atualizado com sucesso!');
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  if (!pacote) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-elegant">
        <DialogHeader>
          <DialogTitle>Editar Pacote</DialogTitle>
        </DialogHeader>
        
        <PacoteForm
          initialData={{
            nome: pacote.nome,
            categoria_id: pacote.categoria_id,
            valor_base: pacote.valor_base,
            valor_foto_extra: pacote.valor_foto_extra,
            produtosIncluidos: pacote.produtosIncluidos
          }}
          categorias={categorias}
          produtos={produtos}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          submitLabel="Atualizar Pacote"
          isEditing={true}
        />
      </DialogContent>
    </Dialog>
  );
}