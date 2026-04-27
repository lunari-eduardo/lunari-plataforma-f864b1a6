import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ContratoRichEditor } from './ContratoRichEditor';
import { ContratoStatusBadge } from './ContratoStatusBadge';
import { useContratos } from '@/hooks/useContratos';
import { useUserProfile } from '@/hooks/useUserProfile';
import { downloadContratoPdf } from '@/utils/contratoPdf';
import { Download, Send, CheckCircle2, Upload, FileText, Save, Trash2, Paperclip } from 'lucide-react';
import type { Contrato } from '@/types/contrato';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface ContratoViewerModalProps {
  open: boolean;
  onClose: () => void;
  contrato: Contrato;
}

export function ContratoViewerModal({ open, onClose, contrato }: ContratoViewerModalProps) {
  const { profile } = useUserProfile();
  const { update, setStatus, remove, uploadAssinado, getSignedUrl } = useContratos({ clienteId: contrato.cliente_id });
  const [conteudo, setConteudo] = useState(contrato.conteudo);
  const [titulo, setTitulo] = useState(contrato.titulo);
  const [saving, setSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isAssinado = contrato.status === 'assinado';
  const isEditable = !isAssinado;

  const handleSave = async () => {
    setSaving(true);
    try {
      await update({ id: contrato.id, titulo, conteudo });
      toast({ title: 'Alterações salvas' });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      console.info('[Contrato PDF] Download iniciado (Workflow/Modal)', {
        contratoId: contrato.id,
        titulo,
        tamanhoConteudo: (conteudo || '').length,
        editado: conteudo !== contrato.conteudo,
      });
      const snap = (contrato.variaveis_snapshot || {}) as Record<string, any>;
      await downloadContratoPdf({
        titulo,
        conteudoHtml: conteudo,
        fotografoNome: profile?.nome || snap.nome_fotografo || undefined,
        fotografoEmail: profile?.email || snap.email_fotografo || undefined,
        fotografoDocumento: (profile as any)?.cpf_cnpj || snap.documento_fotografo || undefined,
        clienteNome: contrato.cliente?.nome || snap.nome_cliente || undefined,
        clienteEmail: contrato.cliente?.email || snap.email_cliente || undefined,
        clienteDocumento: snap.documento_cliente || snap.cpf_cliente || undefined,
        cidadeLocal: snap.cidade_atual || snap.cidade_fotografo || snap.cidade_cliente || undefined,
        variaveisSnapshot: snap,
        filename: `${titulo}.pdf`,
      });
    } catch (err: any) {
      console.error('[Contrato PDF] Falha ao baixar:', err);
      toast({
        title: 'Erro ao gerar PDF',
        description: err?.message || 'Tente novamente em alguns instantes.',
        variant: 'destructive',
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadAssinado({ contratoId: contrato.id, file });
  };

  const handleDownloadAssinado = async () => {
    if (!contrato.arquivo_assinado_path) return;
    const url = await getSignedUrl(contrato.arquivo_assinado_path);
    if (url) window.open(url, '_blank');
  };

  const handleStatusChange = async (status: any) => {
    await setStatus({ id: contrato.id, status });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                <FileText className="h-5 w-5" />
                <input
                  className="bg-transparent border-none outline-none flex-1 text-lg font-semibold min-w-0"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  disabled={!isEditable}
                />
                <ContratoStatusBadge status={contrato.status} />
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3">
          {isAssinado && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-lg p-3 text-sm text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Contrato assinado em {contrato.assinado_em ? new Date(contrato.assinado_em).toLocaleString('pt-BR') : ''} — conteúdo bloqueado para edição.
            </div>
          )}

          <ContratoRichEditor value={conteudo} onChange={setConteudo} editable={isEditable} minHeight="400px" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <div>
              <Label>Status</Label>
              <Select value={contrato.status} onValueChange={handleStatusChange} disabled={isAssinado && contrato.status === 'assinado'}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="enviado">Enviado</SelectItem>
                  <SelectItem value="assinado">Assinado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>PDF assinado anexado</Label>
              {contrato.arquivo_assinado_path ? (
                <Button variant="outline" className="w-full justify-start" onClick={handleDownloadAssinado}>
                  <Paperclip className="h-4 w-4 mr-2" />
                  <span className="truncate">{contrato.arquivo_assinado_nome}</span>
                </Button>
              ) : (
                <>
                  <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={handleUpload} />
                  <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    Anexar PDF assinado
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-wrap gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => setConfirmDelete(true)} className="text-destructive">
            <Trash2 className="h-4 w-4 mr-1" />
            Excluir
          </Button>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={handleDownloadPdf} disabled={downloadingPdf}>
              <Download className="h-4 w-4 mr-1" />
              {downloadingPdf ? 'Gerando...' : 'Baixar PDF'}
            </Button>
            {contrato.status === 'rascunho' && (
              <Button variant="outline" onClick={() => handleStatusChange('enviado')}>
                <Send className="h-4 w-4 mr-1" />
                Marcar como enviado
              </Button>
            )}
            {isEditable && (
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-1" />
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            )}
          </div>
        </DialogFooter>

        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir contrato?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  await remove(contrato.id);
                  setConfirmDelete(false);
                  onClose();
                }}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
