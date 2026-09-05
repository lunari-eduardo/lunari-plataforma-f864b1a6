import { useNavigate, Link } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Send, RotateCcw, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ReactivateGalleryDialog } from '@/components/ReactivateGalleryDialog';
import { ReactivateSuccessModal } from '@/components/ReactivateSuccessModal';
import { DeleteGalleryDialog } from '@/components/DeleteGalleryDialog';
import { supabase } from '@/integrations/supabase/client';
import { DeliverStatusInfo } from '../types';

interface DeliverHeaderProps {
  gallery: any;
  photosCount: number;
  effectiveClienteId?: string | null;
  statusInfo: DeliverStatusInfo;
  isDraft: boolean;
  isExpired: boolean;
  isPublishing: boolean;
  galleryUrl: string;
  settings: any;
  showReactivateDialog: boolean;
  setShowReactivateDialog: (open: boolean) => void;
  reactivateSuccessOpen: boolean;
  setReactivateSuccessOpen: (open: boolean) => void;
  reactivateDays: number;
  setReactivateDays: (days: number) => void;
  setExpirationDate: (date: Date | undefined) => void;
  updateGallery: (args: any) => Promise<any>;
  onPublish: () => void;
  onDelete: () => void;
}

export function DeliverHeader({
  gallery,
  photosCount,
  effectiveClienteId,
  statusInfo,
  isDraft,
  isExpired,
  isPublishing,
  galleryUrl,
  settings,
  showReactivateDialog,
  setShowReactivateDialog,
  reactivateSuccessOpen,
  setReactivateSuccessOpen,
  reactivateDays,
  setReactivateDays,
  setExpirationDate,
  updateGallery,
  onPublish,
  onDelete,
}: DeliverHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-4">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit gap-2"
        onClick={() => navigate('/app/gallery/list?tab=transfer')}
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Button>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold">{gallery.nomeSessao || 'Sem título'}</h1>
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            {effectiveClienteId ? (
              <Link
                to={`/app/clientes/${effectiveClienteId}`}
                className="hover:underline hover:text-foreground font-medium text-foreground inline-flex items-center gap-1 group"
                title="Ver perfil do cliente no CRM"
              >
                <span>{gallery.clienteNome || 'Sem cliente'}</span>
                <ExternalLink className="h-3 w-3 opacity-60 group-hover:opacity-100" />
              </Link>
            ) : (
              gallery.clienteNome || 'Sem cliente'
            )}{' '}
            · {gallery.createdAt ? format(gallery.createdAt, 'dd MMM yyyy', { locale: ptBR }) : ''} ·{' '}
            {photosCount} fotos
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isExpired && (
            <Button variant="outline" onClick={() => setShowReactivateDialog(true)} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Reativar
            </Button>
          )}
          {isDraft && (
            <Button onClick={onPublish} disabled={isPublishing} className="gap-2">
              {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isPublishing ? 'Publicando...' : 'Publicar entrega'}
            </Button>
          )}
          <DeleteGalleryDialog galleryName={gallery.nomeSessao || 'esta galeria'} onDelete={onDelete} />
        </div>

        {/* Reactivate Dialog */}
        <ReactivateGalleryDialog
          galleryName={gallery.nomeSessao || 'esta galeria'}
          onReactivate={async (days) => {
            const newExpiration = addDays(new Date(), days);
            await updateGallery({
              id: gallery.id,
              data: {
                prazoSelecao: newExpiration,
              },
            });
            await supabase
              .from('galerias')
              .update({ status: 'enviado', updated_at: new Date().toISOString() })
              .eq('id', gallery.id);
            setExpirationDate(newExpiration);
          }}
          open={showReactivateDialog}
          onOpenChange={setShowReactivateDialog}
          onSuccess={(days) => {
            setReactivateDays(days);
            setReactivateSuccessOpen(true);
          }}
        />

        {settings && (
          <ReactivateSuccessModal
            isOpen={reactivateSuccessOpen}
            onOpenChange={setReactivateSuccessOpen}
            gallery={gallery}
            settings={settings}
            clientLink={galleryUrl || null}
            newDeadline={addDays(new Date(), reactivateDays)}
            daysGranted={reactivateDays}
          />
        )}
      </div>
    </div>
  );
}
