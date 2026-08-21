import { useState, useEffect } from 'react';
import { Mail, Send, Loader2, CheckCircle2, AlertCircle, Eye, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Galeria } from '@/hooks/useSupabaseGalleries';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SendDeliverEmailModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  gallery: Galeria;
  photosCount: number;
  galleryUrl: string;
  onSuccess?: () => void;
}

export function SendDeliverEmailModal({
  isOpen,
  onOpenChange,
  gallery,
  photosCount,
  galleryUrl,
  onSuccess,
}: SendDeliverEmailModalProps) {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRecipientEmail(gallery.clienteEmail || '');
      setSubject(`Suas fotos finais estão prontas para download - ${gallery.nomeSessao || 'Galeria'}`);
      setMessage(
        `Olá, ${gallery.clienteNome || 'Cliente'}!\n\nÉ com muita alegria que entregamos as fotos finais da sua sessão "${gallery.nomeSessao || 'Galeria'}"!\n\nSuas fotos já foram tratadas com todo o carinho e estão disponíveis para você visualizar e baixar em alta resolução.\n\nAproveite cada momento inesquecível!`
      );
      setIsSending(false);
      setShowPreview(false);
    }
  }, [isOpen, gallery]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientEmail.trim()) {
      toast.error('Informe o e-mail do destinatário.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail.trim())) {
      toast.error('Informe um endereço de e-mail válido.');
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          eventType: 'gallery_sent',
          galleryId: gallery.id,
          publicToken: gallery.publicToken,
          isDeliver: true,
          recipientEmail: recipientEmail.trim(),
          customSubject: subject.trim(),
          customBody: message.trim(),
          forceResend: true,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.success === false) {
        throw new Error(data?.message || 'Falha ao enviar e-mail');
      }

      toast.success('E-mail de entrega enviado com sucesso!');
      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Erro ao enviar e-mail de entrega:', err);
      toast.error(err.message || 'Não foi possível enviar o e-mail agora. Tente novamente.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden rounded-2xl gap-0 border border-border/80 shadow-2xl">
        {/* Header com tom refinado */}
        <div className="p-6 bg-muted/40 border-b border-border/60">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Mail className="h-4 w-4" />
              </div>
              <Badge variant="outline" className="text-xs font-normal border-primary/30 text-primary">
                Entrega de Fotos
              </Badge>
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
              Enviar galeria por e-mail
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              O cliente receberá um e-mail elegante e personalizado com a sua marca para acessar e baixar as fotos finais.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSend} className="p-6 space-y-5">
          {/* E-mail do destinatário */}
          <div className="space-y-2">
            <Label htmlFor="deliver-recipient-email" className="text-sm font-medium">
              E-mail do cliente <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="deliver-recipient-email"
                type="email"
                required
                placeholder="cliente@email.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
            {!gallery.clienteEmail && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                O cliente não possui e-mail cadastrado. Digite o e-mail desejado acima.
              </p>
            )}
          </div>

          {/* Assunto */}
          <div className="space-y-2">
            <Label htmlFor="deliver-email-subject" className="text-sm font-medium">
              Assunto do e-mail
            </Label>
            <Input
              id="deliver-email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="text-sm"
            />
          </div>

          {/* Mensagem personalizada */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="deliver-email-message" className="text-sm font-medium">
                Mensagem
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPreview(!showPreview)}
              >
                <Eye className="h-3.5 w-3.5" />
                {showPreview ? 'Ocultar prévia' : 'Ver prévia do card'}
              </Button>
            </div>
            <Textarea
              id="deliver-email-message"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="text-sm resize-none"
            />
          </div>

          {/* Card de Prévia Resumida */}
          {showPreview && (
            <div className="p-4 rounded-xl bg-muted/50 border border-border/80 space-y-3 animate-fade-in text-sm">
              <div className="flex items-center justify-between pb-2 border-b border-border/40">
                <span className="font-semibold text-foreground flex items-center gap-1.5 text-xs tracking-wider uppercase">
                  <Sparkles className="h-3.5 w-3.5 text-primary" /> Resumo do E-mail
                </span>
                <span className="text-xs text-muted-foreground">{photosCount} fotos anexadas</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground block">Sessão:</span>
                  <span className="font-medium text-foreground">{gallery.nomeSessao || 'Sessão'}</span>
                </div>
                {gallery.permissao === 'private' && gallery.galleryPassword && (
                  <div>
                    <span className="text-muted-foreground block">Senha de acesso:</span>
                    <span className="font-mono font-bold text-foreground">{gallery.galleryPassword}</span>
                  </div>
                )}
                {gallery.prazoSelecao && (
                  <div>
                    <span className="text-muted-foreground block">Disponível até:</span>
                    <span className="font-medium text-foreground">
                      {format(new Date(gallery.prazoSelecao), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="pt-3 border-t border-border/40 flex flex-col sm:flex-row gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSending || !recipientEmail.trim()}
              className="gap-2"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Enviar e-mail de entrega
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
