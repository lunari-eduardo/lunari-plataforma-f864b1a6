import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { AlertCircle, Trash2, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export function AccountDeletionFlow() {
  const { signOut } = useAuth();
  const [confirmationText, setConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const DELETION_PHRASE = 'DELETAR MINHA CONTA';

  const handleDeleteAccount = async () => {
    if (confirmationText !== DELETION_PHRASE) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase.functions.invoke('account-destruction');
      
      if (error) throw error;

      setIsSuccess(true);
      // Wait a bit to show the success message before signing out
      setTimeout(async () => {
        await signOut();
        window.location.href = '/login';
      }, 5000);
    } catch (error: any) {
      console.error('Erro ao solicitar exclusão:', error);
      toast.error('Erro ao solicitar exclusão. Por favor, contate o suporte.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="p-6 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
          <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6 text-green-500" />
          </div>
          <h4 className="font-semibold text-green-500 text-lg">Solicitação Registrada</h4>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Sua solicitação de exclusão foi registrada com sucesso.
          </p>
          <div className="mt-6 text-left space-y-4 text-sm bg-card/40 p-4 rounded-md border border-border/40">
            <p>• Sua conta permanecerá em retenção por <strong>30 dias</strong> e será excluída definitivamente após esse período.</p>
            <p>• Caso deseje cancelar a exclusão antes do prazo final, entre em contato pelo e-mail <strong>contato@lunarihub.com</strong>.</p>
          </div>
          <p className="text-xs text-muted-foreground mt-6 italic">
            Você será desconectado em alguns instantes...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-destructive text-sm uppercase tracking-wider">Período de Retenção</h4>
            <p className="text-sm text-destructive/80 mt-1">
              Ao solicitar a exclusão, sua conta será desativada imediatamente. Seus dados serão mantidos por 30 dias antes da remoção definitiva, período em que você poderá solicitar a recuperação.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between p-4 rounded-lg border border-border/40 bg-card/40">
        <div className="min-w-0 pr-4">
          <h5 className="font-medium">Solicitar exclusão da conta</h5>
          <p className="text-sm text-muted-foreground">Inicia o processo de desativação e exclusão definitiva em 30 dias.</p>
        </div>
        
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" className="gap-2 shrink-0">
              <Trash2 className="w-4 h-4" />
              Excluir Conta
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-lunar-bg border-border/40 max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl">Excluir conta</AlertDialogTitle>
              <div className="text-sm text-muted-foreground space-y-4 py-2">
                <p>Você está solicitando a exclusão da sua conta Lunari.</p>
                
                <div className="bg-card/50 p-3 rounded-md border border-border/40 space-y-2 text-foreground/90">
                  <p>• Sua conta será desativada imediatamente e ficará em período de retenção por <strong>30 dias</strong>.</p>
                  <p>• Durante esse período você poderá solicitar a recuperação da conta entrando em contato com nossa equipe.</p>
                  <p>• Após o término dos 30 dias, a exclusão será <strong>definitiva e irreversível</strong>.</p>
                </div>

                <div className="space-y-1">
                  <p className="font-medium text-foreground">Serão removidos permanentemente:</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs list-disc pl-4">
                    <div>• Conta e perfil</div>
                    <div>• Clientes</div>
                    <div>• Agenda</div>
                    <div>• Workflow</div>
                    <div>• Financeiro</div>
                    <div>• Produtos e serviços</div>
                    <div>• Configurações</div>
                    <div>• Galerias</div>
                    <div>• Fotografias</div>
                    <div>• Arquivos enviados</div>
                  </div>
                </div>

                <p className="text-xs italic text-destructive/90">Esta ação não poderá ser desfeita após o período de retenção.</p>
                
                <p>Para confirmar, digite <strong>{DELETION_PHRASE}</strong> abaixo.</p>
              </div>
            </AlertDialogHeader>
            
            <div className="py-2">
              <Input
                placeholder={DELETION_PHRASE}
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                className="bg-card/50 border-border/40 focus:ring-destructive/20"
              />
            </div>

            <AlertDialogFooter className="mt-4">
              <AlertDialogCancel className="bg-card/50">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault();
                  handleDeleteAccount();
                }}
                disabled={confirmationText !== DELETION_PHRASE || isDeleting}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                {isDeleting ? 'Processando...' : 'Solicitar exclusão'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

