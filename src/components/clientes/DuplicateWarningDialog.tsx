import { Cliente } from '@/types/cliente';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Edit2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DuplicateWarningDialogProps {
  open: boolean;
  cliente: Cliente | null;
  onEditExisting: () => void;
  onCreateAnyway: () => void;
  onCancel: () => void;
}

export const DuplicateWarningDialog = ({
  open,
  cliente,
  onEditExisting,
  onCreateAnyway,
  onCancel
}: DuplicateWarningDialogProps) => {
  if (!cliente) return null;

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent className="sm:max-w-[500px]">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-xl">
              Cliente Duplicado
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base">
            Já existe um cliente cadastrado com este nome exato:
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="bg-muted/50 rounded-lg p-4 space-y-2 my-4">
          <div>
            <span className="text-sm font-medium text-muted-foreground">Nome:</span>
            <p className="text-base font-medium">{cliente.nome}</p>
          </div>
          
          {cliente.email && (
            <div>
              <span className="text-sm font-medium text-muted-foreground">E-mail:</span>
              <p className="text-base">{cliente.email}</p>
            </div>
          )}
          
          {cliente.telefone && (
            <div>
              <span className="text-sm font-medium text-muted-foreground">Telefone:</span>
              <p className="text-base">{cliente.telefone}</p>
            </div>
          )}
          
          {cliente.origem && (
            <div>
              <span className="text-sm font-medium text-muted-foreground">Origem:</span>
              <p className="text-base">{cliente.origem}</p>
            </div>
          )}
        </div>

        <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 flex gap-2">
          <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            Criar um novo cliente com o mesmo nome pode causar confusão e duplicação de dados.
          </p>
        </div>

        <AlertDialogFooter className="flex-col sm:flex-col gap-2 sm:gap-2">
          <Button
            onClick={onEditExisting}
            className="w-full flex items-center justify-center gap-2"
          >
            <Edit2 className="h-4 w-4" />
            Editar Cliente Existente
          </Button>
          
          <Button
            onClick={onCreateAnyway}
            variant="secondary"
            className="w-full"
          >
            Criar Mesmo Assim
          </Button>
          
          <Button
            onClick={onCancel}
            variant="outline"
            className="w-full"
          >
            Cancelar
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
