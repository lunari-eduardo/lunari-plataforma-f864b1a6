import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ContratoRichEditor } from './ContratoRichEditor';
import { ContratoStatusBadge } from './ContratoStatusBadge';
import { useContratos } from '@/hooks/useContratos';
import { useAutentiqueIntegration } from '@/hooks/useAutentiqueIntegration';
import { useUserProfile } from '@/hooks/useUserProfile';
import { downloadContratoPdf, generateContratoPdf } from '@/utils/contratoPdf';
import {
  Download, Send, CheckCircle2, Upload, FileText, Save, Trash2, Paperclip,
  FileSignature, ExternalLink, Loader2, RefreshCw, XCircle, Eye, Clock, Ban, Copy,
} from 'lucide-react';
import type { Contrato } from '@/types/contrato';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ContratoViewerModalProps {
  open: boolean;
  onClose: () => void;
  contrato: Contrato;
}

const SIGNER_STATUS_META: Record<string, { label: string; icon: any; classes: string }> = {
  assinado: { label: 'Assinado', icon: CheckCircle2, classes: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' },
  visualizado: { label: 'Visualizado', icon: Eye, classes: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30' },
  recusado: { label: 'Recusado', icon: XCircle, classes: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30' },
  pendente: { label: 'Aguardando', icon: Clock, classes: 'bg-muted text-muted-foreground border-border' },
};

export function ContratoViewerModal({ open, onClose, contrato }: ContratoViewerModalProps) {
  const { profile } = useUserProfile();
  const {
    update,
    setStatus,
    remove,
    uploadAssinado,
    getSignedUrl,
    enviarParaAssinatura,
    isEnviandoParaAssinatura,
    syncAutentique,
    isSyncingAutentique,
    cancelAutentique,
    isCancelingAutentique,
  } = useContratos({ clienteId: contrato.cliente_id });
  const { status: autentiqueStatus } = useAutentiqueIntegration();
  const [conteudo, setConteudo] = useState(contrato.conteudo);
  const [titulo, setTitulo] = useState(contrato.titulo);
  const [saving, setSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isAssinado = contrato.status === 'assinado';
  const isEditable = !isAssinado && contrato.status !== 'enviado';
  const autentiqueConectado = !!autentiqueStatus?.connected;
  const jaEnviadoNaAutentique = !!contrato.signature_external_id;
  const podeEnviarParaAssinatura =
    contrato.status === 'rascunho' && autentiqueConectado && !jaEnviadoNaAutentique;
  const podeSincronizar = jaEnviadoNaAutentique && contrato.status !== 'cancelado';
  const podeCancelar = jaEnviadoNaAutentique && !isAssinado && contrato.status !== 'cancelado';

  const fotografoEmail = (profile?.email || '').toLowerCase();
  const signers = (contrato.signers as any[]) || [];

  const handleSave = async () => {
    setSaving(true);
    try {
      await update({ id: contrato.id, titulo, conteudo });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      // Se já existe PDF assinado, baixa ele direto
      if (contrato.arquivo_assinado_path) {
        const url = await getSignedUrl(contrato.arquivo_assinado_path);
        if (url) {
          const a = document.createElement('a');
          a.href = url;
          a.download = contrato.arquivo_assinado_nome || `${titulo}-assinado.pdf`;
          a.target = '_blank';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          return;
        }
      }
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
      toast({
        title: 'Erro ao gerar PDF',
        description: err?.message || 'Tente novamente.',
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

  const handleEnviarParaAssinatura = async () => {
    if (!contrato.cliente?.email) {
      toast({
        title: 'Cliente sem e-mail',
        description: 'Adicione um e-mail ao cliente antes de enviar.',
        variant: 'destructive',
      });
      return;
    }
    if (!conteudo || conteudo.trim().length < 10) {
      toast({ title: 'Contrato vazio', variant: 'destructive' });
      return;
    }
    try {
      if (conteudo !== contrato.conteudo || titulo !== contrato.titulo) {
        await update({ id: contrato.id, titulo, conteudo });
      }
      const snap = (contrato.variaveis_snapshot || {}) as Record<string, any>;
      const blob = await generateContratoPdf({
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
      });
      await enviarParaAssinatura({
        contratoId: contrato.id,
        pdfBlob: blob,
        includeFotografo: true,
      });
      toast({
        title: 'Contrato enviado',
        description: `Você e ${contrato.cliente?.email} receberão o link por e-mail.`,
      });
    } catch (err: any) {
      console.error('[Autentique] Falha no envio:', err);
    }
  };

  const handleSync = async () => {
    try {
      const r = await syncAutentique(contrato.id);
      if (r?.status === 'assinado') {
        toast({
          title: 'Contrato assinado!',
          description: r.pdf_downloaded ? 'PDF assinado foi salvo.' : 'Status atualizado.',
        });
      }
    } catch {/* tratado no hook */}
  };

  const handleCancelAutentique = async () => {
    try {
      await cancelAutentique(contrato.id);
      setConfirmCancel(false);
    } catch {/* tratado no hook */}
  };

  const handleResend = async (publicId: string) => {
    try {
      await resendSigner({ contratoId: contrato.id, publicId });
      toast({ title: 'E-mail reenviado' });
    } catch {/* tratado no hook */}
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

          {jaEnviadoNaAutentique && (
            <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 p-3 text-sm space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-blue-900 dark:text-blue-300 font-medium">
                  <FileSignature className="h-4 w-4" />
                  Enviado via Autentique
                </div>
                <div className="flex gap-2">
                  {podeSincronizar && (
                    <Button size="sm" variant="outline" onClick={handleSync} disabled={isSyncingAutentique}>
                      {isSyncingAutentique ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5 mr-1" />
                      )}
                      Atualizar status
                    </Button>
                  )}
                  {podeCancelar && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setConfirmCancel(true)}
                      disabled={isCancelingAutentique}
                    >
                      <Ban className="h-3.5 w-3.5 mr-1" />
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
              <div className="text-xs text-blue-900/70 dark:text-blue-300/70">
                ID: <code className="font-mono">{contrato.signature_external_id}</code>
              </div>

              {signers.length > 0 && (
                <div className="space-y-2">
                  {signers.map((s: any, i: number) => {
                    const meta = SIGNER_STATUS_META[s.status] || SIGNER_STATUS_META.pendente;
                    const Icon = meta.icon;
                    const isFotografo =
                      fotografoEmail && s.email && s.email.toLowerCase() === fotografoEmail;
                    const podeAssinar = isFotografo && s.status !== 'assinado' && s.status !== 'recusado' && s.link;
                    const podeReenviar = !isFotografo && (s.status === 'pendente' || s.status === 'visualizado') && s.public_id;
                    return (
                      <div
                        key={s.public_id || i}
                        className="flex items-center justify-between gap-2 rounded-md border border-blue-200/60 dark:border-blue-900/50 bg-background/40 px-2.5 py-1.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-sm font-medium truncate">
                            <span className="truncate">{s.nome || s.email}</span>
                            {isFotografo && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1">você</Badge>
                            )}
                          </div>
                          {s.nome && s.email && (
                            <div className="text-xs text-muted-foreground truncate">{s.email}</div>
                          )}
                          {s.timestamp && (
                            <div className="text-[10px] text-muted-foreground">
                              {new Date(s.timestamp).toLocaleString('pt-BR')}
                            </div>
                          )}
                        </div>
                        <Badge variant="outline" className={`text-[11px] gap-1 ${meta.classes}`}>
                          <Icon className="h-3 w-3" />
                          {meta.label}
                        </Badge>
                        {podeAssinar && (
                          <Button
                            size="sm"
                            onClick={() => window.open(s.link, '_blank', 'noopener,noreferrer')}
                          >
                            <FileSignature className="h-3.5 w-3.5 mr-1" />
                            Assinar
                          </Button>
                        )}
                        {!podeAssinar && s.link && s.status !== 'assinado' && (
                          <a
                            href={s.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-700 dark:text-blue-300 hover:underline"
                          >
                            Link <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {podeReenviar && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleResend(s.public_id)}
                            disabled={isResendingSigner}
                            title="Reenviar e-mail"
                          >
                            <MailPlus className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

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
              {downloadingPdf
                ? 'Gerando...'
                : contrato.arquivo_assinado_path
                ? 'Baixar PDF assinado'
                : 'Baixar PDF'}
            </Button>
            {podeEnviarParaAssinatura && (
              <Button onClick={handleEnviarParaAssinatura} disabled={isEnviandoParaAssinatura}>
                {isEnviandoParaAssinatura ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <FileSignature className="h-4 w-4 mr-1" />
                )}
                {isEnviandoParaAssinatura ? 'Enviando...' : 'Enviar para assinatura'}
              </Button>
            )}
            {contrato.status === 'rascunho' && !autentiqueConectado && (
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

        <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar assinatura?</AlertDialogTitle>
              <AlertDialogDescription>
                O documento será removido da Autentique e os links de assinatura ficarão inválidos.
                O conteúdo do contrato permanece no Lunari.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={handleCancelAutentique} disabled={isCancelingAutentique}>
                {isCancelingAutentique ? 'Cancelando...' : 'Cancelar assinatura'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
