import { Send, Copy, MessageSquare, Mail, ExternalLink, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface DeliverShareTabProps {
  isDraft: boolean;
  isPublishing: boolean;
  isLinkCopied: boolean;
  galleryUrl: string;
  publicToken?: string | null;
  shareMessage: string;
  setShareMessage: (msg: string) => void;
  onPublish: () => void;
  onCopyLink: (text: string) => void;
  onOpenWhatsApp: (url: string) => void;
  onOpenEmailModal: () => void;
}

export function DeliverShareTab({
  isDraft,
  isPublishing,
  isLinkCopied,
  galleryUrl,
  publicToken,
  shareMessage,
  setShareMessage,
  onPublish,
  onCopyLink,
  onOpenWhatsApp,
  onOpenEmailModal,
}: DeliverShareTabProps) {
  if (isDraft) {
    return (
      <div className="text-center py-16">
        <Send className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Publique primeiro</h3>
        <p className="text-muted-foreground mb-6">Publique a entrega para habilitar o compartilhamento.</p>
        <Button onClick={onPublish} disabled={isPublishing} className="gap-2">
          {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {isPublishing ? 'Publicando...' : 'Publicar entrega'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 mt-6">
      {/* Action buttons — inline, no cards */}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          className={cn(
            'gap-2 transition-all duration-200',
            isLinkCopied && 'border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium'
          )}
          onClick={() => onCopyLink(galleryUrl)}
        >
          {isLinkCopied ? (
            <CheckCircle className="h-4 w-4 text-emerald-500 animate-scale-in" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          {isLinkCopied ? 'Link copiado!' : 'Copiar link'}
        </Button>
        <Button
          variant="outline"
          className="gap-2 hover:border-emerald-500/50 hover:bg-emerald-500/5"
          onClick={() => onOpenWhatsApp(galleryUrl)}
        >
          <MessageSquare className="h-4 w-4" />
          WhatsApp
        </Button>
        <Button
          variant="outline"
          className="gap-2 hover:border-primary/50 hover:bg-primary/5"
          onClick={onOpenEmailModal}
        >
          <Mail className="h-4 w-4" />
          E-mail
        </Button>
        <Button
          variant="outline"
          className="gap-2 hover:border-border"
          onClick={() => window.open(galleryUrl || `/g/${publicToken}`, '_blank')}
        >
          <ExternalLink className="h-4 w-4" />
          Ver como cliente
        </Button>
      </div>

      {/* Share message — simple block, no card wrapper */}
      <div className="space-y-2">
        <Label>Mensagem de compartilhamento</Label>
        <Textarea
          value={shareMessage}
          onChange={(e) => setShareMessage(e.target.value)}
          rows={3}
        />
        <p className="text-xs text-muted-foreground">Essa mensagem será usada ao compartilhar por WhatsApp.</p>
      </div>
    </div>
  );
}
