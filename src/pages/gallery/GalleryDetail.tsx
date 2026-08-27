import { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ArrowLeft, 
  Send, 
  Eye,
  EyeOff,
  FileText,
  User,
  Users,
  Calendar,
  Image,
  AlertCircle,
  Loader2,
  Pencil,
  Check,
  Clock,
  RefreshCw,
  MessageSquare,
  Heart,
  Phone,
  Mail,
  ChevronDown,
  ChevronUp,
  CreditCard,
  RotateCcw,
  RotateCw,
  MoreHorizontal,
  Share2,
  Copy,
  
  Trash2,
  Link2,
  Unlink,
  Database,
  ExternalLink,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import { calcularPrecoProgressivoComCredito, RegrasCongeladas } from '@/lib/pricingUtils';
import { getEffectiveGalleryStatus, getBillingModeLabel } from '@/lib/galleryStatus';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MasonryGrid, MasonryItem } from '@/components/MasonryGrid';
import { PhotoCard } from '@/components/PhotoCard';
import { Lightbox } from '@/components/Lightbox';
import { StatusBadge } from '@/components/StatusBadge';
import { ActionTimeline } from '@/components/ActionTimeline';
import { SelectionSummary } from '@/components/SelectionSummary';
import { PhotoCodesModal } from '@/components/PhotoCodesModal';
import { DeleteGalleryDialog } from '@/components/DeleteGalleryDialog';
import { SendGalleryModal } from '@/components/SendGalleryModal';
import { ReactivateGalleryDialog } from '@/components/ReactivateGalleryDialog';
import { ReactivateSuccessModal } from '@/components/ReactivateSuccessModal';
import { PaymentStatusCard } from '@/components/PaymentStatusCard';
import { PaymentHistoryCard } from '@/components/PaymentHistoryCard';

import { useSupabaseGalleries, GaleriaPhoto } from '@/hooks/useSupabaseGalleries';
import { useSettings } from '@/hooks/useSettings';
import { GalleryPhoto, GalleryAction, WatermarkSettings, Gallery } from '@/types/gallery';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getGalleryUrl } from '@/lib/galleryUrl';
import { cn } from '@/lib/utils';

// Types and helpers for photo search codes
export type CodeFormat = 'windows' | 'lightroom' | 'mac' | 'txt';

export const codeFormatLabels: Record<CodeFormat, string> = {
  windows: 'Windows Explorer',
  lightroom: 'Adobe Lightroom',
  mac: 'Finder (Mac)',
  txt: 'Lista simples (TXT)',
};

export const codeFormatDescriptions: Record<CodeFormat, string> = {
  windows: 'Cole o código na barra de pesquisa do Windows Explorer para filtrar as fotos selecionadas.',
  lightroom: 'Cole o código no filtro de texto da Biblioteca do Lightroom (Filtro da Grade > Texto > Contém).',
  mac: 'Cole o código na barra de pesquisa do Finder no macOS para filtrar as fotos do ensaio.',
  txt: 'Lista simples com quebra de linha por foto, ideal para planilhas ou blocos de notas.',
};

export const codeFormatHints: Record<CodeFormat, string> = {
  windows: 'Dica: Cole este código na barra de pesquisa do Windows Explorer para mostrar apenas as fotos selecionadas.',
  lightroom: 'Dica: No Lightroom, abra a pasta, pressione "\\" para abrir o filtro da grade, escolha "Texto" > "Contém" e cole o código.',
  mac: 'Dica: No Finder, acesse a pasta do ensaio e cole o código no campo de busca.',
  txt: 'Dica: Lista limpa com os nomes dos arquivos (sem extensões) para fácil conferência.',
};

// Helper to remove extension from filename
function removeExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.slice(0, lastDot) : filename;
}

// Generate formatted search code
function generateSearchCode(photos: GalleryPhoto[], format: CodeFormat): string {
  if (photos.length === 0) return '';
  const filenames = photos.map(p => removeExtension(p.originalFilename || p.filename));
  switch (format) {
    case 'windows':
      return filenames.map(f => `"${f}"`).join(' OR ');
    case 'lightroom':
      return filenames.join(', ');
    case 'mac':
      return filenames.join(' OR ');
    case 'txt':
      return filenames.join('\n');
    default:
      return filenames.join(' OR ');
  }
}

// Polling interval for pending payments (30 seconds)
const PAYMENT_POLL_INTERVAL = 30000;

export default function GalleryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  type LightboxSource = 'all' | 'selection' | 'filtered';
  const [lightboxState, setLightboxState] = useState<{ source: LightboxSource; index: number } | null>(null);
  const [isCodesModalOpen, setIsCodesModalOpen] = useState(false);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [reactivateSuccessOpen, setReactivateSuccessOpen] = useState(false);
  const [reactivateDays, setReactivateDays] = useState(7);
  const [activePhotoFilter, setActivePhotoFilter] = useState<string>('all');
  const [isCodesCollapsed, setIsCodesCollapsed] = useState(false);
  const [isCodeCopied, setIsCodeCopied] = useState(false);
  const [codeFormat, setCodeFormat] = useState<CodeFormat>('windows');
  const [codeScopeFilter, setCodeScopeFilter] = useState<'all' | 'favorites'>('all');
  const [codesFilter, setCodesFilter] = useState<'all' | 'favorites'>('all');
  const [activeDetailFolderId, setActiveDetailFolderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('selection');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  
  // Get settings for email templates
  const { settings } = useSettings();
  
  // Only use Supabase
  const { 
    getGallery: getSupabaseGallery, 
    fetchGalleryPhotos, 
    sendGallery: sendSupabaseGallery,
    reopenSelection: reopenSupabaseSelection,
    deleteGallery: deleteSupabaseGallery,
    getPhotoUrl,
    isLoading: isSupabaseLoading 
  } = useSupabaseGalleries();

  // Get Supabase gallery
  const supabaseGallery = getSupabaseGallery(id || '');
  
  // Resolve client ID (from gallery directly, or fallback to session/name search)
  const { data: resolvedClienteId } = useQuery({
    queryKey: ['gallery-resolved-client', supabaseGallery?.clienteId, supabaseGallery?.sessionId, supabaseGallery?.clienteNome],
    queryFn: async () => {
      if (supabaseGallery?.clienteId) return supabaseGallery.clienteId;

      if (supabaseGallery?.sessionId) {
        const { data: sess } = await supabase
          .from('clientes_sessoes')
          .select('cliente_id')
          .eq('session_id', supabaseGallery.sessionId)
          .maybeSingle();
        if (sess?.cliente_id) return sess.cliente_id;
      }

      if (supabaseGallery?.clienteNome) {
        const { data: client } = await supabase
          .from('clientes')
          .select('id')
          .ilike('nome', supabaseGallery.clienteNome.trim())
          .limit(1)
          .maybeSingle();
        if (client?.id) return client.id;
      }

      return null;
    },
    enabled: !!supabaseGallery,
  });

  const effectiveClienteId = supabaseGallery?.clienteId || resolvedClienteId;

  // Fetch photos for Supabase gallery
  const { data: supabasePhotos = [], isLoading: isLoadingPhotos } = useQuery({
    queryKey: ['galeria-fotos', id],
    queryFn: () => fetchGalleryPhotos(id!),
    enabled: !!supabaseGallery && !!id,
  });

  // Fetch gallery folders
  const { data: galleryFolders = [] } = useQuery({
    queryKey: ['galeria-pastas', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('galeria_pastas')
        .select('*')
        .eq('galeria_id', id!)
        .order('ordem');
      if (error) {
        console.error('Error fetching folders:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!id,
  });

  // Visitor states
  const [expandedVisitorId, setExpandedVisitorId] = useState<string | null>(null);
  const [visitorPhotosMap, setVisitorPhotosMap] = useState<Record<string, GalleryPhoto[]>>({});
  const [visitorCodesModalId, setVisitorCodesModalId] = useState<string | null>(null);
  const [loadingVisitorPhotos, setLoadingVisitorPhotos] = useState<string | null>(null);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  // Fetch visitor photos when expanding
  const fetchVisitorPhotos = useCallback(async (visitorId: string) => {
    if (visitorPhotosMap[visitorId]) return; // already cached
    setLoadingVisitorPhotos(visitorId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gallery-visitors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ galleryId: id, visitorId }),
      });
      if (!response.ok) return;
      const data = await response.json();
      const mapped: GalleryPhoto[] = (data.selectedPhotos || []).map((p: any) => ({
        id: p.id,
        filename: p.filename || '',
        originalFilename: p.original_filename || p.filename || '',
        thumbnailUrl: '',
        previewUrl: '',
        originalUrl: '',
        width: p.width || 0,
        height: p.height || 0,
        isSelected: true,
        isFavorite: (data.selections || []).find((s: any) => s.foto_id === p.id)?.is_favorite || false,
        comment: (data.selections || []).find((s: any) => s.foto_id === p.id)?.comment || undefined,
        order: 0,
        folderId: null,
      }));
      setVisitorPhotosMap(prev => ({ ...prev, [visitorId]: mapped }));
    } catch (e) {
      console.error('Error fetching visitor photos:', e);
    } finally {
      setLoadingVisitorPhotos(null);
    }
  }, [id, visitorPhotosMap]);

  // Fetch visitors for public galleries
  const isPublicGallery = supabaseGallery?.permissao === 'public';
  const { data: visitorsData, isLoading: isLoadingVisitors, refetch: refetchVisitors } = useQuery({
    queryKey: ['galeria-visitantes', id],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { visitors: [] };
      
      const response = await fetch(`${supabaseUrl}/functions/v1/gallery-visitors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ galleryId: id }),
      });
      
      if (!response.ok) return { visitors: [] };
      return response.json();
    },
    enabled: !!id && !!isPublicGallery,
  });


  const { data: galleryActions = [] } = useQuery({
    queryKey: ['galeria-acoes', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('galeria_acoes')
        .select('id, tipo, descricao, created_at')
        .eq('galeria_id', id!)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching gallery actions:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!id,
  });

  // Fetch ALL paid cobrancas for payment history
  const { data: cobrancasPagas = [], refetch: refetchCobrancas } = useQuery({
    queryKey: ['galeria-cobrancas-pagas', id],
    queryFn: async () => {
      if (!id) return [];
      
      const { data, error } = await supabase
        .from('cobrancas')
        .select('id, valor, qtd_fotos, provedor, metodo_manual, data_pagamento, ip_receipt_url, ip_checkout_url, status, created_at')
        .eq('galeria_id', id)
        .eq('finalidade', 'fotos_extras') // não misturar com entrada da sessão (Studio)
        .in('status', ['pago', 'pago_manual'])
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('Error fetching paid charges:', error);
        return [];
      }
      
      return data || [];
    },

    enabled: !!supabaseGallery,
  });

  // Fetch latest PENDING cobranca for payment status actions
  // CRITICAL: only pending/awaiting — never reuse a paid cobrança (avoid overwrite bug
  // in reactivated galleries where last cobrança was a previously paid one).
  const { data: cobrancaData, refetch: refetchCobranca } = useQuery({
    queryKey: ['galeria-cobranca-pendente', id],
    queryFn: async () => {
      if (!id) return null;
      const PENDING_STATUSES = ['pendente', 'aguardando_confirmacao'];

      const { data, error } = await supabase
        .from('cobrancas')
        .select('*')
        .eq('galeria_id', id)
        .eq('finalidade', 'fotos_extras')
        .in('status', PENDING_STATUSES)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching pending charge:', error);
        return null;
      }
      return data;
    },

    enabled: !!supabaseGallery,
  });

  // Check payment status via edge function
  const checkPaymentStatus = useCallback(async () => {
    if (!cobrancaData?.id) return;
    
    try {
      console.log('[Polling] Checking payment status for cobranca:', cobrancaData.id);
      
      const { data, error } = await supabase.functions.invoke('check-payment-status', {
        body: { 
          cobrancaId: cobrancaData.id,
          forceUpdate: false 
        }
      });
      
      if (error) {
        console.error('[Polling] Error checking payment:', error);
        return;
      }
      
      if (data?.status === 'pago' && cobrancaData.status !== 'pago') {
        console.log('[Polling] Payment confirmed! Refreshing data...');
        
        // Refresh all relevant queries
        queryClient.invalidateQueries({ queryKey: ['galleries'] });
        queryClient.invalidateQueries({ queryKey: ['galerias'] });
        queryClient.invalidateQueries({ queryKey: ['galeria-cobranca'] });
        refetchCobranca();
      }
    } catch (err) {
      console.error('[Polling] Exception:', err);
    }
  }, [cobrancaData?.id, cobrancaData?.status, queryClient, refetchCobranca]);

  // Automatic polling for pending InfinitePay/MercadoPago payments
  useEffect(() => {
    const isPendingExternalPayment = 
      (cobrancaData?.status === 'pendente' || cobrancaData?.status === 'parcialmente_pago') && 
      (cobrancaData?.provedor === 'infinitepay' || cobrancaData?.provedor === 'mercadopago' || cobrancaData?.provedor === 'asaas');
    
    if (!isPendingExternalPayment) {
      return;
    }
    
    console.log('[Polling] Starting automatic payment status polling every 30s');
    
    // Check immediately once
    checkPaymentStatus();
    
    // Then set up interval
    const interval = setInterval(checkPaymentStatus, PAYMENT_POLL_INTERVAL);
    
    return () => {
      console.log('[Polling] Stopping automatic payment status polling');
      clearInterval(interval);
    };
  }, [cobrancaData?.status, cobrancaData?.provedor, checkPaymentStatus]);

  // Transform Supabase photos to GalleryPhoto format (uses R2 for previews, B2 for originals)
  const transformedPhotos: GalleryPhoto[] = useMemo(() => {
    return supabasePhotos.map((photo: GaleriaPhoto, index: number) => ({
      id: photo.id,
      filename: photo.filename,
      originalFilename: photo.originalFilename || photo.filename,
      thumbnailUrl: getPhotoUrl(photo, supabaseGallery, 'thumbnail'),
      previewUrl: getPhotoUrl(photo, supabaseGallery, 'preview'),
      originalUrl: getPhotoUrl(photo, supabaseGallery, 'full'),
      width: photo.width,
      height: photo.height,
      isSelected: photo.isSelected,
      isFavorite: photo.isFavorite ?? false,
      comment: photo.comment || undefined,
      order: photo.orderIndex || index,
      folderId: photo.pastaId || null,
    }));
  }, [supabasePhotos, supabaseGallery, getPhotoUrl]);

  // Build actions timeline from database
  const actions: GalleryAction[] = useMemo(() => {
    // Map database action types to component types
    const typeMap: Record<string, GalleryAction['type']> = {
      'criada': 'created',
      'enviada': 'sent',
      'cliente_acessou': 'client_started',
      'cliente_confirmou': 'client_confirmed',
      'selecao_reaberta': 'selection_reopened',
      'pagamento_confirmado': 'payment_confirmed',
      'pagamento_informado': 'payment_informed',
      'selecao_iniciada': 'selection_started',
      'expirada': 'expired',
    };
    
    // Filter relevant action types for main timeline
    const relevantTypes = [
      'criada', 'enviada', 'cliente_acessou', 'cliente_confirmou', 
      'selecao_reaberta', 'pagamento_confirmado', 'pagamento_informado',
      'selecao_iniciada', 'expirada',
    ];
    
    return galleryActions
      .filter((action: { tipo: string }) => relevantTypes.includes(action.tipo))
      .map((action: { id: string; tipo: string; descricao: string | null; created_at: string }) => ({
        id: action.id,
        type: typeMap[action.tipo] || 'created',
        timestamp: new Date(action.created_at),
        description: action.descricao || action.tipo,
      }));
  }, [galleryActions]);

  // Derived photos lists (ALL HOOKS MUST BE DECLARED ABOVE EARLY RETURNS)
  const selectedPhotos = useMemo(() => transformedPhotos.filter(p => p.isSelected), [transformedPhotos]);
  const favoritePhotos = useMemo(() => selectedPhotos.filter(p => p.isFavorite), [selectedPhotos]);
  const photosWithComments = useMemo(() => selectedPhotos.filter(p => p.comment), [selectedPhotos]);

  const currentPhotosList = useMemo(() => {
    if (activePhotoFilter === 'selected') {
      return transformedPhotos.filter(p => p.isSelected);
    }
    if (activePhotoFilter === 'favorites') {
      return transformedPhotos.filter(p => p.isSelected && p.isFavorite);
    }
    if (activePhotoFilter.startsWith('folder:')) {
      const folderId = activePhotoFilter.replace('folder:', '');
      return transformedPhotos.filter(p => p.folderId === folderId);
    }
    return transformedPhotos;
  }, [transformedPhotos, activePhotoFilter]);

  // Selected photos for code generation based on scope filter (all vs favorites)
  const photosForCode = useMemo(() => {
    if (codeScopeFilter === 'favorites') {
      return favoritePhotos;
    }
    return selectedPhotos;
  }, [selectedPhotos, favoritePhotos, codeScopeFilter]);

  // Formatted search code string
  const generatedCode = useMemo(() => {
    return generateSearchCode(photosForCode, codeFormat);
  }, [photosForCode, codeFormat]);

  const handleCopyCode = useCallback((code: string) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setIsCodeCopied(true);
    toast.success('Código copiado para a área de transferência!');
    setTimeout(() => setIsCodeCopied(false), 2500);
  }, []);

  // Combined loading state
  const isLoadingData = isSupabaseLoading || isLoadingPhotos;

  // Show loading state while galleries are being loaded
  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Carregando galeria...</p>
        </div>
      </div>
    );
  }

  // Gallery not found
  if (!supabaseGallery) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-2xl font-bold mb-2">
          Galeria não encontrada
        </h2>
        <p className="text-muted-foreground mb-4">
          A galeria solicitada não existe ou foi removida.
        </p>
        <Button variant="outline" onClick={() => navigate('/app/gallery/list')}>
          Voltar ao Dashboard
        </Button>
      </div>
    );
  }

  // Use public_token for client link if available, otherwise show warning
  const hasPublicToken = !!supabaseGallery.publicToken;
  const clientLink = hasPublicToken
    ? getGalleryUrl(supabaseGallery.publicToken)
    : null;
  
  // Calculate deadline
  const deadline = supabaseGallery.prazoSelecao || 
    new Date(supabaseGallery.createdAt.getTime() + (supabaseGallery.prazoSelecaoDias || 7) * 24 * 60 * 60 * 1000);

  const handleSendGallery = async () => {
    try {
      // sendGallery now uses prepare_gallery_share RPC internally (no client-side token gen)
      await sendSupabaseGallery(supabaseGallery.id);
      // Refresh gallery data to pick up the token set by RPC
      queryClient.invalidateQueries({ queryKey: ['galleries'] });
      queryClient.invalidateQueries({ queryKey: ['galerias'] });
      queryClient.invalidateQueries({ queryKey: ['client-gallery', supabaseGallery.id] });
    } catch (error) {
      console.error('Error sending gallery:', error);
    }
  };

  const handleReopenSelection = async (days: number) => {
    await reopenSupabaseSelection({ id: supabaseGallery.id, days } as any);
    // Aguarda o refetch para garantir que publicToken esteja atualizado.
    await queryClient.invalidateQueries({ queryKey: ['galleries'] });
    await queryClient.invalidateQueries({ queryKey: ['galerias'] });
    await queryClient.invalidateQueries({ queryKey: ['client-gallery', supabaseGallery.id] });
    await queryClient.refetchQueries({ queryKey: ['galleries'] });
  };

  const handleDeleteGallery = async () => {
    await deleteSupabaseGallery(supabaseGallery.id);
    navigate('/app/gallery/list');
  };

  // Check if gallery can be reactivated
  // (cálculo direto — não pode ser hook, pois está após early returns)
  const canReactivate = (() => {
    const status = getEffectiveGalleryStatus(
      supabaseGallery.status,
      supabaseGallery.statusPagamento,
      supabaseGallery.finalizedAt,
      supabaseGallery.statusSelecao,
      supabaseGallery.prazoSelecao
    );

    // Pode reativar se estiver expirada ou concluída (bloqueada)
    return status === 'expired' || status === 'selection_completed';
  })();


  // Default watermark settings
  const watermark: WatermarkSettings = (supabaseGallery.configuracoes?.watermark as WatermarkSettings) || {
    type: 'standard',
    opacity: 40,
    position: 'center',
  };

  // Map status
  const effectiveStatus = getEffectiveGalleryStatus(
    supabaseGallery.status,
    supabaseGallery.statusPagamento,
    supabaseGallery.finalizedAt,
    supabaseGallery.statusSelecao,
    supabaseGallery.prazoSelecao
  );


  // Calculate progressive pricing for summary using credit system
  const regrasCongeladas = supabaseGallery.regrasCongeladas as RegrasCongeladas | null;
  const extrasNecessarias = Math.max(0, supabaseGallery.fotosSelecionadas - supabaseGallery.fotosIncluidas);
  const extrasPagasTotal = supabaseGallery.totalFotosExtrasVendidas || 0;
  const valorJaPago = supabaseGallery.valorTotalVendido || 0;
  const extrasACobrar = Math.max(0, extrasNecessarias - extrasPagasTotal);
  
  const { valorUnitario, valorACobrar: calculatedExtraTotal, economia } = calcularPrecoProgressivoComCredito(
    extrasACobrar,
    extrasPagasTotal,
    valorJaPago,
    regrasCongeladas,
    supabaseGallery.valorFotoExtra
  );

  // Build gallery object for SelectionSummary
  const galleryForSummary: Gallery = {
    id: supabaseGallery.id,
    clientName: supabaseGallery.clienteNome || 'Cliente',
    clientEmail: supabaseGallery.clienteEmail || '',
    sessionName: supabaseGallery.nomeSessao || 'Sessão',
    packageName: supabaseGallery.nomePacote || '',
    includedPhotos: supabaseGallery.fotosIncluidas,
    extraPhotoPrice: valorUnitario, // Use calculated progressive price
    saleSettings: (supabaseGallery.configuracoes?.saleSettings as Gallery['saleSettings']) || {
      mode: 'sale_without_payment',
      pricingModel: 'fixed',
      chargeType: 'only_extras',
      fixedPrice: supabaseGallery.valorFotoExtra,
      discountPackages: [],
    },
    status: effectiveStatus,
    selectionStatus: supabaseGallery.statusSelecao === 'selecao_completa' ? 'confirmed' : 'in_progress',
    settings: {
      welcomeMessage: supabaseGallery.mensagemBoasVindas || '',
      deadline,
      deadlinePreset: 'custom',
      watermark,
      watermarkDisplay: 'all',
      imageResizeOption: 1920,
      allowComments: supabaseGallery.configuracoes?.allowComments ?? true,
      allowDownload: supabaseGallery.configuracoes?.allowDownload ?? false,
      allowExtraPhotos: true,
      photoSpacing: supabaseGallery.configuracoes?.photoSpacing ?? settings?.defaultPhotoSpacing ?? 6,
    },
    photos: transformedPhotos,
    actions,
    createdAt: supabaseGallery.createdAt,
    updatedAt: supabaseGallery.updatedAt,
    selectedCount: supabaseGallery.fotosSelecionadas,
    extraCount: extrasNecessarias,
    extraTotal: calculatedExtraTotal, // Use calculated total
  };

  return (
    <div className="max-w-[79rem] mx-auto w-full bg-background px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-[max(4rem,env(safe-area-inset-bottom))] animate-fade-in">
      {/* Header — Identificação + Informações + Ações */}
      {(() => {
        const vendido = supabaseGallery.valorTotalVendido || 0;
        const pendente = calculatedExtraTotal || 0;
        const exp = (supabaseGallery as any).expiresAt as Date | null | undefined;
        const isLinkedToStudio = !!supabaseGallery.sessionId;

        const paymentBadge = (() => {
          if (vendido <= 0 && pendente <= 0) return null;
          const commonProps = {
            onClick: () => setActiveTab('details'),
            title: 'Ver detalhes do pagamento',
          };
          if (vendido > 0 && pendente > 0) {
            return (
              <button {...commonProps} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-[#ddd1b6]/50 text-[#7a6035] dark:text-[#e4d5b7] border-[#cbb384]/40 hover:opacity-80 transition">
                <Clock className="h-3.5 w-3.5 text-[#cbb384]" />
                Parcial · Pago R$ {vendido.toFixed(2)} / Pendente R$ {pendente.toFixed(2)}
              </button>
            );
          }
          if (pendente > 0) {
            return (
              <button {...commonProps} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-[#ddd1b6]/50 text-[#7a6035] dark:text-[#e4d5b7] border-[#cbb384]/40 hover:opacity-80 transition">
                <Clock className="h-3.5 w-3.5 text-[#cbb384]" />
                Pendente R$ {pendente.toFixed(2)}
              </button>
            );
          }
          return (
            <button {...commonProps} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30 hover:opacity-80 transition">
              <Check className="h-3.5 w-3.5" />
              Pago R$ {vendido.toFixed(2)}
            </button>
          );
        })();

        const expirationBadge = (() => {
          if (!exp) return null;
          const diffDays = Math.ceil((exp.getTime() - Date.now()) / 86400000);
          if (diffDays > 60) return null;
          const isExpired = diffDays <= 0;
          const isUrgent = diffDays <= 30;
          const cls = isExpired
            ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'
            : isUrgent
              ? 'bg-[#ddd1b6]/50 text-[#7a6035] dark:text-[#e4d5b7] border-[#cbb384]/40'
              : 'bg-muted text-muted-foreground border-border';
          const label = isExpired ? 'Expira hoje (12m)' : `Expira em ${diffDays} dia${diffDays === 1 ? '' : 's'}`;
          return (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cls}`}
              title={`Galerias são excluídas automaticamente após 12 meses. Expira em ${format(exp, "dd/MM/yyyy", { locale: ptBR })}.`}
            >
              <Clock className="h-3.5 w-3.5 text-[#cbb384]" />
              {label}
            </span>
          );
        })();

        const InfoCard = ({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) => (
          <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-card/40 px-4 py-3 min-w-0">
            <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
              <p className="text-sm font-medium truncate" title={typeof value === 'string' ? value : undefined}>{value}</p>
            </div>
          </div>
        );

        const menuItems = (
          <>
            <DropdownMenuItem asChild>
              <Link to={`/app/gallery/select/${supabaseGallery.id}/edit`}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={(e) => { e.preventDefault(); setDeleteDialogOpen(true); }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir galeria
            </DropdownMenuItem>
          </>
        );

        const sheetMenuItems = (
          <div className="flex flex-col gap-1 mt-2">
            <Button variant="ghost" className="justify-start" asChild onClick={() => setMobileMenuOpen(false)}>
              <Link to={`/app/gallery/select/${supabaseGallery.id}/edit`}>
                <Pencil className="h-4 w-4 mr-2" /> Editar
              </Link>
            </Button>
            <div className="h-px bg-border my-1" />
            <Button
              variant="ghost"
              className="justify-start text-destructive hover:text-destructive"
              onClick={() => { setMobileMenuOpen(false); setDeleteDialogOpen(true); }}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Excluir galeria
            </Button>
          </div>
        );

        return (
          <div className="flex flex-col gap-6">
            {/* Área 1 — Identificação */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
                <Button variant="ghost" size="icon" onClick={() => navigate('/app/gallery/list')} className="shrink-0 -ml-2">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 flex-wrap min-w-0">
                    <h1 className="text-2xl md:text-3xl font-semibold tracking-tight truncate min-w-0">
                      {supabaseGallery.nomeSessao || 'Galeria'}
                    </h1>
                    <StatusBadge status={effectiveStatus} />
                  </div>
                  {(paymentBadge || expirationBadge) && (
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      {paymentBadge}
                      {expirationBadge}
                    </div>
                  )}
                </div>
              </div>

              {/* Ações — Desktop */}
              <div className="hidden md:flex items-center gap-2 shrink-0">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className={cn(
                          "rounded-full transition-colors",
                          isLinkedToStudio ? "text-green-500 hover:text-green-600 hover:bg-green-50" : "text-red-500 hover:text-red-600 hover:bg-red-50"
                        )}
                        onClick={() => toast.info(isLinkedToStudio ? "Esta galeria está vinculada a uma sessão do estúdio" : "Esta galeria não possui vínculo com o estúdio")}
                      >
                        {isLinkedToStudio ? <Database className="h-5 w-5" /> : <Unlink className="h-5 w-5" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{isLinkedToStudio ? "Vinculada ao estúdio" : "Não vinculada ao estúdio"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setReactivateOpen(true)}
                  className={cn(
                    "transition-opacity",
                    !canReactivate && "opacity-40 cursor-not-allowed pointer-events-none"
                  )}
                  disabled={!canReactivate}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reativar
                </Button>
                
                <Button variant="terracotta" size="sm" onClick={() => setIsSendModalOpen(true)}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Compartilhar
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="Mais ações">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {menuItems}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Menu — Mobile */}
              <div className="md:hidden shrink-0">
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="Mais ações">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="rounded-t-2xl">
                    <SheetHeader>
                      <SheetTitle className="text-left">Ações da galeria</SheetTitle>
                    </SheetHeader>
                    {sheetMenuItems}
                  </SheetContent>
                </Sheet>
              </div>
            </div>

            {/* Área 2 — Cards informativos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <InfoCard 
                icon={User} 
                label="Cliente" 
                value={
                  effectiveClienteId ? (
                    <Link
                      to={`/app/clientes/${effectiveClienteId}`}
                      className="hover:underline hover:text-primary transition-colors inline-flex items-center gap-1.5 max-w-full group"
                      title="Ver perfil do cliente no CRM"
                    >
                      <span className="truncate">{supabaseGallery.clienteNome || '—'}</span>
                      <ExternalLink className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                    </Link>
                  ) : (
                    supabaseGallery.clienteNome || '—'
                  )
                } 
              />
              <InfoCard icon={Calendar} label="Data da sessão" value={format(deadline, "dd MMM yyyy", { locale: ptBR })} />
              <InfoCard icon={Image} label="Total de fotos" value={`${supabaseGallery.totalFotos} fotos`} />
            </div>

            {/* Ações primárias — Mobile (abaixo dos cards) */}
            <div className="flex flex-col gap-2 md:hidden">
              <div className="flex items-center gap-2 mb-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={cn(
                    "flex-1 justify-center gap-2 rounded-xl",
                    isLinkedToStudio ? "text-green-500 bg-green-50" : "text-red-500 bg-red-50"
                  )}
                  onClick={() => toast.info(isLinkedToStudio ? "Esta galeria está vinculada a uma sessão do estúdio" : "Esta galeria não possui vínculo com o estúdio")}
                >
                  {isLinkedToStudio ? <Database className="h-4 w-4" /> : <Unlink className="h-4 w-4" />}
                  <span className="text-xs font-medium">{isLinkedToStudio ? "Vinculada" : "Não vinculada"}</span>
                </Button>
              </div>

              <Button variant="terracotta" size="sm" className="w-full" onClick={() => setIsSendModalOpen(true)}>
                <Share2 className="h-4 w-4 mr-2" />
                Compartilhar
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                className={cn(
                  "w-full",
                  !canReactivate && "opacity-40 cursor-not-allowed pointer-events-none"
                )}
                onClick={() => setReactivateOpen(true)}
                disabled={!canReactivate}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reativar
              </Button>
            </div>

            {/* Delete dialog controlado — sem trigger, aberto via menu */}
            <DeleteGalleryDialog
              galleryName={supabaseGallery.nomeSessao || 'Esta galeria'}
              onDelete={handleDeleteGallery}
              open={deleteDialogOpen}
              onOpenChange={setDeleteDialogOpen}
            />
          </div>
        );
      })()}



      {/* PIX Manual Payment Confirmation Banner */}
      {supabaseGallery.statusPagamento === 'aguardando_confirmacao' && (
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Aguardando confirmação de pagamento PIX
                </p>
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Valor: R$ {(supabaseGallery.valorExtras || calculatedExtraTotal).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="photos">Fotos ({transformedPhotos.length})</TabsTrigger>
          <TabsTrigger value="selection">Seleção ({selectedPhotos.length})</TabsTrigger>
          {isPublicGallery && (
            <TabsTrigger value="visitors">
              <Users className="h-4 w-4 mr-1" />
              Visitantes ({visitorsData?.visitors?.length || 0})
            </TabsTrigger>
          )}
          <TabsTrigger value="details">Detalhes</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="photos" className="space-y-4">
          {/* Filter pills: Todas, Selecionadas, Favoritas e Pastas */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setActivePhotoFilter('all')}
              className={cn(
                'shrink-0 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors border',
                activePhotoFilter === 'all'
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              Todas ({transformedPhotos.length})
            </button>

            <button
              onClick={() => setActivePhotoFilter('selected')}
              className={cn(
                'shrink-0 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors border inline-flex items-center gap-1.5',
                activePhotoFilter === 'selected'
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Check className="h-3.5 w-3.5" />
              Selecionadas ({selectedPhotos.length})
            </button>

            {favoritePhotos.length > 0 && (
              <button
                onClick={() => setActivePhotoFilter('favorites')}
                className={cn(
                  'shrink-0 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors border inline-flex items-center gap-1.5',
                  activePhotoFilter === 'favorites'
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Heart className="h-3.5 w-3.5 text-red-500 fill-current" />
                Favoritas ({favoritePhotos.length})
              </button>
            )}

            {galleryFolders.map((folder: any) => {
              const count = transformedPhotos.filter(p => p.folderId === folder.id).length;
              const isFolderActive = activePhotoFilter === `folder:${folder.id}`;
              return (
                <button
                  key={folder.id}
                  onClick={() => setActivePhotoFilter(`folder:${folder.id}`)}
                  className={cn(
                    'shrink-0 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors border',
                    isFolderActive
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {folder.nome} ({count})
                </button>
              );
            })}
          </div>

          {/* Photos Grid */}
          {currentPhotosList.length > 0 ? (
            <MasonryGrid gap={supabaseGallery?.configuracoes?.photoSpacing ?? settings?.defaultPhotoSpacing ?? galleryForSummary.settings.photoSpacing ?? 6}>
              {currentPhotosList.map((photo, index) => (
                <MasonryItem key={photo.id} photoWidth={photo.width} photoHeight={photo.height}>
                  <PhotoCard
                    photo={photo}
                    isSelected={photo.isSelected}
                    allowComments={supabaseGallery.configuracoes?.allowComments ?? true}
                    readOnly
                    onSelect={() => {}}
                    onViewFullscreen={() => setLightboxState({ source: 'filtered', index })}
                  />
                </MasonryItem>
              ))}
            </MasonryGrid>
          ) : (
            <div className="text-center py-16 lunari-card">
              <Image className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {activePhotoFilter === 'selected'
                  ? 'Nenhuma foto selecionada pelo cliente ainda'
                  : activePhotoFilter === 'favorites'
                    ? 'Nenhuma foto marcada como favorita'
                    : activePhotoFilter.startsWith('folder:')
                      ? 'Nenhuma foto nesta pasta'
                      : 'Nenhuma foto adicionada ainda'}
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="selection" className="space-y-6">
          {isPublicGallery ? (
            <div className="text-center py-16 lunari-card">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">
                Em galerias públicas, cada visitante possui sua própria seleção.
              </p>
              <p className="text-sm text-muted-foreground">
                Acesse a aba <strong>Visitantes</strong> para ver as seleções individuais.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2 items-start">
              {/* COLUNA ESQUERDA: Seleção da sessão + Resumo da seleção */}
              <div className="space-y-4">
                {/* Card 1: Seleção da sessão */}
                <div className="lunari-card p-5 space-y-4">
                  <h3 className="text-base font-semibold tracking-tight text-foreground">
                    Seleção da sessão
                  </h3>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-card/60 border border-border/50">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-full border border-border/80 flex items-center justify-center bg-muted/40 shrink-0">
                        <Check className="h-5 w-5 text-foreground/80" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-base text-foreground">
                            {selectedPhotos.length} {selectedPhotos.length === 1 ? 'foto selecionada' : 'fotos selecionadas'}
                          </p>
                          {favoritePhotos.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-medium">
                              <Heart className="h-3 w-3 fill-current" />
                              {favoritePhotos.length}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {supabaseGallery.fotosIncluidas} {supabaseGallery.fotosIncluidas === 1 ? 'foto incluída' : 'fotos incluídas'}
                          {extrasNecessarias > 0 ? ` + ${extrasNecessarias} ${extrasNecessarias === 1 ? 'foto extra paga' : 'fotos extras pagas'}` : ''}
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-2 font-medium border-border/60 hover:bg-muted"
                      onClick={() => {
                        setActivePhotoFilter('selected');
                        setActiveTab('photos');
                      }}
                    >
                      <Eye className="h-4 w-4" />
                      Ver fotos
                    </Button>
                  </div>
                </div>

                {/* Card 2: Resumo da seleção */}
                <div className="lunari-card p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold tracking-tight text-foreground">
                      Resumo da seleção
                    </h3>
                    <div className="w-6 h-6 rounded-full bg-muted/50 flex items-center justify-center border border-border/40">
                      <Check className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>

                  {/* Progresso da Seleção */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <span>Progresso da seleção</span>
                      <span className="text-foreground font-bold">
                        {Math.round((selectedPhotos.length / Math.max(supabaseGallery.fotosIncluidas, 1)) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full transition-all duration-700 rounded-full',
                          extrasNecessarias > 0 ? 'bg-amber-500' : 'bg-primary'
                        )}
                        style={{
                          width: `${Math.min(100, (selectedPhotos.length / Math.max(supabaseGallery.fotosIncluidas, 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Métricas: Incluídas, Selecionadas, Extras */}
                  <div className="grid grid-cols-3 gap-3 py-2 border-y border-border/40">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                        Fotos Incluídas
                      </span>
                      <span className="text-lg font-bold text-foreground">
                        {supabaseGallery.fotosIncluidas}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                        Selecionadas
                      </span>
                      <span className={cn('text-lg font-bold', extrasNecessarias > 0 ? 'text-amber-500' : 'text-foreground')}>
                        {selectedPhotos.length}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                        Fotos Extras
                      </span>
                      <span className="text-lg font-bold text-amber-500">
                        {extrasNecessarias > 0 ? `+${extrasNecessarias}` : '0'}
                      </span>
                      {extrasPagasTotal > 0 && (
                        <p className="text-[10px] text-muted-foreground leading-tight">
                          Já pagas em ciclos anteriores: {extrasPagasTotal}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Faturamento */}
                  <div className="space-y-2.5 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Faturamento
                      </span>
                      {(() => {
                        const totalVendido = supabaseGallery.valorTotalVendido || 0;
                        const pendente = calculatedExtraTotal || 0;
                        if (totalVendido > 0 && pendente <= 0) {
                          return (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/30">
                              <Check className="h-3 w-3" />
                              Pago
                            </span>
                          );
                        }
                        if (pendente > 0) {
                          return (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                              <Clock className="h-3 w-3" />
                              Pendente
                            </span>
                          );
                        }
                        return (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                            Sem cobrança
                          </span>
                        );
                      })()}
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-muted-foreground">Valor total</span>
                        <span className="text-lg font-bold text-foreground">
                          R$ {((supabaseGallery.valorTotalVendido || 0) + (calculatedExtraTotal || 0)).toFixed(2)}
                        </span>
                      </div>
                      {(supabaseGallery.totalFotosExtrasVendidas || extrasNecessarias) ? (
                        <p className="text-xs text-muted-foreground">
                          {(supabaseGallery.totalFotosExtrasVendidas || extrasNecessarias)} {(supabaseGallery.totalFotosExtrasVendidas || extrasNecessarias) === 1 ? 'foto extra vendida' : 'fotos extras vendidas'}
                        </p>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveTab('details')}
                      className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors group pt-1"
                    >
                      <span>Ver detalhes do pagamento</span>
                      <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                    </button>
                  </div>

                  {/* Alerta de Fotos Extras */}
                  {extrasNecessarias > 0 && (
                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>O cliente selecionou {extrasNecessarias} {extrasNecessarias === 1 ? 'foto extra' : 'fotos extras'}.</span>
                    </div>
                  )}

                  {/* Confirmação do Cliente */}
                  {supabaseGallery.statusSelecao === 'selecao_completa' && (
                    <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 pt-1">
                      <Check className="h-3.5 w-3.5" />
                      <span>Seleção confirmada pelo cliente</span>
                    </div>
                  )}
                </div>

                {/* Card de Status de Pagamento (quando pendente / PIX aguardando) */}
                {(calculatedExtraTotal > 0 || supabaseGallery.statusPagamento === 'aguardando_confirmacao') && (
                  <PaymentStatusCard
                    status={cobrancaData?.status || (calculatedExtraTotal > 0 ? 'pendente' : supabaseGallery.statusPagamento)}
                    provedor={cobrancaData?.provedor || (supabaseGallery.statusPagamento === 'aguardando_confirmacao' ? 'pix_manual' : undefined)}
                    valor={calculatedExtraTotal}
                    valorPago={0}
                    dataPagamento={cobrancaData?.data_pagamento}
                    receiptUrl={cobrancaData?.status === 'pago' || cobrancaData?.status === 'pago_manual' ? cobrancaData?.ip_receipt_url : undefined}
                    checkoutUrl={cobrancaData?.ip_checkout_url}
                    sessionId={supabaseGallery.sessionId || undefined}
                    cobrancaId={cobrancaData?.id}
                    galleryId={supabaseGallery.id}
                    extraCount={extrasACobrar}
                    saldoPendente={calculatedExtraTotal}
                    variant="compact"
                    onStatusUpdated={() => {
                      queryClient.invalidateQueries({ queryKey: ['galleries'] });
                      queryClient.invalidateQueries({ queryKey: ['galerias'] });
                      queryClient.invalidateQueries({ queryKey: ['galeria-cobrancas-pagas'] });
                      queryClient.invalidateQueries({ queryKey: ['galeria-cobranca-pendente'] });
                      refetchCobrancas();
                      refetchCobranca();
                    }}
                  />
                )}
              </div>

              {/* COLUNA DIREITA: Código das fotos selecionadas */}
              <div className="space-y-4">
                <div className="lunari-card p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold tracking-tight text-foreground">
                      Código das fotos selecionadas
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsCodesCollapsed(!isCodesCollapsed)}
                      className="h-7 text-xs px-2.5 gap-1 text-muted-foreground hover:text-foreground border-border/60"
                    >
                      <span>{isCodesCollapsed ? 'Expandir' : 'Recolher'}</span>
                      {isCodesCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                    </Button>
                  </div>

                  {!isCodesCollapsed && (
                    selectedPhotos.length > 0 ? (
                      <div className="space-y-4 animate-fade-in">
                        {/* Seletor de Tipo/Formato de Código e Filtro de Favoritas */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-xs text-muted-foreground font-medium shrink-0">Formato:</span>
                            <Select value={codeFormat} onValueChange={(v) => setCodeFormat(v as CodeFormat)}>
                              <SelectTrigger className="h-8 text-xs bg-muted/30 border-border/60 w-full sm:w-[190px]">
                                <SelectValue placeholder="Selecione o formato" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="windows" className="text-xs">{codeFormatLabels.windows}</SelectItem>
                                <SelectItem value="lightroom" className="text-xs">{codeFormatLabels.lightroom}</SelectItem>
                                <SelectItem value="mac" className="text-xs">{codeFormatLabels.mac}</SelectItem>
                                <SelectItem value="txt" className="text-xs">{codeFormatLabels.txt}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Alternador Todas vs Favoritas */}
                          {favoritePhotos.length > 0 && (
                            <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border border-border/50 shrink-0">
                              <button
                                type="button"
                                onClick={() => setCodeScopeFilter('all')}
                                className={cn(
                                  'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                                  codeScopeFilter === 'all'
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                )}
                              >
                                Todas ({selectedPhotos.length})
                              </button>
                              <button
                                type="button"
                                onClick={() => setCodeScopeFilter('favorites')}
                                className={cn(
                                  'px-2.5 py-1 rounded-md text-xs font-medium transition-colors inline-flex items-center gap-1',
                                  codeScopeFilter === 'favorites'
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                )}
                              >
                                <Heart className="h-3 w-3 text-red-500 fill-current" />
                                Favoritas ({favoritePhotos.length})
                              </button>
                            </div>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {codeFormatDescriptions[codeFormat]}
                        </p>

                        {/* Bloco de Código Mono */}
                        <div className="p-4 rounded-xl bg-muted/40 border border-border/60 font-mono text-xs text-foreground/90 max-h-56 overflow-y-auto leading-relaxed select-all">
                          {generatedCode || 'Nenhuma foto encontrada para este filtro.'}
                        </div>

                        {/* Botão Copiar */}
                        <Button
                          variant="terracotta"
                          className="w-auto px-5 font-medium gap-2 shadow-sm"
                          disabled={!generatedCode}
                          onClick={() => handleCopyCode(generatedCode)}
                        >
                          {isCodeCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          {isCodeCopied ? 'Código copiado!' : `Copiar código (${codeFormatLabels[codeFormat]})`}
                        </Button>

                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {codeFormatHints[codeFormat]}
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground text-xs">
                        Nenhuma foto selecionada ainda. Os códigos de pesquisa aparecerão aqui assim que houver fotos selecionadas.
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Visitors Tab - Public galleries only */}
        {isPublicGallery && (
          <TabsContent value="visitors" className="space-y-4">
            {isLoadingVisitors ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !visitorsData?.visitors?.length ? (
              <div className="text-center py-16 lunari-card">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum visitante acessou esta galeria ainda</p>
              </div>
            ) : (
              <div className="space-y-3">
                {visitorsData.visitors.map((visitor: any) => {
                  const isExpanded = expandedVisitorId === visitor.id;
                  const statusLabel = visitor.status === 'finalizado' ? 'Finalizado' : 'Em andamento';
                  const statusColor = visitor.status === 'finalizado' ? 'text-primary' : 'text-muted-foreground';
                  const paymentLabel = visitor.status_pagamento === 'pago' || visitor.status_pagamento === 'pago_manual'
                    ? 'Pago' : visitor.status_pagamento === 'pendente' ? 'Pendente' : '—';
                  const paymentColor = paymentLabel === 'Pago' ? 'text-primary' : paymentLabel === 'Pendente' ? 'text-amber-600' : 'text-muted-foreground';

                  return (
                    <div key={visitor.id} className="lunari-card overflow-hidden">
                      <button
                        onClick={() => {
                          const newId = isExpanded ? null : visitor.id;
                          setExpandedVisitorId(newId);
                          if (newId && (visitor.fotos_selecionadas || 0) > 0) {
                            fetchVisitorPhotos(newId);
                          }
                        }}
                        className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div className="text-left min-w-0">
                            <p className="font-medium text-sm truncate">{visitor.nome}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              {visitor.contato_tipo === 'whatsapp' ? <Phone className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
                              {visitor.contato}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div className="text-right hidden sm:block">
                            <p className="text-sm font-medium">{visitor.fotos_selecionadas || 0} fotos</p>
                            <p className={cn("text-xs", statusColor)}>{statusLabel}</p>
                          </div>
                          <span className={cn("text-xs font-medium hidden sm:block", paymentColor)}>{paymentLabel}</span>
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </button>

                      {/* Mobile stats */}
                      <div className="sm:hidden px-4 pb-2 flex items-center gap-3 text-xs">
                        <span className="font-medium">{visitor.fotos_selecionadas || 0} fotos</span>
                        <span className={statusColor}>{statusLabel}</span>
                        <span className={paymentColor}>{paymentLabel}</span>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-border p-4 space-y-3 bg-muted/30">
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-muted-foreground">Acesso em</span>
                              <p className="font-medium">{format(new Date(visitor.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Status</span>
                              <p className={cn("font-medium", statusColor)}>{statusLabel}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Fotos selecionadas</span>
                              <p className="font-medium">{visitor.fotos_selecionadas || 0}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Pagamento</span>
                              <p className={cn("font-medium", paymentColor)}>{paymentLabel}</p>
                            </div>
                          </div>
                          {visitor.finalized_at && (
                            <p className="text-xs text-muted-foreground">
                              Finalizado em {format(new Date(visitor.finalized_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </p>
                          )}

                          {/* Botão de códigos de seleção */}
                          {(visitor.fotos_selecionadas || 0) > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full gap-2"
                              disabled={loadingVisitorPhotos === visitor.id}
                              onClick={() => {
                                if (!visitorPhotosMap[visitor.id]) {
                                  fetchVisitorPhotos(visitor.id).then(() => setVisitorCodesModalId(visitor.id));
                                } else {
                                  setVisitorCodesModalId(visitor.id);
                                }
                              }}
                            >
                              {loadingVisitorPhotos === visitor.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <FileText className="h-4 w-4" />
                              )}
                              Copiar códigos de seleção
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        )}

        <TabsContent value="details">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="lunari-card p-5 space-y-4">
              <h3 className="font-medium">Informações do Cliente</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Nome</span>
                  {effectiveClienteId ? (
                    <Link
                      to={`/app/clientes/${effectiveClienteId}`}
                      className="font-medium text-primary hover:underline inline-flex items-center gap-1.5 group"
                      title="Ver perfil do cliente no CRM"
                    >
                      <span>{supabaseGallery.clienteNome || 'N/A'}</span>
                      <ExternalLink className="h-3.5 w-3.5 opacity-70 group-hover:opacity-100" />
                    </Link>
                  ) : (
                    <span className="font-medium">{supabaseGallery.clienteNome || 'N/A'}</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium">{supabaseGallery.clienteEmail || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sessão</span>
                  <span className="font-medium">{supabaseGallery.nomeSessao || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pacote</span>
                  <span className="font-medium">{supabaseGallery.nomePacote || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fotos incluídas</span>
                  <span className="font-medium">{supabaseGallery.fotosIncluidas}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor foto extra</span>
                  <span className="font-medium">R$ {valorUnitario.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="lunari-card p-5 space-y-4">
              <h3 className="font-medium">Configurações da Galeria</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Prazo</span>
                  <span className="font-medium">
                    {format(deadline, "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Permissão</span>
                  <span className="font-medium capitalize">
                    {supabaseGallery.permissao === 'public' ? 'Pública' : 'Privada'}
                  </span>
                </div>
                {(() => {
                  const billing = getBillingModeLabel({
                    vendaModo: (supabaseGallery as any).vendaModo,
                    vendaPagamentoProvedor: (supabaseGallery as any).vendaPagamentoProvedor,
                    saleSettings: supabaseGallery.configuracoes?.saleSettings as { mode?: string; paymentMethod?: string } | undefined,
                  });
                  return (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Modo de cobrança</span>
                      <span className={cn(
                        "font-medium",
                        billing.missingProvider ? "text-amber-500" : "text-foreground"
                      )}>
                        {billing.label}
                      </span>
                    </div>
                  );
                })()}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Comentários</span>
                  <span className="font-medium">
                    {supabaseGallery.configuracoes?.allowComments ? 'Sim' : 'Não'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Download</span>
                  <span className="font-medium">
                    {supabaseGallery.configuracoes?.allowDownload ? 'Ativado' : 'Desativado'}
                  </span>
                </div>
              </div>
            </div>




            {/* Payment History Card - shows all transactions */}
            {cobrancasPagas.length > 0 && (
              <PaymentHistoryCard
                cobrancas={cobrancasPagas}
                valorTotalPago={supabaseGallery.valorTotalVendido || 0}
                totalFotosExtrasVendidas={supabaseGallery.totalFotosExtrasVendidas || 0}
              />
            )}

            {/* Current Payment Status - for pending payments and actions */}
            {((calculatedExtraTotal > 0 && cobrancaData && !['pago', 'pago_manual', 'cancelado'].includes(cobrancaData.status)) || supabaseGallery.statusPagamento === 'aguardando_confirmacao') && (
              <PaymentStatusCard
                status={cobrancaData.status}
                provedor={cobrancaData?.provedor || (supabaseGallery.statusPagamento === 'aguardando_confirmacao' ? 'pix_manual' : undefined)}
                valor={Number(cobrancaData.valor) || 0}
                dataPagamento={cobrancaData?.data_pagamento}
                receiptUrl={cobrancaData?.ip_receipt_url}
                checkoutUrl={cobrancaData?.ip_checkout_url}
                sessionId={supabaseGallery.sessionId || undefined}
                cobrancaId={cobrancaData?.id}
                galleryId={supabaseGallery.id}
                extraCount={extrasACobrar}
                variant="full"
                showPendingAmount={true}
                onStatusUpdated={() => {
                  queryClient.invalidateQueries({ queryKey: ['galleries'] });
                  queryClient.invalidateQueries({ queryKey: ['galerias'] });
                  queryClient.invalidateQueries({ queryKey: ['galeria-cobrancas-pagas'] });
                  queryClient.invalidateQueries({ queryKey: ['galeria-cobranca-pendente'] });
                  refetchCobrancas();
                  refetchCobranca();
                }}
              />
            )}

            {supabaseGallery.mensagemBoasVindas && (
              <div className="lunari-card p-5 space-y-4 md:col-span-2">
                <h3 className="font-medium">Mensagem de Boas-vindas</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {supabaseGallery.mensagemBoasVindas}
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="history">
          <div className="lunari-card p-5">
            <h3 className="font-medium mb-4">Histórico de Ações</h3>
            <ActionTimeline actions={actions} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Lightbox */}
      {lightboxState !== null && (
        <Lightbox
          photos={
            lightboxState.source === 'selection'
              ? selectedPhotos
              : lightboxState.source === 'filtered'
                ? currentPhotosList
                : transformedPhotos
          }
          currentIndex={lightboxState.index}
          allowComments={supabaseGallery.configuracoes?.allowComments ?? true}
          disabled
          onClose={() => setLightboxState(null)}
          onNavigate={(idx) => setLightboxState((prev) => prev ? { ...prev, index: idx } : prev)}
          onSelect={() => {}}
        />
      )}

      {/* Photo Codes Modal */}
      <PhotoCodesModal
        open={isCodesModalOpen}
        onOpenChange={setIsCodesModalOpen}
        photos={transformedPhotos}
        clientName={supabaseGallery.clienteNome || 'Cliente'}
        filter={codesFilter}
        folders={galleryFolders}
      />

      {/* Visitor Photo Codes Modal */}
      {visitorCodesModalId && visitorPhotosMap[visitorCodesModalId] && (
        <PhotoCodesModal
          open={!!visitorCodesModalId}
          onOpenChange={(open) => { if (!open) setVisitorCodesModalId(null); }}
          photos={visitorPhotosMap[visitorCodesModalId]}
          clientName={visitorsData?.visitors?.find((v: any) => v.id === visitorCodesModalId)?.nome || 'Visitante'}
        />
      )}

      {/* Send Gallery Modal */}
      <SendGalleryModal
        isOpen={isSendModalOpen}
        onOpenChange={setIsSendModalOpen}
        gallery={supabaseGallery}
        settings={settings}
        onSendGallery={handleSendGallery}
      />

      {/* Reactivate Gallery Dialog (always mounted to survive status changes) */}
      <ReactivateGalleryDialog
        open={reactivateOpen}
        onOpenChange={setReactivateOpen}
        galleryName={supabaseGallery.nomeSessao || 'Esta galeria'}
        onReactivate={handleReopenSelection}
        onSuccess={(days) => {
          setReactivateDays(days);
          setReactivateSuccessOpen(true);
        }}
      />

      {/* Reactivate Success / Share Modal (separate Dialog instance) */}
      {settings && (
        <ReactivateSuccessModal
          isOpen={reactivateSuccessOpen}
          onOpenChange={setReactivateSuccessOpen}
          gallery={supabaseGallery}
          settings={settings}
          clientLink={clientLink}
          newDeadline={(() => {
            const d = new Date();
            d.setDate(d.getDate() + reactivateDays);
            return d;
          })()}
          daysGranted={reactivateDays}
        />
      )}
    </div>
  );
}

