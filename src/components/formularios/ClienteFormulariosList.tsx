import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { FileText, Send, Copy, Eye, Clock, Loader2, Plus } from 'lucide-react';
import { useFormulariosByCliente } from '@/hooks/useFormularios';
import { SendBriefingModal } from './SendBriefingModal';
import { FormularioRespostasView } from './FormularioRespostasView';
import { STATUS_ENVIO_LABELS, FormularioCampo } from '@/types/formulario';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [viewRespostas, setViewRespostas] = useState<{
    id: string;
    titulo: string;
    campos: FormularioCampo[];
  } | null>(null);

  const handleCopyLink = (token: string) => {
    const link = `${window.location.origin}/formulario/${token}`;
    navigator.clipboard.writeText(link);
    toast({ title: 'Link copiado!' });
  };

  const getStatusBadge = (statusEnvio: string) => {
    switch (statusEnvio) {
      case 'respondido':
        return <Badge className="bg-green-500/15 text-green-600 border-green-500/30 text-[10px]">✅ Respondido</Badge>;
      case 'enviado':
        return <Badge className="bg-yellow-500/15 text-yellow-600 border-yellow-500/30 text-[10px]">⏳ Aguardando</Badge>;
      case 'expirado':
        return <Badge className="bg-red-500/15 text-red-600 border-red-500/30 text-[10px]">Expirado</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px]">Rascunho</Badge>;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Formulários / Briefings
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
        <div className="space-y-2">
          {formularios.map((form) => (
            <div
              key={form.id}
              className="border rounded-lg p-3 space-y-2 hover:bg-accent/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{form.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    {form.enviado_em
                      ? `Enviado em ${format(new Date(form.enviado_em), "dd/MM/yyyy", { locale: ptBR })}`
                      : `Criado em ${format(new Date(form.created_at), "dd/MM/yyyy", { locale: ptBR })}`}
                  </p>
                </div>
                {getStatusBadge(form.status_envio)}
              </div>

              <div className="flex gap-1.5">
                {form.status_envio === 'respondido' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs flex-1"
                    onClick={() => setViewRespostas({
                      id: form.id,
                      titulo: form.titulo,
                      campos: form.campos,
                    })}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Ver respostas
                  </Button>
                ) : form.public_token ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs flex-1"
                    onClick={() => handleCopyLink(form.public_token)}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copiar link
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
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
    </div>
  );
}
