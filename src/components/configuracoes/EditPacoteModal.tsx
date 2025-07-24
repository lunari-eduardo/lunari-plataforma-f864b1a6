import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PacoteForm from './PacoteForm';
import { toast } from 'sonner';

interface Categoria {
  id: string;
  nome: string;
  cor: string;
}

interface ProdutoIncluido {
  produtoId: string;
  quantidade: number;
}

interface Pacote {
  id: string;
  nome: string;
  categoria_id: string;
  valor_base: number;
  valor_foto_extra: number;
  produtosIncluidos: ProdutoIncluido[];
}

interface Produto {
  id: string;
  nome: string;
  preco_custo: number;
  preco_venda: number;
}

interface EditPacoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pacote: Pacote | null;
  categorias: Categoria[];
  produtos: Produto[];
  onSave: (id: string, dados: Partial<Pacote>) => void;
}

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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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