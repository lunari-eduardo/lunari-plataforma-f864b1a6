import { useState, useCallback, useMemo } from 'react';
import { addMonths, addWeeks, addDays, subMonths, subWeeks, subDays, addYears, subYears } from "date-fns";
import { ViewType } from '@/utils/dateFormatters';
import { usePersistedState } from './usePersistedState';

export const useAgendaNavigation = () => {
  // View and navigation state
  const [view, setView] = useState<ViewType>(() => {
    const savedView = localStorage.getItem('preferredView') as ViewType;
    return savedView || 'month';
  });
  
  // Persistir data selecionada em sessionStorage para manter ao minimizar/reabrir PWA
  const [dateISO, setDateISO] = usePersistedState<string>(
    'agenda_current_date',
    new Date().toISOString()
  );
  
  // Converter de/para Date
  const date = useMemo(() => new Date(dateISO), [dateISO]);
  
  const setDate = useCallback((newDate: Date | ((prev: Date) => Date)) => {
    setDateISO(prev => {
      const prevDate = new Date(prev);
      const nextDate = typeof newDate === 'function' ? newDate(prevDate) : newDate;
      return nextDate.toISOString();
    });
  }, [setDateISO]);

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
  }, [view, setDate]);

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
  }, [view, setDate]);

  const navigateToday = useCallback(() => {
    setDate(new Date());
  }, [setDate]);

  const navigateToDate = useCallback((targetDate: Date) => {
    setDate(targetDate);
  }, [setDate]);

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