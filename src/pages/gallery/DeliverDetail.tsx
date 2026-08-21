import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft, Send, Trash2, Image, Upload, Copy, Eye,
  Lock, Unlock, Calendar as CalendarIcon, Download,
  MessageSquare, Mail, ExternalLink, Loader2, Save, RotateCcw, Star, ImageIcon,
  Layers, Smartphone, Tablet, Monitor, CheckCircle
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CoverCatalog } from '@/components/deliver/CoverCatalog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSupabaseGalleries, GaleriaPhoto } from '@/hooks/useSupabaseGalleries';
import { supabase } from '@/integrations/supabase/client';
import { ReactivateGalleryDialog } from '@/components/ReactivateGalleryDialog';
import { ReactivateSuccessModal } from '@/components/ReactivateSuccessModal';
import { DeleteGalleryDialog } from '@/components/DeleteGalleryDialog';
import { PhotoUploader, UploadedPhoto } from '@/components/PhotoUploader';
import { useTransferStorage } from '@/hooks/useTransferStorage';
import { useSettings } from '@/hooks/useSettings';
import { getGalleryUrl } from '@/lib/galleryUrl';
import { buildWhatsAppUrl } from '@/lib/whatsappUrl';
import { getPhotoUrl } from '@/lib/photoUrl';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { THEME_REGISTRY, DEFAULT_THEME_ID } from '@/components/gallery/themes/registry';
import { ThemePreviewCanvas } from '@/components/dashboard/themes/ThemePreviewCanvas';
import { SendDeliverEmailModal } from '@/components/deliver/SendDeliverEmailModal';

import { isPast } from 'date-fns';

function getDeliverStatusInfo(status: string, prazoSelecao: Date | null) {
  const isExpired = status === 'expirado' || status === 'expirada' || status === 'expired' || (prazoSelecao && isPast(prazoSelecao) && ['enviado', 'publicada', 'sent', 'selecao_iniciada', 'selection_started'].includes(status));
  if (isExpired) return { label: 'Expirada', variant: 'destructive' as const, color: 'text-destructive' };
  if (['enviado', 'publicada', 'sent', 'selecao_iniciada', 'selection_started'].includes(status)) return { label: 'Publicada', variant: 'default' as const, color: 'text-primary' };
  return { label: 'Rascunho', variant: 'secondary' as const, color: 'text-muted-foreground' };
}

export default function DeliverDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    galleries,
    getGallery,
    fetchGalleryPhotos,
    updateGallery,
    deleteGallery,
    publishGallery,
    sendGallery,
    deletePhoto,
    isLoading: galleriesLoading,
  } = useSupabaseGalleries();

  const transferStorage = useTransferStorage();
  const { settings } = useSettings();

  const [photos, setPhotos] = useState<GaleriaPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(true);
  const [showUploader, setShowUploader] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showReactivateDialog, setShowReactivateDialog] = useState(false);
  const [reactivateSuccessOpen, setReactivateSuccessOpen] = useState(false);
  const [reactivateDays, setReactivateDays] = useState(7);
  const [isLinkCopied, setIsLinkCopied] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);

  // Editable fields
  const [sessionName, setSessionName] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [welcomeEnabled, setWelcomeEnabled] = useState(false);
  const [internalNotes, setInternalNotes] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [galleryPassword, setGalleryPassword] = useState('');
  const [expirationDate, setExpirationDate] = useState<Date | undefined>();
  const [shareMessage, setShareMessage] = useState('Suas fotos finais estão prontas para download.');
  const [coverPhotoId, setCoverPhotoId] = useState<string | null>(null);
  const [photoSpacing, setPhotoSpacing] = useState(6);
  const [activeThemeId, setActiveThemeId] = useState<string>(DEFAULT_THEME_ID);
  const [useCustomTheme, setUseCustomTheme] = useState(false);
  const [themeOverrides, setThemeOverrides] = useState<any>({});
  const [coverId, setCoverId] = useState<string | null>(null);
  const [previewViewport, setPreviewViewport] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  const [subtitle, setSubtitle] = useState('');
  const [category, setCategory] = useState('');
  const [eventDate, setEventDate] = useState<Date | undefined>(undefined);

  const gallery = useMemo(() => getGallery(id || ''), [id, galleries]);

  // Resolve client ID (from gallery directly, or fallback to session/name search)
  const { data: resolvedClienteId } = useQuery({
    queryKey: ['gallery-resolved-client', gallery?.clienteId, gallery?.sessionId, gallery?.clienteNome],
    queryFn: async () => {
      if (gallery?.clienteId) return gallery.clienteId;

      if (gallery?.sessionId) {
        const { data: sess } = await supabase
          .from('clientes_sessoes')
          .select('cliente_id')
          .eq('session_id', gallery.sessionId)
          .maybeSingle();
        if (sess?.cliente_id) return sess.cliente_id;
      }

      if (gallery?.clienteNome) {
        const { data: client } = await supabase
          .from('clientes')
          .select('id')
          .ilike('nome', gallery.clienteNome.trim())
          .limit(1)
          .maybeSingle();
        if (client?.id) return client.id;
      }

      return null;
    },
    enabled: !!gallery,
  });

  const effectiveClienteId = gallery?.clienteId || resolvedClienteId;

  // Load gallery data
  useEffect(() => {
    if (gallery) {
      setSessionName(gallery.nomeSessao || '');
      setSubtitle((gallery.configuracoes as any)?.subtitulo || '');
      setCategory((gallery.configuracoes as any)?.categoria || '');
      const rawDate = (gallery.configuracoes as any)?.dataEvento;
      if (rawDate) {
        try {
          const d = new Date(rawDate);
          if (!isNaN(d.getTime())) setEventDate(d);
        } catch {}
      } else {
        setEventDate(undefined);
      }
      setWelcomeMessage(gallery.mensagemBoasVindas || '');
      setWelcomeEnabled(!!gallery.mensagemBoasVindas);
      setInternalNotes((gallery.configuracoes as any)?.notasInternas || '');
      setIsPrivate(gallery.permissao === 'private');
      setGalleryPassword(gallery.galleryPassword || '');
      setExpirationDate(gallery.prazoSelecao || undefined);
      setCoverPhotoId(gallery.configuracoes?.coverPhotoId || null);
      setActiveThemeId(gallery.themeId || DEFAULT_THEME_ID);
      setUseCustomTheme(gallery.useCustomTheme || false);
      setThemeOverrides(gallery.themeOverrides || {});
      setCoverId((gallery as any).coverId ?? null);
      
      // Migrate legacy gap to overrides if needed
      const legacyGap = gallery.configuracoes?.photoSpacing;
      if (legacyGap !== undefined && !gallery.themeOverrides?.layout?.gap) {
        setThemeOverrides((prev: any) => ({
          ...prev,
          layout: { ...(prev.layout || {}), gap: legacyGap }
        }));
      }
    }
  }, [gallery]);

  // Load photos
  useEffect(() => {
    if (!id) return;
    setPhotosLoading(true);
    fetchGalleryPhotos(id)
      .then(setPhotos)
      .catch(console.error)
      .finally(() => setPhotosLoading(false));
  }, [id]);

  if (galleriesLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!gallery) {
    return (
      <div className="text-center py-24">
        <h2 className="text-2xl font-bold mb-2">Galeria não encontrada</h2>
        <Button variant="outline" onClick={() => navigate('/app/gallery/list?tab=transfer')}>Voltar</Button>
      </div>
    );
  }

  const statusInfo = getDeliverStatusInfo(gallery.status, gallery.prazoSelecao);
  const isDraft = statusInfo.label === 'Rascunho';
  const isExpired = statusInfo.label === 'Expirada';
  const galleryUrl = gallery.publicToken ? getGalleryUrl(gallery.publicToken) : '';

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await updateGallery({ id, data: {
        nomeSessao: sessionName,
        mensagemBoasVindas: welcomeEnabled ? (welcomeMessage.trim() || null) : null,
        permissao: isPrivate ? 'private' : 'public',
        coverId: coverId,
        prazoSelecao: expirationDate,
        configuracoes: {
          ...gallery.configuracoes,
          notasInternas: internalNotes,
          coverPhotoId: coverPhotoId || undefined,
          photoSpacing: themeOverrides?.layout?.gap ?? photoSpacing,
          subtitulo: subtitle.trim() || undefined,
          categoria: category.trim() || undefined,
          dataEvento: eventDate ? eventDate.toISOString() : undefined,
        } as any,
        themeId: useCustomTheme ? activeThemeId : null,
        useCustomTheme: useCustomTheme,
        themeOverrides: themeOverrides,
      }});


      navigate('/app/gallery/list?tab=transfer');
    } catch (error) {
      console.error('Erro ao salvar:', error);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!id || isPublishing) return;
    setIsPublishing(true);
    try {
      // 1. Garante que se o prazo estiver nulo ou no passado, estende por padrão (ex: 30 dias)
      let newExpiration = gallery.prazoSelecao;
      if (!newExpiration || isPast(newExpiration)) {
        newExpiration = addDays(new Date(), gallery.prazoSelecaoDias || 30);
        setExpirationDate(newExpiration);
      }

      const nowIso = new Date().toISOString();

      // 2. Invoca a RPC prepare_gallery_share com p_mark_as_sent: true
      await supabase.rpc('prepare_gallery_share', {
        p_gallery_id: id,
        p_mark_as_sent: true,
      });

      // 3. Atualiza explicitamente na tabela galerias para garantir que status = 'enviado' e prazo estão gravados
      const { error: updateError } = await supabase
        .from('galerias')
        .update({
          status: 'enviado',
          published_at: nowIso,
          enviado_em: nowIso,
          updated_at: nowIso,
          prazo_selecao: newExpiration ? newExpiration.toISOString() : null,
        })
        .eq('id', id);

      if (updateError) {
        console.error('Error updating gallery status:', updateError);
      }

      // 4. Invalida todas as queries do TanStack Query
      await queryClient.invalidateQueries({ queryKey: ['galleries'] });
      await queryClient.invalidateQueries({ queryKey: ['galerias'] });
      await queryClient.invalidateQueries({ queryKey: ['client-gallery', id] });
      await queryClient.refetchQueries({ queryKey: ['galleries'] });

      toast.success('Entrega publicada com sucesso!');
    } catch (error) {
      console.error('Erro ao publicar galeria:', error);
      toast.error('Erro ao publicar galeria');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    await deleteGallery(id);
    navigate('/app/gallery/list?tab=transfer');
  };

  const handlePhotoDelete = async (photoId: string) => {
    if (!id) return;
    await deletePhoto({ photoId } as any);
    setPhotos(prev => prev.filter(p => p.id !== photoId));
    // Se a foto excluída era a capa, resetar
    if (coverPhotoId === photoId) {
      setCoverPhotoId(null);
      try {
        await updateGallery({ id, data: {
          configuracoes: { ...(gallery?.configuracoes as any), coverPhotoId: null },
        }});
      } catch (e) {
        console.error('Erro ao limpar capa após exclusão:', e);
      }
    }
  };

  const handleSetCover = async (photoId: string) => {
    if (!id) return;
    const newCoverId = coverPhotoId === photoId ? null : photoId;
    setCoverPhotoId(newCoverId);
    try {
      await updateGallery({ id, data: {
        configuracoes: { ...(gallery?.configuracoes as any), coverPhotoId: newCoverId },
      }});
    } catch {
      toast.error('Erro ao atualizar capa');
      setCoverPhotoId(coverPhotoId);
    }
  };

  const handleToggleHighlight = async (photoId: string, currentWeight: number) => {
    const newWeight = currentWeight > 0 ? 0 : 1;
    setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, pesoVisual: newWeight } : p));
    const { error } = await supabase
      .from('galeria_fotos')
      .update({ peso_visual: newWeight })
      .eq('id', photoId);
    if (error) {
      setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, pesoVisual: currentWeight } : p));
      toast.error('Erro ao atualizar destaque');
      return;
    }
    toast.success(newWeight > 0 ? 'Foto destacada' : 'Destaque removido');
  };


  const handleUploadComplete = (uploaded: UploadedPhoto[]) => {
    setShowUploader(false);
    if (id) {
      fetchGalleryPhotos(id).then(setPhotos);
    }
  };

  const copyToClipboard = async (text: string) => {
    if (!text) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setIsLinkCopied(true);
      toast.success('Link copiado para a área de transferência!');
      setTimeout(() => setIsLinkCopied(false), 2000);
    } catch (err) {
      console.error('Erro ao copiar link:', err);
      toast.error('Não foi possível copiar automaticamente.');
    }
  };

  const openWhatsApp = async () => {
    const message = `${shareMessage}\n\n${galleryUrl}`;
    const { url, hasDirectContact } = buildWhatsAppUrl(gallery.clienteTelefone, message);
    if (!hasDirectContact) {
      try {
        await navigator.clipboard.writeText(message);
      } catch {
        // ignora
      }
      toast.info('Cliente sem telefone cadastrado. A mensagem foi copiada — escolha o contato no WhatsApp e cole.');
    }
    window.open(url, '_blank');
  };

  return (
    <div className="max-w-[79rem] mx-auto w-full bg-background px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-[max(4rem,env(safe-area-inset-bottom))] animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" className="w-fit gap-2" onClick={() => navigate('/app/gallery/list?tab=transfer')}>
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
              )} · {format(gallery.createdAt, "dd MMM yyyy", { locale: ptBR })} · {photos.length} fotos
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
              <Button onClick={handlePublish} disabled={isPublishing} className="gap-2">
                {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {isPublishing ? 'Publicando...' : 'Publicar entrega'}
              </Button>
            )}
            <DeleteGalleryDialog galleryName={gallery.nomeSessao || 'esta galeria'} onDelete={handleDelete} />
          </div>

          {/* Reactivate Dialog */}
          <ReactivateGalleryDialog
            galleryName={gallery.nomeSessao || 'esta galeria'}
            onReactivate={async (days) => {
              const newExpiration = addDays(new Date(), days);
              await updateGallery({ id: id!, data: {
                prazoSelecao: newExpiration,
              }});
              const { supabase } = await import('@/integrations/supabase/client');
              await supabase.from('galerias').update({ status: 'enviado', updated_at: new Date().toISOString() }).eq('id', id!);
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

      {/* Tabs: 3 abas — Compartilhamento | Fotos | Detalhes */}
      <Tabs defaultValue="share">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="share">Compartilhamento</TabsTrigger>
          <TabsTrigger value="photos">Fotos</TabsTrigger>
          <TabsTrigger value="design">Design & Temas</TabsTrigger>
          <TabsTrigger value="details">Detalhes</TabsTrigger>

        </TabsList>

        {/* === COMPARTILHAMENTO === */}
        <TabsContent value="share" className="space-y-8 mt-6">
          {isDraft ? (
            <div className="text-center py-16">
              <Send className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Publique primeiro</h3>
              <p className="text-muted-foreground mb-6">Publique a entrega para habilitar o compartilhamento.</p>
              <Button onClick={handlePublish} disabled={isPublishing} className="gap-2">
                {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {isPublishing ? 'Publicando...' : 'Publicar entrega'}
              </Button>
            </div>
          ) : (
            <>
              {/* Action buttons — inline, no cards */}
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  className={cn(
                    "gap-2 transition-all duration-200",
                    isLinkCopied && "border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium"
                  )}
                  onClick={() => copyToClipboard(galleryUrl)}
                >
                  {isLinkCopied ? <CheckCircle className="h-4 w-4 text-emerald-500 animate-scale-in" /> : <Copy className="h-4 w-4" />}
                  {isLinkCopied ? 'Link copiado!' : 'Copiar link'}
                </Button>
                <Button variant="outline" className="gap-2 hover:border-emerald-500/50 hover:bg-emerald-500/5" onClick={openWhatsApp}>
                  <MessageSquare className="h-4 w-4" />
                  WhatsApp
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 hover:border-primary/50 hover:bg-primary/5"
                  onClick={() => setShowEmailModal(true)}
                >
                  <Mail className="h-4 w-4" />
                  E-mail
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 hover:border-border"
                  onClick={() => window.open(galleryUrl || `/g/${gallery.publicToken}`, '_blank')}
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
                  onChange={e => setShareMessage(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">Essa mensagem será usada ao compartilhar por WhatsApp.</p>
              </div>
            </>
          )}
        </TabsContent>

        {/* === DESIGN & TEMAS === */}
        <TabsContent value="design" className="space-y-8 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-8">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Herança de Tema</h3>
                <p className="text-sm text-muted-foreground">Decida se esta galeria segue as regras da sua conta ou tem estilo próprio.</p>
                
                <div className="space-y-3">
                  <div 
                    className={cn(
                      "p-4 border rounded-xl cursor-pointer transition-all",
                      !useCustomTheme ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted"
                    )}
                    onClick={() => setUseCustomTheme(false)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center", !useCustomTheme ? "border-primary" : "border-muted-foreground")}>
                        {!useCustomTheme && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                      <div>
                        <p className="font-medium text-sm">Herdar tema padrão</p>
                        <p className="text-xs text-muted-foreground">Usa o tema definido nas configurações da sua conta.</p>
                      </div>
                    </div>
                  </div>

                  <div 
                    className={cn(
                      "p-4 border rounded-xl cursor-pointer transition-all",
                      useCustomTheme ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted"
                    )}
                    onClick={() => setUseCustomTheme(true)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center", useCustomTheme ? "border-primary" : "border-muted-foreground")}>
                        {useCustomTheme && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                      <div>
                        <p className="font-medium text-sm">Personalizar esta galeria</p>
                        <p className="text-xs text-muted-foreground">Escolha um tema e ajustes específicos apenas para este trabalho.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {useCustomTheme && (
                <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-4">
                    <Label className="text-base font-semibold">Selecione o Preset</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.values(THEME_REGISTRY).map((t) => (
                        <div 
                          key={t.id}
                          onClick={() => setActiveThemeId(t.id)}
                          className={cn(
                            "flex flex-col gap-2 p-3 border rounded-xl cursor-pointer transition-all text-center",
                            activeThemeId === t.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/50"
                          )}
                        >
                          <span className="text-sm font-medium">{t.name}</span>
                          <span className="text-[10px] text-muted-foreground uppercase">{t.layout.engine === 'editorial-grid' ? 'Editorial' : 'Classic'}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <Label className="text-base font-semibold">Ajustes Visuais</Label>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Espaçamento (Gap)</Label>
                        <span className="text-xs font-mono">{themeOverrides?.layout?.gap ?? 8}px</span>
                      </div>
                      <Slider
                        value={[themeOverrides?.layout?.gap ?? 8]}
                        onValueChange={(vals) => setThemeOverrides({
                          ...themeOverrides,
                          layout: { ...(themeOverrides.layout || {}), gap: vals[0] }
                        })}
                        min={0}
                        max={40}
                        step={1}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Capa da Galeria de Entrega — independente do Tema */}
              <div className="space-y-4 pt-2 border-t">
                <div>
                  <Label className="text-base font-semibold">Capa da Galeria</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Apresentação inicial (Hero). Independe do Tema (grid).
                  </p>
                </div>
                <CoverCatalog
                  selectedCoverId={coverId}
                  onSelect={setCoverId}
                />
              </div>


              <div className="pt-4 border-t">
                <Button onClick={handleSave} className="w-full gap-2 rounded-xl" disabled={saving}>
                  <Save className="h-4 w-4" />
                  Salvar Design
                </Button>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">
                  Preview: {useCustomTheme 
                    ? `${THEME_REGISTRY[activeThemeId]?.name} (personalizado)` 
                    : 'Herança da conta'}
                </h4>
                <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
                  <Button 
                    variant={previewViewport === 'mobile' ? 'secondary' : 'ghost'} 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => setPreviewViewport('mobile')}
                  >
                    <Smartphone className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant={previewViewport === 'tablet' ? 'secondary' : 'ghost'} 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => setPreviewViewport('tablet')}
                  >
                    <Tablet className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant={previewViewport === 'desktop' ? 'secondary' : 'ghost'} 
                    size="icon" 
                    className={cn("h-8 w-8", previewViewport === 'desktop' && "bg-background shadow-sm")}
                    onClick={() => setPreviewViewport('desktop')}
                  >
                    <Monitor className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="min-h-[600px] h-[70vh] bg-muted rounded-2xl border border-muted overflow-hidden relative group shadow-lg">
                <div className="absolute inset-0 bg-background overflow-hidden flex flex-col">
                   <ThemePreviewCanvas 
                     themeId={activeThemeId}
                     themeOverrides={themeOverrides}
                     viewport={previewViewport}
                     skipHero={true}
                     isBlueprint={false}
                     previewPhotos={photos.slice(0, 12)}
                   />
                </div>
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
                   <Button variant="secondary" className="gap-2 rounded-full" onClick={() => window.open(`/g/${gallery.publicToken}`, '_blank')}>
                     <Eye className="h-4 w-4" />
                     Ver prévia completa
                   </Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>


        {/* === FOTOS === */}
        <TabsContent value="photos" className="space-y-4 mt-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="font-semibold text-lg">
                {photos.length} fotos entregues
              </h3>
              {coverPhotoId && (
                <span className="text-xs font-normal text-muted-foreground inline-flex items-center gap-1">
                  <Star className="h-3 w-3 fill-[#cbb384] text-[#cbb384]" />
                  Capa selecionada
                </span>
              )}
              {(THEME_REGISTRY[activeThemeId]?.featured?.enabled !== false) && photos.some(p => (p.pesoVisual ?? 0) > 0) && (
                <span className="text-xs font-normal text-muted-foreground inline-flex items-center gap-1">
                  <Star className="h-3 w-3 fill-blue-400 text-blue-400" />
                  {photos.filter(p => (p.pesoVisual ?? 0) > 0).length} destaque{photos.filter(p => (p.pesoVisual ?? 0) > 0).length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <Button onClick={() => setShowUploader(true)} className="gap-2">
              <Upload className="h-4 w-4" />
              Adicionar fotos
            </Button>
          </div>


          {showUploader && (
            <div className="border rounded-lg p-4 bg-card">
              <PhotoUploader
                galleryId={id!}
                onUploadComplete={handleUploadComplete}
                skipCredits={true}
                storageLimit={transferStorage.storageLimitBytes}
                storageUsed={transferStorage.storageUsedBytes}
              />
            </div>
          )}

          {photosLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : photos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {photos.map(photo => {
                const isCover = coverPhotoId === photo.id;
                const weight = photo.pesoVisual ?? 0;
                const themeSupportsFeatured = THEME_REGISTRY[activeThemeId]?.featured?.enabled !== false;
                const showHighlight = themeSupportsFeatured && weight > 0;
                return (
                  <div
                    key={photo.id}
                    className={cn(
                      'group relative aspect-square rounded-lg overflow-hidden bg-muted border-2 transition-all',
                      isCover && 'border-[#cbb384] ring-2 ring-[#cbb384]/30',
                      !isCover && showHighlight && 'border-blue-400 ring-1 ring-blue-400/30',
                      !isCover && !showHighlight && 'border-transparent'
                    )}
                  >

                    <img
                      src={getPhotoUrl({ storageKey: photo.storageKey }, 'thumbnail')}
                      alt={photo.originalFilename}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />

                    {/* Badge CAPA */}
                    {isCover && (
                      <div className="absolute top-1.5 left-1.5 bg-[#cbb384] text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 z-10 shadow-sm">
                        <Star className="h-2.5 w-2.5 fill-current" />
                        CAPA
                      </div>
                    )}
                    
                    {/* Badge DESTAQUE — só quando tema suporta */}
                    {showHighlight && (
                      <div className="absolute top-1.5 right-1.5 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 z-10 shadow-sm">
                        <Star className="h-2.5 w-2.5 fill-current" />
                        DESTAQUE
                      </div>
                    )}

                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100">
                      {themeSupportsFeatured && (
                        <Button
                          variant={weight > 0 ? 'default' : 'secondary'}
                          size="icon"
                          className={cn('h-8 w-8', weight > 0 && 'bg-blue-500 hover:bg-blue-600 text-white')}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleHighlight(photo.id, weight);
                          }}
                          title={weight > 0 ? 'Remover destaque' : 'Destacar na grade'}
                          aria-label={weight > 0 ? 'Remover destaque' : 'Destacar na grade'}
                        >
                          <Star className={cn('h-4 w-4', weight > 0 && 'fill-current')} />
                        </Button>
                      )}
                      <Button
                        variant={isCover ? 'default' : 'secondary'}
                        size="icon"
                        className={cn('h-8 w-8', isCover && 'bg-[#cbb384] hover:bg-[#bfa574] text-white')}
                        onClick={() => handleSetCover(photo.id)}
                        title={isCover ? 'Remover capa' : 'Definir como capa'}
                      >
                        <ImageIcon className={cn('h-4 w-4', isCover && 'fill-current')} />
                      </Button>
                      <a
                        href={getPhotoUrl({ storageKey: photo.storageKey }, 'original')}
                        download={photo.originalFilename}
                        onClick={e => e.stopPropagation()}
                      >
                        <Button variant="secondary" size="icon" className="h-8 w-8">
                          <Download className="h-4 w-4" />
                        </Button>
                      </a>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handlePhotoDelete(photo.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-2 py-1 truncate opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      {photo.originalFilename}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Image className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Nenhuma foto adicionada</h3>
              <p className="text-muted-foreground mb-4">Adicione as fotos finais para esta entrega.</p>
              <Button onClick={() => setShowUploader(true)} className="gap-2">
                <Upload className="h-4 w-4" />
                Adicionar fotos
              </Button>
            </div>
          )}
        </TabsContent>

        {/* === DETALHES (Layout em 2 Colunas sem rolagem) === */}
        <TabsContent value="details" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Coluna Esquerda: Identificação da Sessão & Cliente */}
            <div className="space-y-5 p-5 rounded-xl border bg-card/60 backdrop-blur-sm">
              <div className="space-y-2">
                <Label htmlFor="sessionName" className="font-semibold text-sm">Nome da sessão</Label>
                <Input id="sessionName" value={sessionName} onChange={e => setSessionName(e.target.value)} />
              </div>

              <div className="grid gap-3 sm:grid-cols-3 pt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="subtitle" className="text-xs font-medium text-muted-foreground">Subtítulo da Capa</Label>
                  <Input
                    id="subtitle"
                    value={subtitle}
                    onChange={e => setSubtitle(e.target.value)}
                    placeholder="Ex: Wedding Story"
                    className="text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="category" className="text-xs font-medium text-muted-foreground">Categoria / Tag</Label>
                  <Input
                    id="category"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    placeholder="Ex: WEDDING"
                    className="text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <CalendarIcon className="h-3.5 w-3.5 text-[#cbb384]" />
                    Data do Evento
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "w-full justify-start text-left font-normal border-border/60 hover:border-[#cbb384]/50 h-9 text-xs",
                          !eventDate && "text-muted-foreground"
                        )}
                      >
                        {eventDate ? format(eventDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-xl shadow-lg border border-border/60" align="start">
                      <Calendar
                        mode="single"
                        selected={eventDate}
                        onSelect={setEventDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cliente</h4>
                <div className="space-y-1 text-sm bg-muted/40 p-3 rounded-lg border border-border/40">
                  <div>
                    {effectiveClienteId ? (
                      <Link
                        to={`/app/clientes/${effectiveClienteId}`}
                        className="font-medium text-primary hover:underline inline-flex items-center gap-1 group"
                        title="Ver perfil do cliente no CRM"
                      >
                        <span>{gallery.clienteNome || 'Sem cliente'}</span>
                        <ExternalLink className="h-3 w-3 opacity-70 group-hover:opacity-100" />
                      </Link>
                    ) : (
                      <span className="font-medium text-foreground">{gallery.clienteNome || 'Sem cliente'}</span>
                    )}
                  </div>
                  <div className="text-muted-foreground text-xs">{gallery.clienteEmail || 'Sem e-mail cadastrado'}</div>
                  <div className="text-muted-foreground text-xs">{gallery.clienteTelefone || 'Sem telefone cadastrado'}</div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="internalNotes" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Observações internas</Label>
                <Textarea
                  id="internalNotes"
                  placeholder="Anotações privadas sobre esta entrega..."
                  value={internalNotes}
                  onChange={e => setInternalNotes(e.target.value)}
                  rows={3}
                  className="text-sm resize-none"
                />
                <p className="text-[11px] text-muted-foreground">Visíveis apenas para você.</p>
              </div>
            </div>

            {/* Coluna Direita: Acesso, Expiração & Configurações */}
            <div className="space-y-5 p-5 rounded-xl border bg-card/60 backdrop-blur-sm">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isPrivate ? <Lock className="h-4 w-4 text-amber-500" /> : <Unlock className="h-4 w-4 text-emerald-500" />}
                    <div>
                      <span className="text-sm font-semibold">{isPrivate ? 'Privada (com senha)' : 'Pública'}</span>
                      <p className="text-xs text-muted-foreground">
                        {isPrivate ? 'Exige senha para visualização e download' : 'Qualquer pessoa com o link pode acessar'}
                      </p>
                    </div>
                  </div>
                  <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
                </div>
                {isPrivate && (
                  <div className="space-y-1.5 pt-1">
                    <Label htmlFor="password" className="text-xs font-medium">Senha de acesso</Label>
                    <Input id="password" type="text" value={galleryPassword} onChange={e => setGalleryPassword(e.target.value)} placeholder="Digite a senha da galeria" />
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold">Data de expiração</span>
                    <p className="text-xs text-muted-foreground">Prazo limite para o cliente baixar os arquivos</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2 text-xs">
                          <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                          {expirationDate ? format(expirationDate, "dd/MM/yyyy", { locale: ptBR }) : 'Definir data'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-xl shadow-lg border border-border/60" align="end">
                        <Calendar mode="single" selected={expirationDate} onSelect={setExpirationDate} initialFocus />
                      </PopoverContent>
                    </Popover>
                    {expirationDate && (
                      <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive h-8 px-2" onClick={() => setExpirationDate(undefined)}>Remover</Button>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold">Mensagem de boas-vindas</span>
                    <p className="text-xs text-muted-foreground">Exibida em modal ao cliente ao abrir a galeria</p>
                  </div>
                  <Switch checked={welcomeEnabled} onCheckedChange={(checked) => {
                    setWelcomeEnabled(checked);
                    if (!checked) setWelcomeMessage('');
                  }} />
                </div>
                {welcomeEnabled && (
                  <Textarea
                    value={welcomeMessage}
                    onChange={e => setWelcomeMessage(e.target.value)}
                    placeholder="Olá! Suas fotos estão prontas..."
                    rows={4}
                    className="text-sm resize-none"
                  />
                )}
              </div>

              <Separator />

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/40">
                <div>
                  <span className="text-sm font-semibold">Download</span>
                  <p className="text-xs text-muted-foreground">Download em alta resolução sempre ativo para entregas</p>
                </div>
                <Badge variant="secondary" className="gap-1.5 text-xs font-normal">
                  <Download className="h-3.5 w-3.5 text-emerald-500" />
                  Ativo
                </Badge>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal de envio de e-mail de entrega */}
      <SendDeliverEmailModal
        isOpen={showEmailModal}
        onOpenChange={setShowEmailModal}
        gallery={gallery}
        photosCount={photos.length}
        galleryUrl={galleryUrl}
      />

      {/* Floating Save Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={handleSave}
          disabled={saving}
          variant="terracotta"
          size="lg"
          className="shadow-2xl gap-2 rounded-full px-6 h-12 backdrop-blur-xl"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Salvando...' : 'Salvar Alterações'}
        </Button>
      </div>
    </div>
  );
}

