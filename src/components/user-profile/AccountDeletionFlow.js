import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { AlertCircle, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
export function AccountDeletionFlow() {
    const { signOut } = useAuth();
    const [confirmationText, setConfirmationText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const DELETION_PHRASE = 'DELETAR MINHA CONTA';
    const handleDeleteAccount = async () => {
        if (confirmationText !== DELETION_PHRASE)
            return;
        setIsDeleting(true);
        try {
            const { error } = await supabase.functions.invoke('account-destruction');
            if (error)
                throw error;
            toast.success('Sua conta e todos os seus dados foram excluídos permanentemente.');
            await signOut();
            window.location.href = '/login';
        }
        catch (error) {
            console.error('Erro ao excluir conta:', error);
            toast.error('Erro ao excluir conta. Por favor, contate o suporte.');
        }
        finally {
            setIsDeleting(false);
        }
    };
    return (<div className="space-y-6">
      <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5"/>
          <div>
            <h4 className="font-semibold text-destructive">Zona de Perigo</h4>
            <p className="text-sm text-destructive/80 mt-1">
              A exclusão da conta é permanente e não pode ser desfeita. 
              Todos os seus dados, clientes, fotos, contratos e históricos financeiros serão removidos para sempre.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between p-4 rounded-lg border border-border/40 bg-card/40">
        <div className="min-w-0 pr-4">
          <h5 className="font-medium">Excluir minha conta</h5>
          <p className="text-sm text-muted-foreground">Exclua permanentemente sua conta e todos os dados associados.</p>
        </div>
        
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" className="gap-2 shrink-0">
              <Trash2 className="w-4 h-4"/>
              Excluir Conta
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-lunar-bg border-border/40 max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                Esta ação é irreversível. Para confirmar, digite <strong>{DELETION_PHRASE}</strong> abaixo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            
            <div className="py-4">
              <Input placeholder={DELETION_PHRASE} value={confirmationText} onChange={(e) => setConfirmationText(e.target.value)} className="bg-card/50 border-border/40 focus:ring-destructive/20"/>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel className="bg-card/50">Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={(e) => {
            e.preventDefault();
            handleDeleteAccount();
        }} disabled={confirmationText !== DELETION_PHRASE || isDeleting} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                {isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>);
}
