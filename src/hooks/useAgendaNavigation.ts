import { useState, useCallback } from 'react';
import { addMonths, addWeeks, addDays, subMonths, subWeeks, subDays, addYears, subYears } from "date-fns";
import { ViewType } from '@/utils/dateFormatters';

export const useAgendaNavigation = () => {
  // View and navigation state
  const [view, setView] = useState<ViewType>(() => {
    const savedView = localStorage.getItem('preferredView') as ViewType;
    return savedView || 'month';
  });
  
  const [date, setDate] = useState<Date>(new Date());

  // Save view preference when changed
  const updateView = useCallback((newView: ViewType) => {
    setView(newView);
    localStorage.setItem('preferredView', newView);
  }, []);

  // Optimized navigation functions - using useCallback for stability
  const navigatePrevious = useCallback(() => {
    setDate(currentDate => {
      switch (view) {
        case 'year': return subYears(currentDate, 1);
        case 'month': return subMonths(currentDate, 1);
        case 'week': return subWeeks(currentDate, 1);
        case 'day': return subDays(currentDate, 1);
        default: return currentDate;
      }
    });
  }, [view]);

  const navigateNext = useCallback(() => {
    setDate(currentDate => {
      switch (view) {
        case 'year': return addYears(currentDate, 1);
        case 'month': return addMonths(currentDate, 1);
        case 'week': return addWeeks(currentDate, 1);
        case 'day': return addDays(currentDate, 1);
        default: return currentDate;
      }
    });
  }, [view]);

  const navigateToday = useCallback(() => {
    setDate(new Date());
  }, []);

  const navigateToDate = useCallback((targetDate: Date) => {
    setDate(targetDate);
  }, []);

  return {
    view,
    date,
    setView: updateView,
    setDate,
    navigatePrevious,
    navigateNext,
    navigateToday,
    navigateToDate
  };
};