import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Settings, Share2 } from "lucide-react";
import { formatDateTitle, formatDayTitle, ViewType } from '@/utils/dateFormatters';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

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
        className={`${classes.buttonHeight} ${classes.buttonPadding} ${classes.subtitle} bg-lunar-surface hover:bg-lunar-border border-lunar-border`}
      >
        Hoje
      </Button>
      
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          onClick={onNavigatePrevious}
          aria-label="Período anterior"
          className={`bg-lunar-surface hover:bg-lunar-border border-lunar-border ${classes.iconButton}`}
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
          className={`bg-lunar-surface hover:bg-lunar-border border-lunar-border ${classes.iconButton}`}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </>
  );

  const ViewToggleGroup = () => (
    <div className="bg-lunar-surface border border-lunar-border rounded-lg p-1 py-0">
      {viewButtons.map(({ key, label }) => (
        <ViewToggleButton key={key} viewKey={key} label={label} />
      ))}
    </div>
  );

  const ManageButton = () => (
    <Button
      variant="outline"
      onClick={onOpenAvailability}
      className={`bg-lunar-surface hover:bg-lunar-border border-lunar-border ${
        isMobile 
          ? `${classes.iconButton}` 
          : isTablet 
            ? "h-6 px-3 py-0 my-0 text-xs"
            : "h-8 px-3 text-sm"
      }`}
      title={isMobile ? "Gerenciar Horários" : undefined}
    >
      <Settings className="h-4 w-4" />
      {!isMobile && (
        <>
          <span className="ml-2">Gerenciar Horários</span>
        </>
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