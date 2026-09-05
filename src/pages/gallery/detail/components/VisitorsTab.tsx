import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Users,
  User,
  Phone,
  Mail,
  ChevronDown,
  ChevronUp,
  Loader2,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { GalleryPhoto } from '@/types/gallery';

interface VisitorsTabProps {
  isLoadingVisitors: boolean;
  visitors: any[];
  expandedVisitorId: string | null;
  setExpandedVisitorId: (id: string | null) => void;
  visitorPhotosMap: Record<string, GalleryPhoto[]>;
  loadingVisitorPhotos: string | null;
  fetchVisitorPhotos: (visitorId: string) => Promise<void>;
  setVisitorCodesModalId: (visitorId: string) => void;
}

export function VisitorsTab({
  isLoadingVisitors,
  visitors,
  expandedVisitorId,
  setExpandedVisitorId,
  visitorPhotosMap,
  loadingVisitorPhotos,
  fetchVisitorPhotos,
  setVisitorCodesModalId,
}: VisitorsTabProps) {
  if (isLoadingVisitors) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!visitors?.length) {
    return (
      <div className="text-center py-16 lunari-card">
        <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Nenhum visitante acessou esta galeria ainda</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visitors.map((visitor: any) => {
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
  );
}
