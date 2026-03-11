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
}

export default function AgendaHeader({
  view,
  date,
  onViewChange,
  onNavigatePrevious,
  onNavigateNext,
  onNavigateToday,
  onOpenAvailability,
  onOpenShare
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
      variant={view === viewKey ? "default" : "ghost"}
      size="sm"
      onClick={() => onViewChange(viewKey)}
      className={view === viewKey 
        ? "bg-lunar-accent text-lunar-text hover:bg-lunar-accentHover" 
        : "text-lunar-textSecondary hover:text-lunar-text hover:bg-lunar-bg/50"
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
        className={`${classes.buttonHeight} ${classes.buttonPadding} ${classes.subtitle} bg-white/40 dark:bg-white/[0.06] hover:bg-white/60 dark:hover:bg-white/[0.1] border-white/30 dark:border-white/10`}
      >
        Hoje
      </Button>
      
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          onClick={onNavigatePrevious}
          aria-label="Período anterior"
          className={`bg-white/40 dark:bg-white/[0.06] hover:bg-white/60 dark:hover:bg-white/[0.1] border-white/30 dark:border-white/10 ${classes.iconButton}`}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <div className={`${classes.title} font-medium min-w-[150px] md:min-w-[200px] text-center px-2`}>
          {formatDateTitle(date, view)}
        </div>
        
        <Button
          variant="outline"
          size="icon"
          onClick={onNavigateNext}
          aria-label="Próximo período"
          className={`bg-white/40 dark:bg-white/[0.06] hover:bg-white/60 dark:hover:bg-white/[0.1] border-white/30 dark:border-white/10 ${classes.iconButton}`}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </>
  );

  const ViewToggleGroup = () => (
    <div className="bg-white/40 dark:bg-white/[0.06] border border-white/30 dark:border-white/10 rounded-lg p-1 py-0">
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
      className={`bg-white/40 dark:bg-white/[0.06] hover:bg-white/60 dark:hover:bg-white/[0.1] border-white/30 dark:border-white/10 ${
        isMobile 
          ? `${classes.iconButton}` 
          : isTablet 
            ? "h-6 px-3 py-0 my-0 text-xs"
            : "h-8 px-3 text-sm"
      }`}
      title={isMobile ? "Gerenciar Horários" : undefined}
    >
      {!hasPro && <Crown className="h-3.5 w-3.5 text-primary" />}
      {hasPro && <Settings className="h-4 w-4" />}
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
          <div className="flex bg-lunar-surface border border-lunar-border rounded-lg p-1 flex-1">
            {viewButtons.map(({ key, label }) => (
              <ViewToggleButton key={key} viewKey={key} label={label} />
            ))}
          </div>
          <ManageButton />
        </div>

        {/* Day Title for Daily View */}
        {view === 'day' && (
          <div className="flex items-center justify-between w-full">
            <div className="text-lg font-medium text-lunar-textSecondary">
              {formatDayTitle(date)}
            </div>
            {onOpenShare && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={onOpenShare}
                aria-label="Compartilhar horários do dia"
                title="Compartilhar horários do dia"
              >
                <Share2 className="h-4 w-4" />
              </Button>
            )}
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
          <ManageButton />
        </div>

        {/* Day Title for Daily View */}
        {view === 'day' && (
          <div className="flex items-center justify-between w-full">
            <div className="text-lg font-medium text-lunar-textSecondary">
              {formatDayTitle(date)}
            </div>
            {onOpenShare && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={onOpenShare}
                aria-label="Compartilhar horários do dia"
                title="Compartilhar horários do dia"
              >
                <Share2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Desktop Layout
  return (
    <div className="flex flex-col items-center justify-center mb-4 gap-3">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-4">
          <NavigationControls />
          <ViewToggleGroup />
        </div>

        {/* Manage Schedules Button - Far Right */}
        <ManageButton />
      </div>

      {/* Day Title for Daily View */}
      {view === 'day' && (
        <div className="flex items-center justify-between w-full">
          <div className="text-lg font-medium text-lunar-textSecondary">
            {formatDayTitle(date)}
          </div>
          {onOpenShare && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={onOpenShare}
              aria-label="Compartilhar horários do dia"
              title="Compartilhar horários do dia"
            >
              <Share2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}