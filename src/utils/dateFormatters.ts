import { format, addDays } from "date-fns";
import { ptBR } from 'date-fns/locale';

/**
 * Utility functions for consistent date formatting across the application
 * Centralized to avoid code duplication and ensure consistent behavior
 */

export const capitalizeFirst = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const formatWeekTitle = (date: Date): string => {
  const endOfWeek = addDays(date, 6);
  const startDay = format(date, "d", { locale: ptBR });
  const endDayMonth = format(endOfWeek, "d 'de' MMMM", { locale: ptBR });
  const monthName = format(endOfWeek, "MMMM", { locale: ptBR });
  const capitalizedMonth = capitalizeFirst(monthName);
  return `${startDay} a ${format(endOfWeek, "d")} de ${capitalizedMonth}`;
};

export const formatDayHeaderTitle = (date: Date): string => {
  const monthName = format(date, "MMMM", { locale: ptBR });
  const capitalizedMonth = capitalizeFirst(monthName);
  return `${format(date, "d")} de ${capitalizedMonth}`;
};

export const formatMonthTitle = (date: Date): string => {
  const monthName = format(date, "MMMM", { locale: ptBR });
  const capitalizedMonth = capitalizeFirst(monthName);
  return `${capitalizedMonth} ${format(date, "yyyy")}`;
};

export const formatYearTitle = (date: Date): string => {
  return format(date, "yyyy", { locale: ptBR });
};

export const formatDayTitle = (date: Date): string => {
  const dayName = format(date, "EEEE", { locale: ptBR });
  return capitalizeFirst(dayName);
};

export type ViewType = 'month' | 'week' | 'day' | 'year';

export const formatDateTitle = (date: Date, view: ViewType): string => {
  switch (view) {
    case 'year':
      return formatYearTitle(date);
    case 'month':
      return formatMonthTitle(date);
    case 'week':
      return formatWeekTitle(date);
    case 'day':
      return formatDayHeaderTitle(date);
    default:
      return '';
  }
};

export const formatTimeBr = (time: string): string => {
  const [hh, mm] = time.split(':');
  return mm === '00' ? `${hh}h` : `${hh}h ${mm}min`;
};