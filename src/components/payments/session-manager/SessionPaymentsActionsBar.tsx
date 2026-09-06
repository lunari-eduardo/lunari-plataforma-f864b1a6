import { CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { CreditCard, Send, ChevronDown, Images, History } from 'lucide-react';
import { formatCurrency } from '@/utils/financialUtils';

interface SessionPaymentsActionsBarProps {
  isCard: boolean;
  hasGaleria: boolean;
  canCobrarSessao: boolean;
  canCobrarExtras: boolean;
  canCobrarTudo: boolean;
  valorRestanteSessao: number;
  extrasPend: number;
  onOpenChargeModal: (tab?: 'cobrar' | 'historico') => void;
  onOpenExtraChargeModal: () => void;
  onCobrarTudo: () => void;
}

export function SessionPaymentsActionsBar({
  isCard,
  hasGaleria,
  canCobrarSessao,
  canCobrarExtras,
  canCobrarTudo,
  valorRestanteSessao,
  extrasPend,
  onOpenChargeModal,
  onOpenExtraChargeModal,
  onCobrarTudo,
}: SessionPaymentsActionsBarProps) {
  return (
    <CardHeader className={isCard ? 'px-0 pt-0 pb-2' : undefined}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <CardTitle className={isCard ? 'text-xs font-semibold flex items-center gap-2' : 'text-sm md:text-lg font-semibold flex items-center gap-2'}>
          <CreditCard className={isCard ? 'h-3.5 w-3.5 text-accent-gold' : 'h-4 w-4 md:h-5 md:w-5 text-primary'} />
          Histórico de Movimentações
        </CardTitle>

        <div className="flex gap-2 w-full sm:w-auto">
          {hasGaleria ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="gap-2 flex-1 sm:flex-none h-8 text-xs border-primary text-primary hover:bg-primary/10"
                  size="sm"
                  disabled={!canCobrarSessao && !canCobrarExtras}
                >
                  <Send className="h-3 w-3 md:h-4 md:w-4" />
                  Cobrar
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  disabled={!canCobrarSessao}
                  onClick={() => onOpenChargeModal('cobrar')}
                >
                  <Send className="h-3.5 w-3.5 mr-2" />
                  <div className="flex-1">
                    <div className="text-xs font-medium">Cobrar sessão</div>
                    <div className="text-2xs text-muted-foreground">{formatCurrency(valorRestanteSessao)}</div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!canCobrarExtras}
                  onClick={onOpenExtraChargeModal}
                >
                  <Images className="h-3.5 w-3.5 mr-2 text-amber-500" />
                  <div className="flex-1">
                    <div className="text-xs font-medium">Cobrar extras</div>
                    <div className="text-2xs text-muted-foreground">{formatCurrency(extrasPend)}</div>
                  </div>
                </DropdownMenuItem>
                {canCobrarTudo && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onCobrarTudo}>
                      <Send className="h-3.5 w-3.5 mr-2 text-primary" />
                      <div className="flex-1">
                        <div className="text-xs font-medium">Cobrar tudo</div>
                        <div className="text-2xs text-muted-foreground">
                          {formatCurrency(valorRestanteSessao + extrasPend)} · 1 link único
                        </div>
                      </div>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              onClick={() => onOpenChargeModal('cobrar')}
              variant="outline"
              disabled={!canCobrarSessao}
              className="gap-2 flex-1 sm:flex-none h-8 text-xs border-primary text-primary hover:bg-primary/10"
              size="sm"
            >
              <Send className="h-3 w-3 md:h-4 md:w-4" />
              Cobrar
            </Button>
          )}
          <Button
            onClick={() => onOpenChargeModal('historico')}
            variant="outline"
            className="gap-2 flex-1 sm:flex-none h-8 text-xs border-muted-foreground/30 hover:bg-muted/50"
            size="sm"
          >
            <History className="h-3.5 w-3.5" />
            Histórico
          </Button>
        </div>
      </div>
    </CardHeader>
  );
}
