/**
 * Utilitários centralizados para a agenda
 * Funções auxiliares comuns utilizadas em múltiplos componentes
 */

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Formatar horário em português brasileiro
 * @param time Horário no formato HH:mm
 * @returns Horário formatado (ex: "14h" ou "14h 30min")
 */
export const formatTimeBr = (time: string): string => {
  const [hh, mm] = time.split(':');
  return mm === '00' ? `${hh}h` : `${hh}h ${mm}min`;
};

/**
 * Formatar nome do dia da semana
 * @param date Data
 * @returns Nome do dia abreviado em português
 */
export const formatDayName = (date: Date): string => {
  return format(date, 'EEE', { locale: ptBR });
};

/**
 * Gerar chave única para data (yyyy-MM-dd)
 * @param date Data
 * @returns String no formato yyyy-MM-dd
 */
export const getDateKey = (date: Date): string => {
  return format(date, 'yyyy-MM-dd');
};

/**
 * Gerar chave única para slot de tempo (data_hora)
 * @param date Data
 * @param time Horário
 * @returns String no formato yyyy-MM-dd_HH:mm
 */
export const getSlotKey = (date: Date, time: string): string => {
  return `${getDateKey(date)}_${time}`;
};

/**
 * Constantes de horários padrão
 */
export const DEFAULT_TIME_SLOTS = [
  "08:00", "09:00", "10:00", "11:00", "12:00", 
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"
];

/**
 * Dias da semana em português (abreviados)
 */
export const WEEK_DAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

/**
 * Validar se um horário está no formato correto (HH:mm)
 * @param time Horário a ser validado
 * @returns true se válido, false caso contrário
 */
export const isValidTimeFormat = (time: string): boolean => {
  return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
};