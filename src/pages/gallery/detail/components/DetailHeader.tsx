import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft,
  Calendar,
  Image,
  Pencil,
  Check,
  Clock,
  RotateCcw,
  MoreHorizontal,
  Share2,
  Trash2,
  Unlink,
  Database,
  ExternalLink,
  User,
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
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { DeleteGalleryDialog } from '@/components/DeleteGalleryDialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { GalleryStatus } from '@/types/gallery';

interface DetailHeaderProps {
  supabaseGallery: any;
  effectiveStatus: GalleryStatus;
  effectiveClienteId?: string | null;
  calculatedExtraTotal: number;
  canReactivate: boolean;
  deadline: Date;
  onReactivateClick: () => void;
  onShareClick: () => void;
  onDeleteGallery: () => Promise<void>;
  onDetailsTabClick: () => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  deleteDialogOpen: boolean;
  setDeleteDialogOpen: (open: boolean) => void;
}

export function DetailHeader({
  supabaseGallery,
  effectiveStatus,
  effectiveClienteId,
  calculatedExtraTotal,
  canReactivate,
  deadline,
  onReactivateClick,
  onShareClick,
  onDeleteGallery,
  onDetailsTabClick,
  mobileMenuOpen,
  setMobileMenuOpen,
  deleteDialogOpen,
  setDeleteDialogOpen,
}: DetailHeaderProps) {
  const navigate = useNavigate();

  const vendido = supabaseGallery.valorTotalVendido || 0;
  const pendente = calculatedExtraTotal || 0;
  const exp = supabaseGallery.expiresAt as Date | null | undefined;
  const isLinkedToStudio = !!supabaseGallery.sessionId;

  const paymentBadge = (() => {
    if (vendido <= 0 && pendente <= 0) return null;
    const commonProps = {
      onClick: onDetailsTabClick,
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
            onClick={onReactivateClick}
            className={cn(
              "transition-opacity",
              !canReactivate && "opacity-40 cursor-not-allowed pointer-events-none"
            )}
            disabled={!canReactivate}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reativar
          </Button>
          
          <Button variant="terracotta" size="sm" onClick={onShareClick}>
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

      {/* Ações primárias — Mobile */}
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

        <Button variant="terracotta" size="sm" className="w-full" onClick={onShareClick}>
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
          onClick={onReactivateClick}
          disabled={!canReactivate}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reativar
        </Button>
      </div>

      <DeleteGalleryDialog
        galleryName={supabaseGallery.nomeSessao || 'Esta galeria'}
        onDelete={onDeleteGallery}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      />
    </div>
  );
}
