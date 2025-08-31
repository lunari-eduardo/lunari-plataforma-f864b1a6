import { useIsMobile } from '@/hooks/use-mobile';
import { useIsTablet } from '@/hooks/useIsTablet';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export const useResponsiveLayout = () => {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  
  const deviceType: DeviceType = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';
  
  // Standardized responsive classes
  const getResponsiveClasses = () => ({
    // Container classes
    container: isMobile ? 'px-2 space-y-2' : isTablet ? 'px-4 space-y-3' : 'px-6 space-y-4',
    card: isMobile ? 'p-2' : 'p-4',
    
    // Button sizes
    buttonHeight: isMobile ? 'h-8' : 'h-8',
    buttonPadding: isMobile ? 'px-2' : isTablet ? 'px-3' : 'px-3',
    iconButton: isMobile ? 'h-8 w-8' : 'h-8 w-8',
    
    // Text sizes
    title: isMobile ? 'text-sm' : isTablet ? 'text-base' : 'text-base',
    subtitle: isMobile ? 'text-xs' : 'text-sm',
    
    // Layout gaps
    gap: isMobile ? 'gap-1' : isTablet ? 'gap-2' : 'gap-4',
    spaceY: isMobile ? 'space-y-1' : isTablet ? 'space-y-2' : 'space-y-3',
    
    // Margins and padding
    margin: isMobile ? 'mb-2' : isTablet ? 'mb-3' : 'mb-4',
    
    // Grid and flex
    gridCols: isMobile ? 'grid-cols-1' : isTablet ? 'grid-cols-2' : 'grid-cols-3',
    
    // Specific calendar classes
    calendarCell: isMobile ? 'min-h-[80px] p-1' : isTablet ? 'min-h-[100px] p-2' : 'min-h-[120px] p-2',
    weeklyTimeSlot: isMobile ? 'h-10 p-0.5' : isTablet ? 'h-10 p-0.5' : 'h-12 md:h-16 p-0.5 md:p-1',
    timeLabel: isMobile ? 'text-[10px] px-2' : isTablet ? 'text-[10px] px-2' : 'text-xs px-3 md:px-4'
  });

  return {
    isMobile,
    isTablet,
    deviceType,
    classes: getResponsiveClasses()
  };
};