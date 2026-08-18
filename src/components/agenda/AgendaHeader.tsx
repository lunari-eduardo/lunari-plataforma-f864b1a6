import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Settings, Share2, Crown } from "lucide-react";
import { formatDateTitle, formatDayTitle, ViewType } from '@/utils/dateFormatters';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useAccessControl } from '@/hooks/useAccessControl';
import { toast } from 'sonner';

interface AgendaHeaderProps {
  view: ViewType;
  date: Date;
  onViewChange: (view: ViewType) => void;
  onNavigatePrevious: () => void;
  onNavigateNext: () => void;
  onNavigateToday: () => void;
  onOpenAvailability: () => void;
  onOpenShare?: () => void;
  extraAction?: React.ReactNode;
}

export default function AgendaHeader({
  view,
  date,
  onViewChange,
  onNavigatePrevious,
  onNavigateNext,
  onNavigateToday,
  onOpenAvailability,
  onOpenShare,
  extraAction
}: AgendaHeaderProps) {
  const { isMobile, isTablet, classes } = useResponsiveLayout();
  const { hasPro } = useAccessControl();

  const viewButtons = [
    { key: 'day' as const, label: 'Dia' },
    { key: 'week' as const, label: 'Semana' },
    { key: 'month' as const, label: 'Mês' },
    { key: 'year' as const, label: 'Ano' }
  ];

  const ViewToggleButton = ({ viewKey, label }: { viewKey: ViewType; label: string }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onViewChange(viewKey)}
      className={view === viewKey
        ? "h-7 flex-1 bg-background text-[12px] font-medium text-foreground shadow-sm hover:bg-background"
        : "h-7 flex-1 text-[12px] text-muted-foreground hover:bg-background/60 hover:text-foreground"
      }
    >
      {label}
    </Button>
  );

  const NavigationControls = () => (
    <>
      <Button
        variant="outline"
        onClick={onNavigateToday}
        size="sm"
        className={`${classes.buttonHeight} ${classes.buttonPadding} text-xs`}
      >
        Hoje
      </Button>
      
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          onClick={onNavigatePrevious}
          aria-label="Período anterior"
          className={classes.iconButton}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <div className="text-[13px] font-semibold tracking-tight text-foreground min-w-[150px] md:min-w-[200px] text-center px-2">
          {formatDateTitle(date, view)}
        </div>
        
        <Button
          variant="outline"
          size="icon"
          onClick={onNavigateNext}
          aria-label="Próximo período"
          className={classes.iconButton}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </>
  );

  const ViewToggleGroup = () => (
    <div className="flex items-center gap-0.5 rounded-lg border border-border/40 bg-muted/40 p-1 py-0.5">
      {viewButtons.map(({ key, label }) => (
        <ViewToggleButton key={key} viewKey={key} label={label} />
      ))}
    </div>
  );

  const handleManageClick = () => {
    if (!hasPro) {
      toast('Recurso exclusivo do plano Pro', {
        description: 'Faça upgrade para gerenciar horários de disponibilidade.',
        action: {
          label: 'Ver planos',
          onClick: () => window.location.href = '/escolher-plano',
        },
      });
      return;
    }
    onOpenAvailability();
  };

  const ManageButton = () => (
    <Button
      variant="outline"
      onClick={handleManageClick}
      size="sm"
      className={`${
        isMobile 
          ? `${classes.iconButton}` 
          : isTablet 
            ? "h-6 px-3 py-0 my-0 text-xs"
            : "h-8 px-3 text-xs"
      }`}
      title={isMobile ? "Gerenciar Horários" : undefined}
    >
      {!hasPro && <Crown className="h-3.5 w-3.5 text-accent-gold" />}
      {hasPro && <Settings className="h-3.5 w-3.5" />}
      {!isMobile && (
        <span className="ml-1">Gerenciar Horários</span>
      )}
    </Button>
  );

  if (isMobile) {
    return (
      <div className="flex flex-col items-center justify-center mb-2 gap-2">
        {/* Navigation and Date Display */}
        <div className="flex items-center justify-between w-full gap-1">
          <NavigationControls />
        </div>
        
        {/* View Toggle and Manage Button */}
        <div className="flex items-center gap-2 w-full">
          <div className="flex flex-1 items-center gap-0.5 rounded-lg border border-border/40 bg-muted/40 p-1">
            {viewButtons.map(({ key, label }) => (
              <ViewToggleButton key={key} viewKey={key} label={label} />
            ))}
          </div>
          {extraAction}
          <ManageButton />
        </div>

        {/* Day Title for Daily View */}
        {view === 'day' && (
          <div className="text-[13px] font-medium text-muted-foreground">
            {formatDayTitle(date)}
          </div>
        )}
      </div>
    );
  }

  if (isTablet) {
    return (
      <div className="flex flex-col items-center justify-center mb-3 gap-4">
        {/* First Line: Navigation and Date */}
        <div className="flex items-center justify-center w-full gap-4">
          <NavigationControls />
        </div>

        {/* Second Line: View Toggles and Manage Button */}
        <div className="flex items-center justify-center w-full gap-4">
          <ViewToggleGroup />
          <div className="flex items-center gap-2">
            {extraAction}
            <ManageButton />
          </div>
        </div>

        {/* Day Title for Daily View */}
        {view === 'day' && (
          <div className="text-[13px] font-medium text-muted-foreground">
            {formatDayTitle(date)}
          </div>
        )}
      </div>
    );
  }

  // Desktop Layout
  return (
    <div className="mb-3 flex flex-col items-center justify-center gap-2">
      <div className="flex w-full items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <NavigationControls />
          <ViewToggleGroup />
        </div>

        {/* Manage Schedules Button & Extra Actions - Far Right */}
        <div className="flex items-center gap-2">
          {extraAction}
          <ManageButton />
        </div>
      </div>

      {view === 'day' && (
        <div className="text-[13px] font-medium text-muted-foreground">
          {formatDayTitle(date)}
        </div>
      )}
    </div>
  );
}