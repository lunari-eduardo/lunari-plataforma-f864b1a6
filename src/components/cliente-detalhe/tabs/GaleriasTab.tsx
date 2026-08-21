import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ClienteSupabase } from '@/types/cliente-supabase';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Image as ImageIcon, 
  Sparkles, 
  CheckCircle2, 
  Copy, 
  Check, 
  DollarSign, 
  MousePointerClick, 
  Send,
  Loader2,
  Trash2,
  Layers,
  ArrowUpRight,
  MoreHorizontal,
  Pencil,
  RotateCcw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseGalleries, Galeria } from '@/hooks/useSupabaseGalleries';
import { useSettings } from '@/hooks/useSettings';
import { getEffectiveGalleryStatus } from '@/lib/galleryStatus';
import { getDisplayUrl } from '@/lib/photoUrl';
import { getGalleryUrl } from '@/lib/galleryUrl';
import { formatCurrency } from '@/utils/financialUtils';
import { toast } from 'sonner';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { cn } from '@/lib/utils';

interface GaleriasTabProps {
  cliente: ClienteSupabase;
}

interface GaleriaItem {
  id: string;
  sessionName: string;
  packageName: string;
  tipo: 'selecao' | 'entrega';
  status: string;
  statusSelecao: string;
  statusPagamento: string | null;
  selectedCount: number;
  includedPhotos: number;
  extraCount: number;
  valorExtras: number;
  valorTotalVendido: number;
  publicToken: string | null;
  thumbnailUrl?: string;
  raw: Galeria;
}

export function GaleriasTab({ cliente }: GaleriasTabProps) {
  const [galeriasRaw, setGaleriasRaw] = useState<Galeria[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  // Lista formatada e limpa
  const items: GaleriaItem[] = useMemo(() => {
    return galeriasRaw.map(g => {
      const selected = Number(g.fotosSelecionadas) || 0;
      const included = Number(g.fotosIncluidas) || 0;
      const extraCount = Math.max(0, selected - included);
      const thumbnailKey = g.firstPhotoKey || g.coverPhotoKey;
      const thumbnailUrl = thumbnailKey ? getDisplayUrl(thumbnailKey) : undefined;
      const status = g.status === 'archived' 
        ? 'Excluída / Arquivada' 
        : getEffectiveGalleryStatus(
            g.status,
            g.statusPagamento,
            g.finalizedAt,
            g.statusSelecao,
            g.prazoSelecao,
            g.tipo
          );

      return {
        id: g.id,
        sessionName: g.nomeSessao || 'Sessão sem nome',
        packageName: g.nomePacote || '',
        tipo: g.tipo,
        status,
        statusSelecao: g.statusSelecao || 'em_andamento',
        statusPagamento: g.statusPagamento,
        selectedCount: selected,
        includedPhotos: included,
        extraCount,
        valorExtras: Number(g.valorExtras) || 0,
        valorTotalVendido: Number(g.valorTotalVendido) || 0,
        publicToken: g.publicToken,
        thumbnailUrl,
        raw: g,
      };
    });
  }, [galeriasRaw]);

  // Mini-KPIs consolidados
  const resumo = useMemo(() => {
    const totalGalerias = items.length;
    const selecaoItems = items.filter(g => g.tipo !== 'entrega');

    const totalFotosSelecionadas = selecaoItems.reduce((sum, g) => sum + g.selectedCount, 0);
    const totalFotosExtras = selecaoItems.reduce((sum, g) => {
      const vendidas = Number(g.raw.totalFotosExtrasVendidas) || 0;
      return sum + (vendidas > 0 ? vendidas : g.extraCount);
    }, 0);

    const faturamentoExtrasTotal = selecaoItems.reduce((sum, g) => {
      const vendido = g.valorTotalVendido || 0;
      return sum + (vendido > 0 ? vendido : g.valorExtras || 0);
    }, 0);

    return {
      totalGalerias,
      totalFotosSelecionadas,
      totalFotosExtras,
      faturamentoExtrasTotal,
    };
  }, [items]);

  const shareGaleria = useMemo(() => {
    return galeriasRaw.find(g => g.id === shareGalleryId) || null;
  }, [galeriasRaw, shareGalleryId]);

  const deleteTarget = items.find(g => g.id === deleteGalleryId);

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

  const handleCopyPublicLink = (e: React.MouseEvent, publicToken: string | null) => {
    e.stopPropagation();
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

  const handleOpenGallery = (item: GaleriaItem) => {
    if (item.raw.status === 'archived') {
      toast.info('Esta galeria foi excluída permanentemente após 180 dias e não pode mais ser acessada.');
      return;
    }
    const route = item.tipo === 'entrega'
      ? `/app/gallery/transfer/${item.id}`
      : `/app/gallery/select/${item.id}`;
    navigate(route);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-accent-gold" />
        Carregando galerias do cliente...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/40 p-12 text-center mt-4">
        <ImageIcon className="mb-3 h-8 w-8 text-muted-foreground/50" />
        <h3 className="text-sm font-medium text-foreground">Nenhuma galeria vinculada</h3>
        <p className="mt-1 mb-4 text-xs text-muted-foreground">
          Este cliente ainda não possui nenhuma galeria vinculada a ele.
        </p>
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Criar Galeria
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-2 rounded-xl shadow-lg border border-border/60" align="center" sideOffset={8}>
            <div className="space-y-1">
              <button
                onClick={() => navigate('/app/gallery/new/select', { state: { preselectClient: cliente.id } })}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-medium hover:bg-muted/60 transition-colors text-left"
              >
                <MousePointerClick className="h-3.5 w-3.5 text-accent-gold shrink-0" />
                <span>Galeria de Seleção</span>
              </button>
              <button
                onClick={() => navigate('/app/gallery/new/transfer', { state: { preselectClient: cliente.id } })}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-medium hover:bg-muted/60 transition-colors text-left"
              >
                <Send className="h-3.5 w-3.5 text-accent-gold shrink-0" />
                <span>Galeria de Transfer</span>
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      {/* 1. MINI KPIS DISCRETOS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 rounded-xl border-border/20 bg-card/60 shadow-none">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Galerias</span>
            <Layers className="h-3.5 w-3.5 text-muted-foreground/60" />
          </div>
          <div className="mt-1 text-lg font-semibold tracking-tight text-foreground">
            {resumo.totalGalerias}
          </div>
        </Card>

        <Card className="p-3 rounded-xl border-border/20 bg-card/60 shadow-none">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Fotos Selecionadas</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground/60" />
          </div>
          <div className="mt-1 text-lg font-semibold tracking-tight text-foreground">
            {resumo.totalFotosSelecionadas}
          </div>
        </Card>

        <Card className="p-3 rounded-xl border-border/20 bg-card/60 shadow-none">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Fotos Extras</span>
            <Sparkles className="h-3.5 w-3.5 text-accent-gold/70" />
          </div>
          <div className="mt-1 text-lg font-semibold tracking-tight text-foreground">
            +{resumo.totalFotosExtras}
          </div>
        </Card>

        <Card className="p-3 rounded-xl border-border/20 bg-card/60 shadow-none">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Faturamento Extras</span>
            <DollarSign className="h-3.5 w-3.5 text-accent-gold/70" />
          </div>
          <div className="mt-1 text-lg font-semibold tracking-tight text-foreground">
            {formatCurrency(resumo.faturamentoExtrasTotal)}
          </div>
        </Card>
      </div>

      {/* 2. LISTAGEM PRINCIPAL LIMPA E REFINADA */}
      <div className="rounded-xl border border-border/20 bg-card/60 overflow-hidden">
        {/* Header da lista */}
        <div className="px-4 py-3 border-b border-border/20 flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Galerias ({items.length})
          </h4>

          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 text-xs px-2.5 gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Nova Galeria
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-2 rounded-xl shadow-lg border border-border/60" align="end" sideOffset={8}>
              <div className="space-y-1">
                <button
                  onClick={() => navigate('/app/gallery/new/select', { state: { preselectClient: cliente.id } })}
                  className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-medium hover:bg-muted/60 transition-colors text-left"
                >
                  <MousePointerClick className="h-3.5 w-3.5 text-accent-gold shrink-0" />
                  <span>Galeria de Seleção</span>
                </button>
                <button
                  onClick={() => navigate('/app/gallery/new/transfer', { state: { preselectClient: cliente.id } })}
                  className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-medium hover:bg-muted/60 transition-colors text-left"
                >
                  <Send className="h-3.5 w-3.5 text-accent-gold shrink-0" />
                  <span>Galeria de Transfer</span>
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Linhas da lista */}
        <div className="divide-y divide-border/15">
          {items.map(item => {
            const isConfirmed = item.statusSelecao === 'selecao_completa' || item.status === 'selection_completed';
            const valorExtraFormatado = item.valorTotalVendido > 0 ? item.valorTotalVendido : item.valorExtras;

            return (
              <div
                key={item.id}
                onClick={() => handleOpenGallery(item)}
                className="px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-muted/20 transition-colors cursor-pointer group"
              >
                {/* Esquerda: Miniatura + Nome + Pacote */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center border border-border/20">
                    {item.thumbnailUrl ? (
                      <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-foreground truncate group-hover:text-accent-gold transition-colors">
                        {item.sessionName}
                      </span>
                      {item.packageName && (
                        <span className="text-[11px] text-muted-foreground/80 bg-muted/40 px-1.5 py-0.5 rounded">
                          {item.packageName}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-xs">
                      {/* Status discreto */}
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          isConfirmed ? "bg-emerald-500" : "bg-amber-500"
                        )} />
                        <span className="text-muted-foreground text-[11px]">
                          {item.tipo === 'entrega' ? 'Transfer' : isConfirmed ? 'Seleção Concluída' : 'Em Seleção'}
                        </span>
                      </div>

                      {/* Fotos extras discretas se houver */}
                      {item.extraCount > 0 && (
                        <span className="text-[11px] text-amber-500/90 font-medium">
                          +{item.extraCount} {item.extraCount === 1 ? 'extra' : 'extras'}
                          {valorExtraFormatado > 0 && ` (${formatCurrency(valorExtraFormatado)})`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Direita: Ações */}
                <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                  {item.raw.status === 'archived' ? (
                    <Badge variant="outline" className="text-[10px] uppercase font-semibold text-muted-foreground bg-muted/30">
                      Arquivada
                    </Badge>
                  ) : (
                    <>
                      {item.publicToken && (
                        <button
                          type="button"
                          onClick={(e) => handleCopyPublicLink(e, item.publicToken)}
                          className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                          title="Copiar link da galeria"
                        >
                          {copiedToken === item.publicToken ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-500" />
                              <span className="hidden sm:inline text-[11px] text-emerald-500">Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline text-[11px]">Link</span>
                            </>
                          )}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleOpenGallery(item)}
                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors font-medium"
                      >
                        <span>Ver Galeria</span>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => navigate(item.tipo === 'entrega' ? `/app/gallery/transfer/${item.id}/edit` : `/app/gallery/select/${item.id}/edit`)}>
                            <Pencil className="h-3.5 w-3.5 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setShareGalleryId(item.id)}>
                            <Send className="h-3.5 w-3.5 mr-2" />
                            Compartilhar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setReactivateGalleryId(item.id)}>
                            <RotateCcw className="h-3.5 w-3.5 mr-2" />
                            Reativar prazo
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => setDeleteGalleryId(item.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAIS DE APOIO */}
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

