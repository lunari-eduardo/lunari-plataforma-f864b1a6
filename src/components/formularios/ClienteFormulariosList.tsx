import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { FileText, Copy, Eye, Loader2, Plus, Trash2 } from 'lucide-react';
import { useFormulariosByCliente } from '@/hooks/useFormulariosByCliente';
import { useFormularios } from '@/hooks/useFormularios';
import { SendBriefingModal } from './SendBriefingModal';
import { FormularioRespostasView } from './FormularioRespostasView';
import { FormularioCampo } from '@/types/formulario';
import { getPublicShareBaseUrl } from '@/utils/domainUtils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CompactItemRow } from '@/components/cliente-detalhe/shared/CompactItemRow';

interface ClienteFormulariosListProps {
  clienteId: string;
  clienteNome: string;
  clienteTelefone?: string;
}

export function ClienteFormulariosList({
  clienteId,
  clienteNome,
  clienteTelefone,
}: ClienteFormulariosListProps) {
  const { data: formularios = [], isLoading } = useFormulariosByCliente(clienteId);
  const { deleteFormulario } = useFormularios();
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [viewRespostas, setViewRespostas] = useState<{
    id: string;
    titulo: string;
    campos: FormularioCampo[];
  } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; titulo: string } | null>(null);

  const handleCopyLink = (token: string) => {
    const link = `${getPublicShareBaseUrl()}/formulario/${token}`;
    navigator.clipboard.writeText(link);
    toast({ title: 'Link copiado!' });
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteFormulario(id);
    } catch {
      // toast de erro já tratado no hook
    }
  };

  const getStatusBadge = (statusEnvio: string) => {
    switch (statusEnvio) {
      case 'respondido':
        return <Badge className="bg-green-500/15 text-green-600 border-green-500/30 text-[10px] px-2 py-0">Respondido</Badge>;
      case 'enviado':
        return <Badge className="bg-yellow-500/15 text-yellow-600 border-yellow-500/30 text-[10px] px-2 py-0">Aguardando</Badge>;
      case 'expirado':
        return <Badge className="bg-red-500/15 text-red-600 border-red-500/30 text-[10px] px-2 py-0">Expirado</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px] px-2 py-0">Rascunho</Badge>;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Formulários / Briefings
          <span className="text-xs text-muted-foreground font-normal">({formularios.length})</span>
        </h3>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSendModalOpen(true)}>
          <Plus className="h-3 w-3 mr-1" />
          Enviar briefing
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : formularios.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          Nenhum formulário enviado para este cliente
        </p>
      ) : (
        <div className="space-y-1.5">
          {formularios.map((form) => {
            const isResponded = form.status_envio === 'respondido';
            const meta = form.enviado_em
              ? `Enviado em ${format(new Date(form.enviado_em), 'dd/MM/yyyy', { locale: ptBR })}`
              : `Criado em ${format(new Date(form.created_at), 'dd/MM/yyyy', { locale: ptBR })}`;

            const primaryAction = isResponded
              ? {
                  label: 'Ver respostas',
                  icon: <Eye className="h-3.5 w-3.5" />,
                  onClick: () =>
                    setViewRespostas({ id: form.id, titulo: form.titulo, campos: form.campos }),
                }
              : form.public_token
              ? {
                  label: 'Copiar link',
                  icon: <Copy className="h-3.5 w-3.5" />,
                  onClick: () => handleCopyLink(form.public_token),
                }
              : undefined;

            const menuItems = [
              ...(isResponded
                ? [{
                    label: 'Ver respostas',
                    icon: <Eye className="h-3.5 w-3.5" />,
                    onClick: () => setViewRespostas({ id: form.id, titulo: form.titulo, campos: form.campos }),
                  }]
                : []),
              ...(form.public_token
                ? [{
                    label: 'Copiar link',
                    icon: <Copy className="h-3.5 w-3.5" />,
                    onClick: () => handleCopyLink(form.public_token),
                  }]
                : []),
              {
                label: 'Excluir',
                icon: <Trash2 className="h-3.5 w-3.5" />,
                variant: 'destructive' as const,
                separatorBefore: true,
                onClick: () => {
                  if (isResponded) {
                    setConfirmDelete({ id: form.id, titulo: form.titulo });
                  } else {
                    handleDelete(form.id);
                  }
                },
              },
            ];

            return (
              <CompactItemRow
                key={form.id}
                icon={<FileText className="h-4 w-4" />}
                title={form.titulo}
                meta={meta}
                status={getStatusBadge(form.status_envio)}
                primaryAction={primaryAction}
                menuItems={menuItems}
                onRowClick={primaryAction?.onClick}
              />
            );
          })}
        </div>
      )}

      <SendBriefingModal
        open={sendModalOpen}
        onOpenChange={setSendModalOpen}
        clienteId={clienteId}
        clienteNome={clienteNome}
        clienteTelefone={clienteTelefone}
      />

      {viewRespostas && (
        <FormularioRespostasView
          open={!!viewRespostas}
          onOpenChange={(open) => !open && setViewRespostas(null)}
          formularioId={viewRespostas.id}
          titulo={viewRespostas.titulo}
          campos={viewRespostas.campos}
        />
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir briefing respondido?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação excluirá também todas as respostas enviadas pelo cliente para
              <strong> "{confirmDelete?.titulo}"</strong>. Esta operação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDelete) handleDelete(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
