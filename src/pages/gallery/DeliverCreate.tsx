import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, ArrowRight, User, Image, MessageSquare, Check, Upload, Globe, Lock, Calendar, Sun, Moon, Plus, HardDrive, ArrowUpCircle, Trash2, Palette, Loader2, Sparkles, Shield, Tag } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { ClientSelect } from '@/components/ClientSelect';
import { ClientModal, ClientFormData } from '@/components/ClientModal';
import { useGalleryClients } from '@/hooks/useGalleryClients';
import { useSettings } from '@/hooks/useSettings';
import { useGallerySettings } from '@/hooks/useGallerySettings';
import { PhotoUploader, UploadedPhoto } from '@/components/PhotoUploader';
import { useSupabaseGalleries } from '@/hooks/useSupabaseGalleries';
import { Client, GalleryPermission, TitleCaseMode } from '@/types/gallery';
import { FontSelect } from '@/components/FontSelect';
import { DeliverPhotoManager } from '@/components/deliver/DeliverPhotoManager';
import { FolderManager } from '@/components/FolderManager';
import { useTransferStorage } from '@/hooks/useTransferStorage';
import { formatStorageSize } from '@/lib/transferPlans';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ThemeCatalog } from '@/components/dashboard/themes/ThemeCatalog';
import { DEFAULT_THEME_ID } from '@/components/gallery/themes/registry';
import { CoverCatalog } from '@/components/deliver/CoverCatalog';
import { COVER_REGISTRY } from '@/components/deliver/covers/registry';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as UiCalendar } from '@/components/ui/calendar';

const steps = [
  { id: 1, name: 'Dados', icon: User },
  { id: 2, name: 'Visual', icon: Sparkles },
  { id: 3, name: 'Fotos', icon: Image },
  { id: 4, name: 'Mensagem', icon: MessageSquare },
];

export default function DeliverCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { clients, isLoading: isLoadingClients, createClient } = useGalleryClients();
  const { settings, updateSettings } = useSettings();
  const { settings: gallerySettings } = useGallerySettings();
  const { createGallery, updateGallery, publishGallery } = useSupabaseGalleries() as any;
  const transferStorage = useTransferStorage();
  const { storageUsedBytes, storageLimitBytes, storageUsedPercent, canCreateTransfer, isUnlimited, planName, isLoading: isLoadingStorage } = transferStorage as any;

  const hasTransferPlan = !isUnlimited && storageLimitBytes > 0;

  const [currentStep, setCurrentStep] = useState(1);
  const [isPublishing, setIsPublishing] = useState(false);

  // Step 1: Data
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  useEffect(() => {
    if (location.state?.preselectClient && clients.length > 0 && !selectedClient) {
      const clientToSelect = clients.find(c => c.id === location.state.preselectClient);
      if (clientToSelect) {
        setSelectedClient(clientToSelect);
      }
    }
  }, [location.state, clients, selectedClient]);

  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [subtitle, setSubtitle] = useState('Wedding Story');
  const [eventDate, setEventDate] = useState<Date | undefined>(new Date());
  const [category, setCategory] = useState('WEDDING');
  const [galleryPermission, setGalleryPermission] = useState<GalleryPermission>('public');
  const [galleryPassword, setGalleryPassword] = useState('');
  const [expirationDays, setExpirationDays] = useState(30);

  // Step 2: Visual (Font, Theme, Cover, Layout)
  const [sessionFont, setSessionFont] = useState('playfair');
  const [titleCaseMode, setTitleCaseMode] = useState<TitleCaseMode>('normal');
  const [clientMode, setClientMode] = useState<'light' | 'dark'>('dark');
  const [photoSpacing, setPhotoSpacing] = useState(6);
  const [useCustomTheme, setUseCustomTheme] = useState(false);
  const [activeThemeId, setActiveThemeId] = useState<string>(DEFAULT_THEME_ID);
  const [themeOverrides, setThemeOverrides] = useState<any>({});
  const [coverId, setCoverId] = useState<string | null>(null);

  // Step 3: Photos
  const [supabaseGalleryId, setSupabaseGalleryId] = useState<string | null>(null);
  const [isCreatingGallery, setIsCreatingGallery] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [photoRefreshKey, setPhotoRefreshKey] = useState(0);
  const [coverPhotoId, setCoverPhotoId] = useState<string | null>(null);
  const [photoCount, setPhotoCount] = useState(0);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  // Step 4: Message & Confirmation
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [welcomeMessageEnabled, setWelcomeMessageEnabled] = useState(true);

  // Initialize defaults from settings
  useEffect(() => {
    if (settings) {
      setExpirationDays(settings.defaultExpirationDays || 30);
      if (settings.lastSessionFont) {
        setSessionFont(settings.lastSessionFont);
      }
      if (settings.clientTheme === 'light') {
        setClientMode('light');
      } else {
        setClientMode('dark');
      }
      if (settings.defaultPhotoSpacing !== undefined) {
        setPhotoSpacing(settings.defaultPhotoSpacing);
      }
    }
  }, [settings]);

  // Initialize welcome toggle from global settings
  useEffect(() => {
    if (gallerySettings) {
      const globalEnabled = gallerySettings.welcomeMessageEnabled ?? true;
      setWelcomeMessageEnabled(globalEnabled);
    }
  }, [gallerySettings]);

  if (isLoadingStorage) {
    return (
      <div className="max-w-5xl mx-auto py-16 flex items-center justify-center">
        <Skeleton className="h-32 w-full max-w-md" />
      </div>
    );
  }

  if (!canCreateTransfer) {
    return (
      <div className="max-w-lg mx-auto py-16 space-y-6 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <HardDrive className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold">Armazenamento Esgotado</h2>
          <p className="text-sm text-muted-foreground">
            Você atingiu o limite de {formatStorageSize(storageLimitBytes)} do seu plano.
            Para criar novas galerias de entrega, faça upgrade do seu plano ou exclua galerias antigas.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-muted/50 space-y-2 text-left">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Uso atual</span>
            <span>{storageUsedPercent.toFixed(0)}%</span>
          </div>
          <Progress value={Math.min(storageUsedPercent, 100)} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">
            {formatStorageSize(storageUsedBytes)} de {formatStorageSize(storageLimitBytes)} usados
            {planName && <span className="ml-1">· {planName}</span>}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button onClick={() => navigate('/app/gallery/settings')} className="gap-2">
            <ArrowUpCircle className="w-4 h-4" />
            {hasTransferPlan ? 'Fazer Upgrade' : 'Ver Planos'}
          </Button>
          {hasTransferPlan && (
            <Button variant="outline" onClick={() => navigate('/app/gallery/list?tab=transfer')} className="gap-2">
              <Trash2 className="h-4 w-4" />
              Gerenciar Galerias
            </Button>
          )}
        </div>
      </div>
    );
  }

  const handleClientCreate = async (data: ClientFormData) => {
    const newClient = await createClient(data);
    if (newClient) {
      setSelectedClient(newClient);
      setIsClientModalOpen(false);
    }
  };

  const ensureGalleryCreated = async () => {
    if (supabaseGalleryId) {
      try {
        await updateGallery({
          id: supabaseGalleryId,
          data: {
            nomeSessao: sessionName,
            permissao: galleryPermission,
            prazoSelecaoDias: expirationDays,
            configuracoes: {
              imageResizeOption: 2560,
              allowDownload: true,
              allowComments: false,
              allowExtraPhotos: false,
              watermark: { type: 'none', opacity: 0, position: 'center' },
              watermarkDisplay: 'none',
              sessionFont,
              titleCaseMode,
              clientMode,
              photoSpacing: useCustomTheme ? (themeOverrides?.layout?.gap ?? photoSpacing) : photoSpacing,
              subtitulo: subtitle.trim() || undefined,
              dataEvento: eventDate ? eventDate.toISOString() : undefined,
              categoria: category.trim() || undefined,
            },
            themeId: useCustomTheme ? activeThemeId : null,
            useCustomTheme: useCustomTheme,
            themeOverrides: themeOverrides,
            coverId: coverId,
          },
        });
        return supabaseGalleryId;
      } catch (e) {
        console.error('Error updating existing gallery:', e);
      }
    }

    setIsCreatingGallery(true);
    try {
      const result = await createGallery({
        clienteId: selectedClient?.id || null,
        clienteNome: selectedClient?.name || null,
        clienteEmail: selectedClient?.email || null,
        nomeSessao: sessionName,
        fotosIncluidas: 0,
        valorFotoExtra: 0,
        permissao: galleryPermission,
        galleryPassword: galleryPermission === 'private' ? galleryPassword : undefined,
        prazoSelecaoDias: expirationDays,
        tipo: 'entrega',
        configuracoes: {
          imageResizeOption: 2560,
          allowDownload: true,
          allowComments: false,
          allowExtraPhotos: false,
          watermark: { type: 'none', opacity: 0, position: 'center' },
          watermarkDisplay: 'none',
          sessionFont,
          titleCaseMode,
          clientMode,
          photoSpacing: useCustomTheme ? (themeOverrides?.layout?.gap ?? photoSpacing) : photoSpacing,
          subtitulo: subtitle.trim() || undefined,
          dataEvento: eventDate ? eventDate.toISOString() : undefined,
          categoria: category.trim() || undefined,
        },
        themeId: useCustomTheme ? activeThemeId : null,
        useCustomTheme: useCustomTheme,
        themeOverrides: themeOverrides,
        coverId: coverId,
      });
      setSupabaseGalleryId(result.id);
      return result.id;
    } catch (error) {
      console.error('Error creating deliver gallery:', error);
      toast.error('Erro ao criar galeria de entrega');
      return null;
    } finally {
      setIsCreatingGallery(false);
    }
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      if (!sessionName.trim()) {
        toast.error('Informe o nome da sessão');
        return;
      }
      if (galleryPermission === 'private' && !galleryPassword.trim()) {
        toast.error('Informe a senha para galeria privada');
        return;
      }
      setCurrentStep(2);
      return;
    }

    if (currentStep === 2) {
      const id = await ensureGalleryCreated();
      if (!id) return;
      setCurrentStep(3);
      return;
    }

    if (currentStep === 3) {
      if (photoCount === 0 && uploadedPhotos.length === 0) {
        toast.error('Envie pelo menos uma foto');
        return;
      }
      setCurrentStep(4);
      return;
    }
  };

  const handleBack = () => {
    if (currentStep === 1) {
      navigate('/app/gallery/list?tab=transfer');
    } else {
      setCurrentStep((prev) => Math.max(prev - 1, 1));
    }
  };

  const handlePublish = async () => {
    if (!supabaseGalleryId || isPublishing) return;

    setIsPublishing(true);
    try {
      const expirationDate = addDays(new Date(), expirationDays);

      await updateGallery({
        id: supabaseGalleryId,
        data: {
          mensagemBoasVindas: welcomeMessageEnabled ? (welcomeMessage.trim() || undefined) : undefined,
          prazoSelecaoDias: expirationDays,
          prazoSelecao: expirationDate,
          configuracoes: {
            imageResizeOption: 2560,
            allowDownload: true,
            allowComments: false,
            allowExtraPhotos: false,
            watermark: { type: 'none', opacity: 0, position: 'center' },
            watermarkDisplay: 'none',
            sessionFont,
            titleCaseMode,
            coverPhotoId: coverPhotoId || undefined,
            clientMode,
            photoSpacing: useCustomTheme ? (themeOverrides?.layout?.gap ?? photoSpacing) : photoSpacing,
            subtitulo: subtitle.trim() || undefined,
            dataEvento: eventDate ? eventDate.toISOString() : undefined,
            categoria: category.trim() || undefined,
          },
          coverId: coverId,
        },
      });

      updateSettings({ lastSessionFont: sessionFont });

      if (publishGallery) {
        await publishGallery(supabaseGalleryId);
      }

      queryClient.invalidateQueries({ queryKey: ['galleries'] });
      queryClient.invalidateQueries({ queryKey: ['galerias'] });
      queryClient.invalidateQueries({ queryKey: ['transfer-storage'] });
      queryClient.invalidateQueries({ queryKey: ['client-gallery', supabaseGalleryId] });

      toast.success('Entrega criada e publicada com sucesso!');
      navigate(`/app/gallery/transfer/${supabaseGalleryId}`);
    } catch (error) {
      console.error('Error publishing deliver gallery:', error);
      toast.error('Erro ao publicar galeria');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleUploadComplete = (photos: UploadedPhoto[]) => {
    setUploadedPhotos((prev) => [...prev, ...photos]);
    setPhotoRefreshKey((k) => k + 1);
  };

  const handleCoverChange = async (photoId: string | null) => {
    setCoverPhotoId(photoId);
    if (supabaseGalleryId) {
      try {
        const { data: gallery } = await (await import('@/integrations/supabase/client')).supabase
          .from('galerias')
          .select('configuracoes')
          .eq('id', supabaseGalleryId)
          .single();

        const existingConfig = (gallery?.configuracoes as Record<string, unknown>) || {};
        await updateGallery({
          id: supabaseGalleryId,
          data: {
            configuracoes: {
              ...existingConfig,
              coverPhotoId: photoId,
            },
          },
        });
      } catch (e) {
        console.error('Error saving cover photo:', e);
      }
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6 animate-fade-in">
            <div className="border-b border-border/40 pb-4">
              <h2 className="text-lg font-semibold text-foreground">Identificação e Acesso</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Defina o cliente, privacidade e dados essenciais da sessão.
              </p>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Shield className="h-4 w-4 text-[#cbb384]" />
                Permissão da Galeria
              </Label>
              <RadioGroup
                value={galleryPermission}
                onValueChange={(v) => {
                  setGalleryPermission(v as GalleryPermission);
                  if (v === 'public') {
                    setSelectedClient(null);
                  }
                }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
              >
                <div>
                  <RadioGroupItem value="public" id="gallery-public" className="peer sr-only" />
                  <Label
                    htmlFor="gallery-public"
                    className={cn(
                      'flex items-center gap-3.5 p-4 rounded-xl border cursor-pointer transition-all duration-200',
                      'hover:-translate-y-0.5 hover:shadow-md hover:border-[#cbb384]/50',
                      galleryPermission === 'public'
                        ? 'border-[#cbb384] bg-[#ddd1b6]/20 ring-1 ring-[#cbb384]/30 shadow-sm'
                        : 'border-border/60 bg-card hover:bg-muted/30'
                    )}
                  >
                    <div className={cn(
                      'p-2.5 rounded-lg transition-colors',
                      galleryPermission === 'public' ? 'bg-[#ddd1b6]/50 dark:bg-[#ddd1b6]/15 text-[#cbb384]' : 'bg-muted text-muted-foreground'
                    )}>
                      <Globe className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Pública</p>
                      <p className="text-xs text-muted-foreground">Sem senha · Acesso direto via link</p>
                    </div>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="private" id="gallery-private" className="peer sr-only" />
                  <Label
                    htmlFor="gallery-private"
                    className={cn(
                      'flex items-center gap-3.5 p-4 rounded-xl border cursor-pointer transition-all duration-200',
                      'hover:-translate-y-0.5 hover:shadow-md hover:border-[#cbb384]/50',
                      galleryPermission === 'private'
                        ? 'border-[#cbb384] bg-[#ddd1b6]/20 ring-1 ring-[#cbb384]/30 shadow-sm'
                        : 'border-border/60 bg-card hover:bg-muted/30'
                    )}
                  >
                    <div className={cn(
                      'p-2.5 rounded-lg transition-colors',
                      galleryPermission === 'private' ? 'bg-[#ddd1b6]/50 dark:bg-[#ddd1b6]/15 text-[#cbb384]' : 'bg-muted text-muted-foreground'
                    )}>
                      <Lock className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Privada</p>
                      <p className="text-xs text-muted-foreground">Protegida por senha de segurança</p>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Client Section - Only show for private galleries */}
            {galleryPermission === 'private' && (
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 space-y-2">
                    <Label className="text-sm font-medium">Cliente <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                    {isLoadingClients ? (
                      <div className="h-10 rounded-md border border-input bg-muted animate-pulse" />
                    ) : (
                      <ClientSelect
                        clients={clients}
                        selectedClient={selectedClient}
                        onSelect={setSelectedClient}
                        onCreateNew={() => setIsClientModalOpen(true)}
                      />
                    )}
                  </div>
                  <div className="pt-6">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setIsClientModalOpen(true)}
                      disabled={isLoadingClients}
                      className="hover:border-[#cbb384]/50"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="password">Senha de acesso *</Label>
                  <Input
                    id="password"
                    type="text"
                    value={galleryPassword}
                    onChange={(e) => setGalleryPassword(e.target.value)}
                    placeholder="Defina uma senha para o cliente"
                  />
                </div>
              </div>
            )}

            {/* Session Name + Expiration - 2 columns */}
            <div className="grid gap-4 md:grid-cols-2 pt-2">
              <div className="space-y-2">
                <Label htmlFor="sessionName">Nome da sessão *</Label>
                <Input
                  id="sessionName"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="Ex: Ensaio Editorial - Maria & Família"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiration" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#cbb384]" />
                  Prazo de expiração (dias)
                </Label>
                <Input
                  id="expiration"
                  type="number"
                  min={1}
                  max={365}
                  value={expirationDays}
                  onChange={(e) => setExpirationDays(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  Disponível para download por {expirationDays} dias após a publicação
                </p>
              </div>
            </div>

            {/* Editorial & Capa Info */}
            <div className="space-y-4 pt-4 border-t border-border/40">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#cbb384]" />
                  Apresentação Editorial da Capa
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Essas informações são exibidas com tipografia nobre na capa da galeria.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="subtitle">Subtítulo da Capa</Label>
                  <Input
                    id="subtitle"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="Ex: Wedding Story"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Categoria / Tag</Label>
                  <Input
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Ex: WEDDING ou ENSAIO"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-[#cbb384]" />
                    Data do Evento / Sessão
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal border-border/60 hover:border-[#cbb384]/50",
                          !eventDate && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4 text-[#cbb384]" />
                        {eventDate ? format(eventDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-xl shadow-lg border border-border/60" align="start">
                      <UiCalendar
                        mode="single"
                        selected={eventDate}
                        onSelect={setEventDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6 animate-fade-in">
            <div className="border-b border-border/40 pb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[#cbb384]" />
                <h2 className="text-lg font-semibold text-foreground">Design e Personalização Visual</h2>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Escolha a tipografia, estilo de apresentação e layout editorial para encantar o cliente.
              </p>
            </div>

            {/* Font Select */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-foreground">Tipografia do Título</Label>
              <FontSelect
                value={sessionFont}
                onChange={setSessionFont}
                previewText={sessionName || 'Ensaio Editorial'}
                titleCaseMode={titleCaseMode}
                onTitleCaseModeChange={setTitleCaseMode}
              />
            </div>

            {/* Tema da Galeria */}
            <div className="space-y-4 pt-4 border-t border-border/40">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-[#cbb384]" />
                <Label className="text-base font-semibold">Tema da Galeria</Label>
              </div>
              
              <div className="grid grid-cols-2 gap-3 max-w-md">
                <div 
                  className={cn(
                    "p-3.5 border rounded-xl cursor-pointer transition-all duration-200 text-center hover:-translate-y-0.5 hover:shadow-sm",
                    !useCustomTheme
                      ? "border-[#cbb384] bg-[#ddd1b6]/20 ring-1 ring-[#cbb384]/30"
                      : "border-border/60 hover:border-[#cbb384]/40 hover:bg-muted/40"
                  )}
                  onClick={() => setUseCustomTheme(false)}
                >
                  <p className={cn("font-semibold text-sm", !useCustomTheme ? "text-[#7a6035] dark:text-[#e4d5b7]" : "text-foreground")}>Herdar Padrão</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Configurações da conta</p>
                </div>
                <div 
                  className={cn(
                    "p-3.5 border rounded-xl cursor-pointer transition-all duration-200 text-center hover:-translate-y-0.5 hover:shadow-sm",
                    useCustomTheme
                      ? "border-[#cbb384] bg-[#ddd1b6]/20 ring-1 ring-[#cbb384]/30"
                      : "border-border/60 hover:border-[#cbb384]/40 hover:bg-muted/40"
                  )}
                  onClick={() => setUseCustomTheme(true)}
                >
                  <p className={cn("font-semibold text-sm", useCustomTheme ? "text-[#7a6035] dark:text-[#e4d5b7]" : "text-foreground")}>Personalizar</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Estilo exclusivo</p>
                </div>
              </div>

              {useCustomTheme && (
                <div className="pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <ThemeCatalog 
                    selectedThemeId={activeThemeId} 
                    onSelect={setActiveThemeId} 
                    onThemeOverridesChange={setThemeOverrides}
                    initialOverrides={themeOverrides}
                  />
                </div>
              )}
            </div>

            {/* Capa da Galeria de Entrega (Hero) */}
            <div className="space-y-4 pt-4 border-t border-border/40">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#cbb384]" />
                <Label className="text-base font-semibold">Capa da Galeria (Hero)</Label>
                <span className="text-[10px] uppercase tracking-wider bg-[#ddd1b6]/50 text-[#7a6035] dark:text-[#e4d5b7] px-2.5 py-0.5 rounded-full border border-[#cbb384]/30 font-medium ml-auto">Hero</span>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                Apresentação inicial da galeria para impactar no primeiro acesso.
              </p>
              <CoverCatalog
                selectedCoverId={coverId}
                onSelect={setCoverId}
                inheritLabel={
                  settings?.defaultCoverId
                    ? `Usar capa padrão do meu estúdio (${
                        COVER_REGISTRY[settings.defaultCoverId]?.name ?? settings.defaultCoverId
                      })`
                    : 'Usar capa padrão do meu estúdio'
                }
              />
            </div>

            {/* Layout e Espaçamento */}
            <div className="grid gap-6 md:grid-cols-2 pt-4 border-t border-border/40">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Espaçamento do Grid</Label>
                  <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded-md text-foreground">
                    {useCustomTheme ? (themeOverrides?.layout?.gap ?? 8) : photoSpacing}px
                  </span>
                </div>
                <Slider
                  value={[useCustomTheme ? (themeOverrides?.layout?.gap ?? 8) : photoSpacing]}
                  onValueChange={(vals) => {
                    if (useCustomTheme) {
                      setThemeOverrides({
                        ...themeOverrides,
                        layout: { ...(themeOverrides.layout || {}), gap: vals[0] }
                      });
                    } else {
                      setPhotoSpacing(vals[0]);
                    }
                  }}
                  min={0}
                  max={40}
                  step={1}
                  className="py-1"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-semibold">Modo de Cor do Cliente</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={clientMode === 'light' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setClientMode('light')}
                    className={cn(
                      "gap-1.5 rounded-xl transition-all",
                      clientMode === 'light' && "bg-[#cbb384] hover:bg-[#bfa574] text-white shadow-sm border-transparent"
                    )}
                  >
                    <Sun className="h-3.5 w-3.5" />
                    Claro
                  </Button>
                  <Button
                    type="button"
                    variant={clientMode === 'dark' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setClientMode('dark')}
                    className={cn(
                      "gap-1.5 rounded-xl transition-all",
                      clientMode === 'dark' && "bg-neutral-900 dark:bg-card text-foreground border-[#cbb384]/50 shadow-sm"
                    )}
                  >
                    <Moon className="h-3.5 w-3.5" />
                    Escuro
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-5 animate-fade-in">
            <div className="border-b border-border/40 pb-4">
              <h2 className="text-lg font-semibold text-foreground">Fotos da Entrega</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Envie as fotos em alta resolução. O cliente poderá fazer o download com qualidade máxima.
              </p>
            </div>

            {/* Folder Manager */}
            {supabaseGalleryId && (
              <FolderManager
                galleryId={supabaseGalleryId}
                activeFolderId={activeFolderId}
                onActiveFolderChange={setActiveFolderId}
              />
            )}

            {supabaseGalleryId && (
              <>
                <PhotoUploader
                  galleryId={supabaseGalleryId}
                  folderId={activeFolderId}
                  maxLongEdge={2560}
                  allowDownload={true}
                  skipCredits={true}
                  storageLimit={storageLimitBytes}
                  storageUsed={storageUsedBytes}
                  onUploadComplete={handleUploadComplete}
                  onUploadingChange={setIsUploading}
                />
                <DeliverPhotoManager
                  galleryId={supabaseGalleryId}
                  refreshKey={photoRefreshKey}
                  coverPhotoId={coverPhotoId}
                  onCoverChange={handleCoverChange}
                  onPhotosChange={setPhotoCount}
                />
              </>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-6 animate-fade-in">
            <div className="border-b border-border/40 pb-4">
              <h2 className="text-lg font-semibold text-foreground">Mensagem e Finalização</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Configure a mensagem de compartilhamento para o cliente e revise os detalhes antes de publicar.
              </p>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-card/60">
              <div className="space-y-0.5">
                <Label htmlFor="welcome-toggle" className="text-sm font-semibold cursor-pointer">Mensagem de Boas-Vindas</Label>
                <p className="text-xs text-muted-foreground">Exibida na tela inicial ao cliente acessar a galeria</p>
              </div>
              <Switch
                id="welcome-toggle"
                checked={welcomeMessageEnabled}
                onCheckedChange={(checked) => {
                  setWelcomeMessageEnabled(checked);
                  if (!checked) setWelcomeMessage('');
                }}
              />
            </div>

            {welcomeMessageEnabled && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Texto da Mensagem</Label>
                <Textarea
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  placeholder="Olá! Suas fotos finais estão prontas para download com máxima qualidade. Aproveite!"
                  rows={6}
                  className="min-h-[160px] rounded-xl"
                />
              </div>
            )}

            {/* Luxury Summary Card */}
            <div className="p-5 rounded-2xl border border-[#cbb384]/40 bg-[#ddd1b6]/10 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#cbb384]" />
                  Resumo da Galeria
                </h3>
                <span className="text-[11px] font-semibold text-[#7a6035] dark:text-[#e4d5b7] bg-[#ddd1b6]/50 px-2.5 py-0.5 rounded-full border border-[#cbb384]/30">
                  Pronta para Publicação
                </span>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm pt-1">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Sessão</span>
                  <p className="font-semibold text-foreground truncate">{sessionName}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Cliente</span>
                  <p className="font-semibold text-foreground truncate">{selectedClient?.name || 'Público'}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Acesso</span>
                  <p className="font-semibold text-foreground">{galleryPermission === 'public' ? 'Pública' : 'Privada'}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Total de Fotos</span>
                  <p className="font-semibold text-[#7a6035] dark:text-[#e4d5b7]">{photoCount || uploadedPhotos.length} fotos</p>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-[79rem] mx-auto w-full bg-background px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-32 sm:pb-36 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/app/gallery/list?tab=transfer')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Nova Entrega</h1>
          <p className="text-muted-foreground text-sm">
            Passo {currentStep} de {steps.length} · {steps[currentStep - 1]?.name}
          </p>
        </div>
      </div>

      {/* Luxury Step Indicator */}
      <div className="flex items-center justify-between mb-8 overflow-x-auto pb-2 scrollbar-none">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;
          return (
            <div key={step.id} className="flex items-center">
              <div
                className={cn(
                  'flex items-center gap-2 px-3.5 py-2 rounded-full transition-all duration-300 whitespace-nowrap text-sm',
                  isActive && 'bg-[#ddd1b6]/50 text-[#66502a] dark:text-[#f0e6d2] border border-[#cbb384] ring-2 ring-[#cbb384]/20 shadow-[0_2px_12px_rgba(203,179,132,0.2)] font-semibold',
                  isCompleted && 'bg-[#ddd1b6]/30 text-[#856b3e] dark:text-[#cbb384] border border-[#cbb384]/30 font-medium',
                  !isActive && !isCompleted && 'text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent'
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4 text-[#cbb384]" />
                ) : (
                  <Icon className={cn('h-4 w-4 transition-transform duration-200', isActive && 'text-[#cbb384] scale-110')} />
                )}
                <span className="hidden sm:inline">{step.name}</span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 w-4 md:w-12 mx-1 md:mx-2 rounded-full transition-colors duration-300',
                    isCompleted ? 'bg-[#cbb384]/60 dark:bg-[#cbb384]/40' : 'bg-border/60'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content Card */}
      <div className="lunari-card p-6 md:p-8 mb-6 border border-border/60 dark:border-border/40 shadow-sm rounded-2xl">
        {renderStep()}
      </div>

      {/* Fixed Bottom Navigation */}
      <div className="fixed bottom-0 left-0 md:left-16 right-0 border-t bg-background/95 backdrop-blur z-40 shadow-[0_-4px_16px_rgba(0,0,0,0.03)]">
        <div className="max-w-[79rem] mx-auto w-full px-3 sm:px-4 lg:px-6 py-4 flex justify-between items-center gap-2">
          <Button
            variant="outline"
            onClick={handleBack}
            className="active:scale-[0.98] transition-all rounded-xl"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {currentStep === 1 ? 'Cancelar' : 'Voltar'}
          </Button>

          {currentStep < steps.length ? (
            <Button
              onClick={handleNext}
              disabled={isCreatingGallery || isUploading}
              className="bg-[#cbb384] hover:bg-[#bfa574] text-white active:scale-[0.98] transition-all rounded-xl shadow-sm font-medium"
            >
              {isCreatingGallery ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando galeria...
                </>
              ) : (
                <>
                  Próximo
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handlePublish}
              disabled={isPublishing || (photoCount === 0 && uploadedPhotos.length === 0)}
              className="bg-[#cbb384] hover:bg-[#bfa574] text-white gap-2 shadow-md active:scale-[0.98] transition-all rounded-xl font-medium"
            >
              {isPublishing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Publicando entrega...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Publicar Entrega
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <ClientModal
        open={isClientModalOpen}
        onOpenChange={setIsClientModalOpen}
        onSave={handleClientCreate}
      />
    </div>
  );
}
