
import { format } from 'date-fns';

/**
 * Utilitários para manipulação de datas sem problemas de fuso horário
 * REGRA DE OURO: Todas as datas são armazenadas como strings YYYY-MM-DD
 */

/**
 * Converte uma data selecionada pelo usuário para string YYYY-MM-DD
 * preservando o dia local, ignorando conversões de fuso horário
 */
export function formatDateForStorage(date: Date | string): string {
  if (!date) return '';
  
  let dateObj: Date;
  
  if (typeof date === 'string') {
    // Se já é uma string de data, retorna como está
    if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return date;
    }
    dateObj = new Date(date);
  } else {
    dateObj = date;
  }

  // Verificar se a data é válida
  if (isNaN(dateObj.getTime())) {
    // Evita passar objeto Date inválido para o console para não disparar toISOString
    console.warn('Invalid date passed to formatDateForStorage:', String(date));
    return '';
  }

  const ano = dateObj.getFullYear();
  const mes = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dia = String(dateObj.getDate()).padStart(2, '0');

  return `${ano}-${mes}-${dia}`;
}

/**
 * Converte uma string de data salva (YYYY-MM-DD) para um objeto Date
 * que pode ser formatado corretamente para exibição, evitando conversões de fuso horário
 */
export function parseDateFromStorage(dateString: string): Date {
  // Handle null/undefined/empty strings
  if (!dateString || typeof dateString !== 'string') {
    return new Date(); // Return current date as fallback
  }
  
  try {
    // Cria a data diretamente sem conversões de timezone usando os componentes da data
    const parts = dateString.split('-');
    if (parts.length !== 3) {
      return new Date(); // Return current date if format is invalid
    }
    
    const [year, month, day] = parts.map(Number);
    
    // Validate the parsed numbers
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      return new Date(); // Return current date if any part is NaN
    }
    
    return new Date(year, month - 1, day); // month é 0-indexed no constructor Date
  } catch (error) {
    console.warn('Error parsing date from storage:', dateString, error);
    return new Date(); // Return current date as fallback
  }
}

/**
 * Formata uma data para exibição no padrão brasileiro (dd/mm/yyyy)
 * usando manipulação de string para evitar conversões de timezone
 */
export function formatDateForDisplay(dateString: string): string {
  if (!dateString || !dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return '';
  }
  
  const [ano, mes, dia] = dateString.split('-');
  return `${dia}/${mes}/${ano}`;
}

/**
 * Converte uma data do formato dd/mm/yyyy para yyyy-mm-dd
 * usando manipulação de string
 */
export function convertBRDateToISO(brDate: string): string {
  if (!brDate || !brDate.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
    return '';
  }
  
  const [dia, mes, ano] = brDate.split('/');
  return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
}

/**
 * Converte uma data do formato yyyy-mm-dd para dd/mm/yyyy
 * usando manipulação de string
 */
export function convertISODateToBR(isoDate: string): string {
  if (!isoDate || !isoDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return '';
  }
  
  const [ano, mes, dia] = isoDate.split('-');
  return `${dia}/${mes}/${ano}`;
}

/**
 * Verifica se duas datas (no formato string) são do mesmo mês/ano
 */
export function isSameMonthYear(dateString1: string, monthYearFilter: string): boolean {
  if (!dateString1 || !monthYearFilter) return false;
  
  const [ano1, mes1] = dateString1.split('-');
  const [ano2, mes2] = monthYearFilter.split('-');
  
  return ano1 === ano2 && mes1 === mes2;
}

/**
 * Obtém a data atual no formato YYYY-MM-DD
 */
export function getCurrentDateString(): string {
  const hoje = new Date();
  return formatDateForStorage(hoje);
}

/**
 * Valida se uma string está no formato de data válido
 */
export function isValidDateString(dateString: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateString);
}

/**
 * Converte uma string de input de data para Date de forma segura
 * Retorna null se a string não for válida
 */
export function safeParseInputDate(inputValue: string): Date | null {
  if (!inputValue) return null;
  
  // Cria a data usando os componentes da data para evitar problemas de timezone
  const [year, month, day] = inputValue.split('-').map(Number);
  if (!year || !month || !day) return null;
  
  const date = new Date(year, month - 1, day); // month é 0-indexed no constructor Date
  
  // Verifica se é uma data válida
  if (isNaN(date.getTime())) return null;
  
  return date;
}

/**
 * Converte uma data no formato YYYY-MM-DD para DD/MM (apenas dia e mês)
 */
export function formatToDayMonth(dateString: string): string {
  if (!dateString || !dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return '';
  }
  
  const [ano, mes, dia] = dateString.split('-');
  return `${dia}/${mes}`;
}

/**
 * Formata data para PDF evitando conversões de timezone
 * Usa apenas as funções seguras de dateUtils
 */
export function formatDateForPDF(dateString: string): string {
  if (!dateString) return '';
  
  // Se for uma string YYYY-MM-DD válida, usa formatDateForDisplay
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return formatDateForDisplay(dateString);
  }
  
  // Se for uma string ISO com timestamp, extrai só a data
  if (dateString.includes('T')) {
    const dateOnly = dateString.split('T')[0];
    return formatDateForDisplay(dateOnly);
  }
  
  return '';
}

/**
 * Obtém data/hora atual formatada para PDF sem problemas de timezone
 */
export function getCurrentDateTimeForPDF(): string {
  const now = new Date();
  const dateStr = formatDateForStorage(now);
  const displayDate = formatDateForDisplay(dateStr);
  const timeStr = now.toLocaleTimeString('pt-BR', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  return `${displayDate} às ${timeStr}`;
}

/**
 * Calcula quantos dias se passaram desde uma data e retorna um label amigável
 */
export function daysAgoLabel(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    
    // Resetar horas para comparar apenas datas
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const diffTime = nowOnly.getTime() - dateOnly.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'há 1 dia';
    return `há ${diffDays} dias`;
  } catch {
    return 'Data inválida';
  }
}

/**
 * Obtém o nome do mês em português
 */
export function getMonthNameInPortuguese(dateString: string): string {
  if (!dateString || !dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return '';
  }
  
  const [ano, mes] = dateString.split('-');
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  
  return `${monthNames[parseInt(mes) - 1]} ${ano}`;
}

/**
 * Obtém a chave de agrupamento por mês (YYYY-MM) de uma data
 */
export function getMonthGroupKey(dateString: string): string {
  if (!dateString || !dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return '';
  }
  
  const [ano, mes] = dateString.split('-');
  return `${ano}-${mes}`;
}

/**
 * Agrupa uma lista de itens por mês usando data_vencimento
 */
export function groupTransactionsByMonth<T extends { data_vencimento: string }>(items: T[]): Record<string, T[]> {
  return items.reduce((groups, item) => {
    const monthKey = getMonthGroupKey(item.data_vencimento);
    if (!monthKey) return groups;
    
    if (!groups[monthKey]) {
      groups[monthKey] = [];
    }
    groups[monthKey].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

/**
 * Agrupa uma lista de itens por mês
 */
export function groupByMonth<T extends { data: string }>(items: T[]): Record<string, T[]> {
  return items.reduce((groups, item) => {
    const monthKey = getMonthGroupKey(item.data);
    if (!monthKey) return groups;
    
    if (!groups[monthKey]) {
      groups[monthKey] = [];
    }
    groups[monthKey].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

/**
 * Ordena as chaves de mês em ordem cronológica
 */
export function sortMonthKeys(monthKeys: string[]): string[] {
  return monthKeys.sort((a, b) => a.localeCompare(b));
}

/**
 * Formata uma data para o formato de input HTML (yyyy-MM-dd)
 */
export function formatDateForInput(date: Date | string): string {
  if (!date) return '';
  
  // Se é uma string de data no formato YYYY-MM-DD, retorna como está
  if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return date;
  }
  
  // Se é uma string ISO com tempo (YYYY-MM-DDTHH:mm:ss...), extrai apenas a parte da data
  if (typeof date === 'string' && date.includes('T')) {
    return date.split('T')[0];
  }
  
  // Se é uma string, tenta converter para Date
  if (typeof date === 'string') {
    const parsedDate = safeParseInputDate(date);
    if (!parsedDate) return '';
    date = parsedDate;
  }
  
  // Se é um objeto Date, verifica se é válido
  if (!(date instanceof Date) || isNaN(date.getTime())) return '';
  
  return format(date, 'yyyy-MM-dd');
}

/**
 * Formata um timestamp ISO para exibição no padrão brasileiro com hora (DD/MM/YYYY HH:MM)
 * Suporta tanto formato date-only (YYYY-MM-DD) quanto timestamp completo
 */
export function formatDateTimeForDisplay(timestamp: string): string {
  if (!timestamp) return '';
  
  // Se for apenas data (YYYY-MM-DD), retornar formato simples sem hora
  if (timestamp.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [ano, mes, dia] = timestamp.split('-');
    return `${dia}/${mes}/${ano}`;
  }
  
  // Se for timestamp completo (com T ou espaço), extrair data e hora
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    
    const dia = String(date.getDate()).padStart(2, '0');
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const ano = date.getFullYear();
    const hora = String(date.getHours()).padStart(2, '0');
    const minuto = String(date.getMinutes()).padStart(2, '0');
    
    return `${dia}/${mes}/${ano} ${hora}:${minuto}`;
  } catch {
    return '';
  }
}
