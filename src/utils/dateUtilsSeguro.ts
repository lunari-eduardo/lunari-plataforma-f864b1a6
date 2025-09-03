/**
 * Utilitários seguros para manipulação de datas
 * Evita crashes de RangeError: Invalid time value
 */

import { formatDateForStorage, parseDateFromStorage } from './dateUtils';

/**
 * Parse seguro de data - nunca retorna data inválida
 */
export function parseSeguro(dateInput: any): Date | null {
  if (!dateInput) return null;
  
  try {
    let date: Date;
    
    if (dateInput instanceof Date) {
      date = dateInput;
    } else if (typeof dateInput === 'string') {
      // Formato YYYY-MM-DD
      if (dateInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
        date = parseDateFromStorage(dateInput);
      } else {
        date = new Date(dateInput);
      }
    } else if (typeof dateInput === 'number') {
      date = new Date(dateInput);
    } else {
      return null;
    }
    
    // Verificar se a data é válida
    if (isNaN(date.getTime())) {
      return null;
    }
    
    return date;
  } catch (error) {
    return null;
  }
}

/**
 * Serialização segura de data para string
 */
export function serializarSeguro(date: Date | string | null | undefined): string {
  if (!date) return '';
  
  try {
    if (typeof date === 'string') {
      // Se já é string no formato correto, retorna
      if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return date;
      }
      // Tenta converter string para Date e depois para string segura
      const parsed = parseSeguro(date);
      if (!parsed) return '';
      return formatDateForStorage(parsed);
    }
    
    if (date instanceof Date) {
      if (isNaN(date.getTime())) {
        return '';
      }
      return formatDateForStorage(date);
    }
    
    return '';
  } catch (error) {
    return '';
  }
}

/**
 * Log seguro de data - evita toISOString em datas inválidas
 */
export function logDateSeguro(label: string, date: any): void {
  if (!date) {
    console.log(`${label}: null/undefined`);
    return;
  }
  
  try {
    const parsed = parseSeguro(date);
    if (parsed) {
      console.log(`${label}: ${parsed.toISOString()} (${typeof date})`);
    } else {
      console.log(`${label}: INVALID (${typeof date}): ${String(date)}`);
    }
  } catch (error) {
    console.log(`${label}: ERROR (${typeof date}): ${String(date)}`);
  }
}

/**
 * Converte qualquer input de data para Date seguro
 */
export function toDateSeguro(dateInput: any): Date {
  const parsed = parseSeguro(dateInput);
  return parsed || new Date(); // Fallback para data atual se inválida
}

/**
 * Verifica se uma data é válida
 */
export function isValidDate(date: any): boolean {
  return parseSeguro(date) !== null;
}