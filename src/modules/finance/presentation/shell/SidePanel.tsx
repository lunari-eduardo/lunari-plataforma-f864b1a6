/**
 * SidePanel — shell padronizado dos paineis laterais do módulo Financeiro.
 *
 * Mesmo DNA visual do drawer de Lançamentos (LancamentoDrawerProvider):
 *  - Desktop: sheet à direita (largura configurável)
 *  - Mobile:  bottom sheet (92dvh) com drag handle
 *  - Header editorial com ícone dourado, título e subtítulo
 *  - Footer opcional com safe-area
 *  - Shadow "silent luxury"
 *
 * Nenhuma regra de negócio — apenas apresentação.
 */
import { memo, type CSSProperties, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export type SidePanelWidth = 'sm' | 'md' | 'lg' | 'xl';

const WIDTH_CLASS: Record<SidePanelWidth, string> = {
  sm: 'sm:max-w-[480px]',
  md: 'sm:max-w-[560px]',
  lg: 'sm:max-w-[720px]',
  xl: 'sm:max-w-[880px]',
};

interface SidePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icone?: LucideIcon;
  titulo: string;
  subtitulo?: string;
  /** Elemento adicional colado abaixo do título (badges, meta info). */
  headerExtra?: ReactNode;
  width?: SidePanelWidth;
  /** Slot fixo no rodapé (use SidePanel.Footer). */
  footer?: ReactNode;
  /** Padding customizado no body (default: px-6 py-5 / mobile px-5 py-4). */
  bodyClassName?: string;
  children: ReactNode;
}

function SidePanelBase({
  open,
  onOpenChange,
  icone: Icone,
  titulo,
  subtitulo,
  headerExtra,
  width = 'md',
  footer,
  bodyClassName,
  children,
}: SidePanelProps) {
  const isMobile = useIsMobile();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'flex flex-col gap-0 border-l border-border/60 bg-background p-0',
          'shadow-[0_20px_60px_-20px_rgba(0,0,0,0.35)]',
          isMobile
            ? 'h-[92dvh] max-h-[92dvh] w-full rounded-t-2xl border-l-0 border-t'
            : cn('w-full', WIDTH_CLASS[width]),
        )}
      >
        {isMobile && (
          <div className="flex justify-center pt-2 pb-1 shrink-0">
            <span aria-hidden className="h-1 w-10 rounded-full bg-border/80" />
          </div>
        )}

        <header
          className={cn(
            'flex items-start gap-3 border-b border-border/40 shrink-0',
            isMobile ? 'px-5 pt-3 pb-3' : 'px-6 pt-6 pb-4',
          )}
        >
          {Icone ? (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-gold/10 text-accent-gold shrink-0">
              <Icone className="h-4 w-4" />
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <SheetTitle asChild>
              <h2 className="font-heading text-[15px] font-semibold tracking-tight text-foreground truncate">
                {titulo}
              </h2>
            </SheetTitle>
            {subtitulo ? (
              <SheetDescription asChild>
                <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
                  {subtitulo}
                </p>
              </SheetDescription>
            ) : (
              <SheetDescription className="sr-only">{titulo}</SheetDescription>
            )}
            {headerExtra ? <div className="mt-2">{headerExtra}</div> : null}
          </div>
        </header>

        <div
          className={cn(
            'flex-1 overflow-y-auto',
            bodyClassName ?? (isMobile ? 'px-5 py-4' : 'px-6 py-5'),
          )}
        >
          {children}
        </div>

        {footer}
      </SheetContent>
    </Sheet>
  );
}

interface SidePanelFooterProps {
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
}

function SidePanelFooter({ left, right, className }: SidePanelFooterProps) {
  const style: CSSProperties = {
    paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
  };
  return (
    <div
      style={style}
      className={cn(
        'flex items-center justify-between gap-3 border-t border-border/40 bg-background/60 px-6 pt-4 shrink-0',
        className,
      )}
    >
      <div className="flex items-center gap-2 min-w-0">{left}</div>
      <div className="flex items-center gap-2 shrink-0">{right}</div>
    </div>
  );
}

export const SidePanel = Object.assign(memo(SidePanelBase), {
  Footer: SidePanelFooter,
});

export default SidePanel;
