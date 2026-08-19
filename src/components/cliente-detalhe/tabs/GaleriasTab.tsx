import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ClienteSupabase } from '@/types/cliente-supabase';
import { GalleryCard } from '@/components/GalleryCard';
import { DeliverGalleryCard } from '@/components/DeliverGalleryCard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Image as ImageIcon, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  Copy, 
  Check, 
  DollarSign, 
  MousePointerClick, 
  Send,
  Loader2,
  Trash2,
  Eye,
  Layers
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseGalleries, Galeria } from '@/hooks/useSupabaseGalleries';
import { useSettings } from '@/hooks/useSettings';
import { getEffectiveGalleryStatus } from '@/lib/galleryStatus';
import { getDisplayUrl } from '@/lib/photoUrl';
import { getGalleryUrl } from '@/lib/galleryUrl';
import { formatCurrency } from '@/utils/financialUtils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
import { SendGalleryModal } from '@/components/SendGalleryModal';
import { ReactivateGalleryDialog } from '@/components/ReactivateGalleryDialog';
import { ReactivateSuccessModal } from '@/components/ReactivateSuccessModal';
import { Gallery } from '@/types/gallery';
import { cn } from '@/lib/utils';

interface GaleriasTabProps {
  cliente: ClienteSupabase;
}

function transformSupabaseToLocal(galeria: Galeria): Gallery & { 
  tipo: 'selecao' | 'entrega'; 
  totalFotos: number; 
  firstPhotoKey: string | null; 
  coverPhotoKey: string | null;
  publicToken: string | null;
  statusPagamento: string | null;
  statusSelecao: string;
  valorExtras: number;
  valorTotalVendido: number;
  totalFotosExtrasVendidas: number;
} {
  const status = getEffectiveGalleryStatus(
    galeria.status,
    galeria.statusPagamento,
    galeria.finalizedAt,
    galeria.statusSelecao,
    galeria.prazoSelecao,
    galeria.tipo
  );
  
  const deadline = galeria.prazoSelecao || galeria.createdAt;
  
  return {
    id: galeria.id,
    clientName: galeria.clienteNome || 'Cliente',
    clientEmail: galeria.clienteEmail || '',
    sessionName: galeria.nomeSessao || 'Sessão',
    packageName: galeria.nomePacote || '',
    includedPhotos: Number(galeria.fotosIncluidas) || 0,
    extraPhotoPrice: Number(galeria.valorFotoExtra) || 0,
    saleSettings: {
      mode: 'sale_without_payment',
      pricingModel: 'fixed',
      chargeType: 'only_extras',
      fixedPrice: Number(galeria.valorFotoExtra) || 0,
      discountPackages: [],
    },
    status,
    selectionStatus: galeria.statusSelecao === 'selecao_completa' ? 'confirmed' : 'in_progress',
    settings: {
      welcomeMessage: galeria.mensagemBoasVindas || '',
      deadline,
      deadlinePreset: 'custom',
      watermark: galeria.configuracoes?.watermark || { type: 'standard', opacity: 40, position: 'center' },
      watermarkDisplay: galeria.configuracoes?.watermarkDisplay || 'all',
      imageResizeOption: galeria.configuracoes?.imageResizeOption || 1920,
      allowComments: galeria.configuracoes?.allowComments ?? true,
      allowDownload: galeria.configuracoes?.allowDownload ?? false,
      allowExtraPhotos: galeria.configuracoes?.allowExtraPhotos ?? true,
    },
    photos: [],
    actions: [],
    createdAt: galeria.createdAt,
    updatedAt: galeria.updatedAt,
    selectedCount: Number(galeria.fotosSelecionadas) || 0,
    extraCount: Math.max(0, (Number(galeria.fotosSelecionadas) || 0) - (Number(galeria.fotosIncluidas) || 0)),
    extraTotal: Number(galeria.valorExtras) || 0,
    tipo: galeria.tipo,
    totalFotos: Number(galeria.totalFotos) || 0,
    firstPhotoKey: galeria.firstPhotoKey,
    coverPhotoKey: galeria.coverPhotoKey,
    publicToken: galeria.publicToken,
    statusPagamento: galeria.statusPagamento,
    statusSelecao: galeria.statusSelecao || 'em_andamento',
    valorExtras: Number(galeria.valorExtras) || 0,
    valorTotalVendido: Number(galeria.valorTotalVendido) || 0,
    totalFotosExtrasVendidas: Number(galeria.totalFotosExtrasVendidas) || 0,
  };
}

export function GaleriasTab({ cliente }: GaleriasTabProps) {
  const [galeriasRaw, setGaleriasRaw] = useState<Galeria[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTabFilter, setActiveTabFilter] = useState<'all' | 'select' | 'deliver'>('all');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const navigate = useNavigate();
  const { settings } = useSettings();
  const { deleteGallery, sendGallery, reopenSelection } = useSupabaseGalleries() as any;

  // Modais de ação
  const [shareGalleryId, setShareGalleryId] = useState<string | null>(null);
  const [deleteGalleryId, setDeleteGalleryId] = useState<string | null>(null);
  const [reactivateGalleryId, setReactivateGalleryId] = useState<string | null>(null);
  const [reactivateSuccessOpen, setReactivateSuccessOpen] = useState(false);
  const [reactivateSuccessGallery, setReactivateSuccessGallery] = useState<Galeria | null>(null);
  const [reactivateDays, setReactivateDays] = useState(7);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchGalerias = async () => {
    try {
      setIsLoading(true);

      // 1. Buscar sessões do cliente para fallback de session_id
      const { data: sessoes } = await supabase
        .from('clientes_sessoes')
        .select('id, session_id')
        .eq('cliente_id', cliente.id);

      const sessionIds = (sessoes || [])
        .flatMap(s => [s.id, s.session_id])
        .filter(Boolean);

      // 2. Buscar galerias vinculadas por cliente_id ou session_id
      let query = supabase
        .from('galerias')
        .select('*');

      if (sessionIds.length > 0) {
        query = query.or(`cliente_id.eq.${cliente.id},session_id.in.(${sessionIds.join(',')})`);
      } else {
        query = query.eq('cliente_id', cliente.id);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const parsed: Galeria[] = data.map((row: any) => ({
          id: row.id,
          userId: row.user_id,
          clienteId: row.cliente_id,
          status: row.status,
          statusPagamento: row.status_pagamento,
          fotosIncluidas: row.fotos_incluidas || 0,
          valorFotoExtra: Number(row.valor_foto_extra) || 0,
          regrasSelecao: row.regras_selecao,
          prazoSelecaoDias: row.prazo_selecao_dias,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at),
          publishedAt: row.published_at ? new Date(row.published_at) : null,
          finalizedAt: row.finalized_at ? new Date(row.finalized_at) : null,
          sessionId: row.session_id,
          orcamentoId: row.orcamento_id,
          permissao: row.permissao || 'private',
          nomeSessao: row.nome_sessao,
          nomePacote: row.nome_pacote,
          mensagemBoasVindas: row.mensagem_boas_vindas,
          configuracoes: row.configuracoes || {},
          totalFotos: row.total_fotos || 0,
          fotosSelecionadas: row.fotos_selecionadas || 0,
          valorExtras: Number(row.valor_extras) || 0,
          valorTotalVendido: Number(row.valor_total_vendido) || 0,
          totalFotosExtrasVendidas: Number(row.total_fotos_extras_vendidas) || 0,
          statusSelecao: row.status_selecao || 'em_andamento',
          prazoSelecao: row.prazo_selecao ? new Date(row.prazo_selecao) : null,
          enviadoEm: row.enviado_em ? new Date(row.enviado_em) : null,
          clienteNome: row.cliente_nome,
          clienteEmail: row.cliente_email,
          clienteTelefone: row.cliente_telefone || null,
          publicToken: row.public_token || null,
          galleryPassword: row.gallery_password || null,
          regrasCongeladas: row.regras_congeladas,
          regrasOverride: row.regras_override ?? false,
          tipo: row.tipo === 'entrega' ? 'entrega' : 'selecao',
          firstPhotoKey: row.first_photo_storage_key || null,
          coverPhotoKey: row.cover_storage_key || null,
          themeId: row.theme_id,
          useCustomTheme: row.use_custom_theme ?? false,
          themeOverrides: row.theme_overrides ?? {},
          coverId: row.cover_id ?? null,
          expiresAt: row.expires_at ? new Date(row.expires_at) : null,
          vendaModo: row.venda_modo ?? null,
          vendaPagamentoProvedor: row.venda_pagamento_provedor ?? null,
          vendaTipoCobranca: row.venda_tipo_cobranca ?? null,
        }));

        setGaleriasRaw(parsed);
      }
    } catch (error) {
      console.error('Erro ao buscar galerias do cliente:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGalerias();

    // Realtime subscription para galerias do cliente
    const channel = supabase
      .channel(`client-galleries-tab-${cliente.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'galerias',
          filter: `cliente_id=eq.${cliente.id}`,
        },
        () => {
          fetchGalerias();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cliente.id]);

  const galeriasLocal = useMemo(() => {
    return galeriasRaw.map(transformSupabaseToLocal);
  }, [galeriasRaw]);

  // Cálculos consolidados para o mini-dashboard de resumo de seleção
  const resumo = useMemo(() => {
    const totalGalerias = galeriasLocal.length;
    const selecaoGalleries = galeriasLocal.filter(g => g.tipo !== 'entrega');
    const transferGalleries = galeriasLocal.filter(g => g.tipo === 'entrega');

    const totalFotosEnviadas = galeriasLocal.reduce((sum, g) => sum + (g.totalFotos || 0), 0);
    const totalFotosSelecionadas = selecaoGalleries.reduce((sum, g) => sum + (g.selectedCount || 0), 0);
    const totalFotosIncluidas = selecaoGalleries.reduce((sum, g) => sum + (g.includedPhotos || 0), 0);

    const totalFotosExtras = selecaoGalleries.reduce((sum, g) => {
      if (g.totalFotosExtrasVendidas > 0) return sum + g.totalFotosExtrasVendidas;
      return sum + Math.max(0, g.selectedCount - g.includedPhotos);
    }, 0);

    const faturamentoExtrasTotal = selecaoGalleries.reduce((sum, g) => {
      const vendido = g.valorTotalVendido || 0;
      return sum + (vendido > 0 ? vendido : g.valorExtras || 0);
    }, 0);

    const faturamentoPago = selecaoGalleries.reduce((sum, g) => {
      if (g.statusPagamento === 'pago') {
        return sum + (g.valorTotalVendido || g.valorExtras || 0);
      }
      return sum;
    }, 0);

    const faturamentoPendente = Math.max(0, faturamentoExtrasTotal - faturamentoPago);

    return {
      totalGalerias,
      totalSelecao: selecaoGalleries.length,
      totalTransfer: transferGalleries.length,
      totalFotosEnviadas,
      totalFotosSelecionadas,
      totalFotosIncluidas,
      totalFotosExtras,
      faturamentoExtrasTotal,
      faturamentoPago,
      faturamentoPendente,
    };
  }, [galeriasLocal]);

  // Galerias filtradas pela aba ativa
  const filteredGalleries = useMemo(() => {
    if (activeTabFilter === 'select') {
      return galeriasLocal.filter(g => g.tipo !== 'entrega');
    }
    if (activeTabFilter === 'deliver') {
      return galeriasLocal.filter(g => g.tipo === 'entrega');
    }
    return galeriasLocal;
  }, [galeriasLocal, activeTabFilter]);

  const shareGaleria = useMemo(() => {
    return galeriasRaw.find(g => g.id === shareGalleryId) || null;
  }, [galeriasRaw, shareGalleryId]);

  const deleteTarget = galeriasLocal.find(g => g.id === deleteGalleryId);

  const handleDeleteConfirm = async () => {
    if (!deleteGalleryId) return;
    setIsDeleting(true);
    try {
      await deleteGallery(deleteGalleryId);
      setDeleteGalleryId(null);
      await fetchGalerias();
      toast.success('Galeria excluída com sucesso');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao excluir galeria');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyPublicLink = (publicToken: string | null) => {
    if (!publicToken) {
      toast.error('Galeria não possui link público ativo');
      return;
    }
    const url = getGalleryUrl(publicToken);
    navigator.clipboard.writeText(url);
    setCopiedToken(publicToken);
    toast.success('Link da galeria copiado!');
    setTimeout(() => setCopiedToken(null), 2500);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-accent-gold" />
        Carregando galerias do cliente...
      </div>
    );
  }

  if (galeriasLocal.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/40 p-12 text-center mt-4">
        <ImageIcon className="mb-3 h-8 w-8 text-muted-foreground/60" />
        <h3 className="text-sm font-medium text-foreground">Nenhuma galeria vinculada</h3>
        <p className="mt-1 mb-4 text-xs text-muted-foreground">
          Este cliente ainda não possui nenhuma galeria de Seleção ou Transfer vinculada a ele.
        </p>
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Criar Galeria
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2 rounded-xl shadow-lg border border-border/60" align="center" sideOffset={8}>
            <div className="space-y-1">
              <button
                onClick={() => navigate('/app/gallery/new/select', { state: { preselectClient: cliente.id } })}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-[#ddd1b6]/20 transition-colors text-left"
              >
                <div className="p-1.5 rounded-md bg-[#ddd1b6]/40 dark:bg-[#ddd1b6]/15">
                  <MousePointerClick className="h-4 w-4 text-[#cbb384] shrink-0" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-xs">Seleção</p>
                  <p className="text-[10px] text-muted-foreground">Cliente escolhe as fotos</p>
                </div>
              </button>
              <button
                onClick={() => navigate('/app/gallery/new/transfer', { state: { preselectClient: cliente.id } })}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-[#ddd1b6]/20 transition-colors text-left"
              >
                <div className="p-1.5 rounded-md bg-[#ddd1b6]/40 dark:bg-[#ddd1b6]/15">
                  <Send className="h-4 w-4 text-[#cbb384] shrink-0" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-xs">Transfer</p>
                  <p className="text-[10px] text-muted-foreground">Entrega final de fotos</p>
                </div>
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-4">
      {/* 1. MINI-DASHBOARD ANALÍTICO DE SELEÇÕES E FOTOS EXTRAS */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3.5 rounded-xl border-border/20 bg-card shadow-none">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Total de Galerias</span>
            <Layers className="h-4 w-4 text-accent-gold" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight text-foreground">
            {resumo.totalGalerias}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {resumo.totalSelecao} seleção · {resumo.totalTransfer} transfer
          </p>
        </Card>

        <Card className="p-3.5 rounded-xl border-border/20 bg-card shadow-none">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Fotos Selecionadas</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight text-foreground">
            {resumo.totalFotosSelecionadas}{' '}
            <span className="text-xs font-normal text-muted-foreground">
              / {resumo.totalFotosIncluidas} no pacote
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            de {resumo.totalFotosEnviadas} fotos enviadas
          </p>
        </Card>

        <Card className="p-3.5 rounded-xl border-border/20 bg-card shadow-none">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Fotos Extras</span>
            <Sparkles className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight text-amber-500">
            +{resumo.totalFotosExtras} fotos
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            selecionadas além do pacote
          </p>
        </Card>

        <Card className="p-3.5 rounded-xl border-border/20 bg-card shadow-none">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Faturamento Extras</span>
            <DollarSign className="h-4 w-4 text-accent-gold" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight text-foreground">
            {formatCurrency(resumo.faturamentoExtrasTotal)}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {resumo.faturamentoPendente > 0 ? (
              <span className="text-amber-500 font-medium">
                Pendente: {formatCurrency(resumo.faturamentoPendente)}
              </span>
            ) : (
              <span className="text-emerald-500 font-medium">100% quitado</span>
            )}
          </p>
        </Card>
      </div>

      {/* 2. TABELA / LISTA DETALHADA DAS SELEÇÕES RESUMIDAMENTE */}
      {galeriasLocal.filter(g => g.tipo !== 'entrega').length > 0 && (
        <div className="rounded-xl border border-border/30 bg-card overflow-hidden">
          <div className="p-3.5 border-b border-border/30 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <MousePointerClick className="h-3.5 w-3.5 text-accent-gold" />
                Detalhamento das Seleções do Cliente
              </h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Acompanhamento individual de escolhas, extras e pagamento por galeria
              </p>
            </div>
          </div>

          <div className="divide-y divide-border/20 overflow-x-auto">
            {galeriasLocal
              .filter(g => g.tipo !== 'entrega')
              .map(gallery => {
                const isConfirmed = gallery.statusSelecao === 'selecao_completa' || gallery.status === 'selection_completed';
                const hasExtras = gallery.extraCount > 0;
                const isPaid = gallery.statusPagamento === 'pago';

                return (
                  <div
                    key={gallery.id}
                    className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground truncate">
                          {gallery.sessionName}
                        </span>
                        {gallery.packageName && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-muted/40">
                            {gallery.packageName}
                          </Badge>
                        )}
                        <Badge
                          className={cn(
                            'text-[10px] py-0 px-1.5',
                            isConfirmed
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                              : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20'
                          )}
                        >
                          {isConfirmed ? 'Seleção Confirmada' : 'Em Seleção'}
                        </Badge>
                        {isPaid && (
                          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] py-0 px-1.5">
                            Pago
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5 flex-wrap">
                        <span>
                          <strong>{gallery.selectedCount}</strong> selecionadas de <strong>{gallery.includedPhotos}</strong> inclusas
                        </span>
                        {hasExtras && (
                          <span className="text-amber-500 font-medium">
                            +{gallery.extraCount} extras ({formatCurrency(gallery.valorTotalVendido || gallery.valorExtras)})
                          </span>
                        )}
                        {gallery.settings.deadline && (
                          <span className="flex items-center gap-1 text-muted-foreground/80">
                            <Clock className="h-3 w-3" />
                            Prazo: {format(new Date(gallery.settings.deadline), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {gallery.publicToken && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopyPublicLink(gallery.publicToken)}
                          className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                          title="Copiar link da galeria do cliente"
                        >
                          {copiedToken === gallery.publicToken ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-500" />
                              Copiado
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              Link
                            </>
                          )}
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/app/gallery/select/${gallery.id}`)}
                        className="h-8 text-xs gap-1"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        Ver Detalhes
                      </Button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* 3. LISTAGEM DE CARDS DE GALERIAS COM FILTROS */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Todas as Galerias</h3>
            <div className="inline-flex border border-border/50 rounded-lg overflow-hidden bg-background/60 text-xs">
              <button
                onClick={() => setActiveTabFilter('all')}
                className={cn(
                  'px-2.5 py-1 font-medium transition-colors',
                  activeTabFilter === 'all' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/40'
                )}
              >
                Todas ({galeriasLocal.length})
              </button>
              <button
                onClick={() => setActiveTabFilter('select')}
                className={cn(
                  'px-2.5 py-1 font-medium transition-colors border-l border-border/40',
                  activeTabFilter === 'select' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/40'
                )}
              >
                Seleção ({resumo.totalSelecao})
              </button>
              <button
                onClick={() => setActiveTabFilter('deliver')}
                className={cn(
                  'px-2.5 py-1 font-medium transition-colors border-l border-border/40',
                  activeTabFilter === 'deliver' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/40'
                )}
              >
                Transfer ({resumo.totalTransfer})
              </button>
            </div>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" className="h-8 text-xs gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Nova Galeria
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2 rounded-xl shadow-lg border border-border/60" align="end" sideOffset={8}>
              <div className="space-y-1">
                <button
                  onClick={() => navigate('/app/gallery/new/select', { state: { preselectClient: cliente.id } })}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-[#ddd1b6]/20 transition-colors text-left"
                >
                  <div className="p-1.5 rounded-md bg-[#ddd1b6]/40 dark:bg-[#ddd1b6]/15">
                    <MousePointerClick className="h-4 w-4 text-[#cbb384] shrink-0" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-xs">Seleção</p>
                    <p className="text-[10px] text-muted-foreground">Cliente escolhe as fotos</p>
                  </div>
                </button>
                <button
                  onClick={() => navigate('/app/gallery/new/transfer', { state: { preselectClient: cliente.id } })}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-[#ddd1b6]/20 transition-colors text-left"
                >
                  <div className="p-1.5 rounded-md bg-[#ddd1b6]/40 dark:bg-[#ddd1b6]/15">
                    <Send className="h-4 w-4 text-[#cbb384] shrink-0" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-xs">Transfer</p>
                    <p className="text-[10px] text-muted-foreground">Entrega final de fotos</p>
                  </div>
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredGalleries.map((gallery) => {
            const rawGaleria = galeriasRaw.find(g => g.id === gallery.id);
            const canReactivate = ['selection_completed', 'expired'].includes(gallery.status) || gallery.selectionStatus === 'blocked' || rawGaleria?.statusSelecao === 'aguardando_pagamento';

            const coverUrl = gallery.firstPhotoKey
              ? getDisplayUrl(gallery.firstPhotoKey)
              : gallery.coverPhotoKey
              ? getDisplayUrl(gallery.coverPhotoKey)
              : undefined;

            if (gallery.tipo === 'entrega') {
              return (
                <DeliverGalleryCard
                  key={gallery.id}
                  gallery={gallery}
                  totalPhotos={gallery.totalFotos}
                  onClick={() => navigate(`/app/gallery/transfer/${gallery.id}`)}
                  onEdit={() => navigate(`/app/gallery/transfer/${gallery.id}/edit`)}
                  onShare={() => setShareGalleryId(gallery.id)}
                  onDelete={() => setDeleteGalleryId(gallery.id)}
                  onReactivate={gallery.status === 'expired' ? () => setReactivateGalleryId(gallery.id) : undefined}
                />
              );
            }

            return (
              <GalleryCard
                key={gallery.id}
                gallery={gallery}
                thumbnailUrl={coverUrl}
                paymentStatus={rawGaleria?.statusPagamento}
                onClick={() => navigate(`/app/gallery/select/${gallery.id}`)}
                onEdit={() => navigate(`/app/gallery/select/${gallery.id}/edit`)}
                onShare={() => setShareGalleryId(gallery.id)}
                onDelete={() => setDeleteGalleryId(gallery.id)}
                onReactivate={canReactivate ? () => setReactivateGalleryId(gallery.id) : undefined}
              />
            );
          })}
        </div>
      </div>

      {/* MODAL DE COMPARTILHAMENTO */}
      {shareGaleria && (
        <SendGalleryModal
          isOpen={!!shareGalleryId}
          onOpenChange={(open) => {
            if (!open) {
              setShareGalleryId(null);
              fetchGalerias();
            }
          }}
          gallery={shareGaleria}
          settings={settings}
          onSendGallery={async () => {
            await sendGallery(shareGaleria.id);
            await fetchGalerias();
          }}
        />
      )}

      {/* DIÁLOGO DE REATIVAÇÃO */}
      {reactivateGalleryId && (() => {
        const galeria = galeriasRaw.find(g => g.id === reactivateGalleryId);
        const isTransfer = galeria?.tipo === 'entrega';
        return (
          <ReactivateGalleryDialog
            galleryName={galeria?.nomeSessao || 'Esta galeria'}
            onReactivate={async (days) => {
              if (isTransfer) {
                const prazo = new Date();
                prazo.setDate(prazo.getDate() + days);
                await supabase.from('galerias').update({
                  status: 'enviado',
                  prazo_selecao: prazo.toISOString(),
                  updated_at: new Date().toISOString(),
                }).eq('id', reactivateGalleryId);
              } else {
                await reopenSelection({ id: reactivateGalleryId, days });
              }
              await fetchGalerias();
            }}
            open={true}
            onOpenChange={(open) => { if (!open) setReactivateGalleryId(null); }}
            onSuccess={(days) => {
              setReactivateDays(days);
              setReactivateSuccessGallery(galeria || null);
              setReactivateSuccessOpen(true);
            }}
          />
        );
      })()}

      {reactivateSuccessGallery && settings && (
        <ReactivateSuccessModal
          isOpen={reactivateSuccessOpen}
          onOpenChange={(open) => {
            setReactivateSuccessOpen(open);
            if (!open) setReactivateSuccessGallery(null);
          }}
          gallery={reactivateSuccessGallery}
          settings={settings}
          clientLink={reactivateSuccessGallery.publicToken ? getGalleryUrl(reactivateSuccessGallery.publicToken) : null}
          newDeadline={(() => {
            const d = new Date();
            d.setDate(d.getDate() + reactivateDays);
            return d;
          })()}
          daysGranted={reactivateDays}
        />
      )}

      {/* DIÁLOGO DE EXCLUSÃO */}
      <AlertDialog open={!!deleteGalleryId} onOpenChange={(open) => !open && setDeleteGalleryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir galeria?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>"{deleteTarget?.sessionName}"</strong>?
              <br /><br />
              <span className="text-destructive font-medium">
                Esta ação é irreversível. Todas as fotos e seleções serão removidas permanentemente.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteConfirm();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
