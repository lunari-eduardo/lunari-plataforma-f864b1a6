import { useState } from 'react';
import { useContratos } from '@/hooks/useContratos';
import { useUserProfile } from '@/hooks/useUserProfile';
import { downloadContratoPdf } from '@/utils/contratoPdf';
import { Button } from '@/components/ui/button';
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
import {
  FileSignature,
  Plus,
  FileText,
  Eye,
  Download,
  Send,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { ContratoStatusBadge } from './ContratoStatusBadge';
import { NovoContratoModal } from './NovoContratoModal';
import { ContratoViewerModal } from './ContratoViewerModal';
import { CompactItemRow } from '@/components/cliente-detalhe/shared/CompactItemRow';
import type { Contrato } from '@/types/contrato';

interface ClienteContratosListProps {
  clienteId: string;
  clienteNome?: string;
}

export function ClienteContratosList({ clienteId, clienteNome }: ClienteContratosListProps) {
  const { contratos, isLoading, remove, setStatus } = useContratos({ clienteId });
  const { profile } = useUserProfile();
  const [novoOpen, setNovoOpen] = useState(false);
  const [viewing, setViewing] = useState<Contrato | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Contrato | null>(null);

  const handleDownloadPdf = async (c: Contrato) => {
    try {
      console.info('[Contrato PDF] Download iniciado (CRM)', {
        contratoId: c.id,
        titulo: c.titulo,
        tamanhoConteudo: (c.conteudo || '').length,
      });
      const snap = (c.variaveis_snapshot || {}) as Record<string, any>;
      await downloadContratoPdf({
        titulo: c.titulo,
        conteudoHtml: c.conteudo,
        fotografoNome: profile?.nome || snap.nome_fotografo || undefined,
        fotografoEmail: profile?.email || snap.email_fotografo || undefined,
        fotografoDocumento: (profile as any)?.cpf_cnpj || snap.documento_fotografo || undefined,
        clienteNome: c.cliente?.nome || clienteNome || snap.nome_cliente || undefined,
        clienteEmail: c.cliente?.email || snap.email_cliente || undefined,
        clienteDocumento: snap.documento_cliente || snap.cpf_cliente || undefined,
        cidadeLocal: snap.cidade_atual || snap.cidade_fotografo || snap.cidade_cliente || undefined,
        variaveisSnapshot: snap,
        filename: `${c.titulo}.pdf`,
      });
    } catch (err: any) {
      console.error('[Contrato PDF] Falha ao baixar:', err);
      const { toast } = await import('@/hooks/use-toast');
      toast({
        title: 'Erro ao gerar PDF',
        description: err?.message || 'Tente novamente em alguns instantes.',
        variant: 'destructive',
      });
    }
  };

  const handleMarcarEnviado = async (c: Contrato) => {
    await setStatus({ id: c.id, status: 'enviado' });
  };

  const handleMarcarAssinado = async (c: Contrato) => {
    await setStatus({ id: c.id, status: 'assinado' });
  };

  const handleDelete = async (id: string) => {
    try {
      await remove(id);
    } catch {
      // erro tratado pelo hook
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <FileSignature className="h-4 w-4 text-primary" />
          Contratos
          <span className="text-xs text-muted-foreground font-normal">({contratos.length})</span>
        </h3>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setNovoOpen(true)}>
          <Plus className="h-3 w-3 mr-1" />
          Novo contrato
        </Button>
      </div>

      {isLoading ? (
        <div className="text-xs text-muted-foreground py-4 text-center">Carregando...</div>
      ) : contratos.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          Nenhum contrato gerado para este cliente
        </p>
      ) : (
        <div className="space-y-1.5">
          {contratos.map((c) => {
            const meta = `Criado em ${new Date(c.created_at).toLocaleDateString('pt-BR')}${
              c.session_id ? ' · vinculado a sessão' : ''
            }`;

            const menuItems = [
              {
                label: 'Abrir',
                icon: <Eye className="h-3.5 w-3.5" />,
                onClick: () => setViewing(c),
              },
              {
                label: 'Baixar PDF',
                icon: <Download className="h-3.5 w-3.5" />,
                onClick: () => handleDownloadPdf(c),
              },
              ...(c.status === 'rascunho'
                ? [{
                    label: 'Marcar como enviado',
                    icon: <Send className="h-3.5 w-3.5" />,
                    onClick: () => handleMarcarEnviado(c),
                  }]
                : []),
              ...(c.status === 'enviado'
                ? [{
                    label: 'Marcar como assinado',
                    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
                    onClick: () => handleMarcarAssinado(c),
                  }]
                : []),
              {
                label: 'Excluir',
                icon: <Trash2 className="h-3.5 w-3.5" />,
                variant: 'destructive' as const,
                separatorBefore: true,
                onClick: () => setConfirmDelete(c),
              },
            ];

            return (
              <CompactItemRow
                key={c.id}
                icon={<FileText className="h-4 w-4" />}
                title={c.titulo}
                meta={meta}
                status={<ContratoStatusBadge status={c.status} />}
                primaryAction={{
                  label: 'Abrir',
                  icon: <Eye className="h-3.5 w-3.5" />,
                  onClick: () => setViewing(c),
                }}
                menuItems={menuItems}
                onRowClick={() => setViewing(c)}
              />
            );
          })}
        </div>
      )}

      <NovoContratoModal
        open={novoOpen}
        onClose={() => setNovoOpen(false)}
        clienteId={clienteId}
        clienteNome={clienteNome}
      />

      {viewing && (
        <ContratoViewerModal
          open={!!viewing}
          onClose={() => setViewing(null)}
          contrato={viewing}
        />
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contrato?</AlertDialogTitle>
            <AlertDialogDescription>
              O contrato <strong>"{confirmDelete?.titulo}"</strong> será removido permanentemente.
              Esta ação não pode ser desfeita.
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
