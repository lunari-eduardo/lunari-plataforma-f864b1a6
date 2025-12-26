/**
 * Parser de planilha para importação de sessões do Workflow
 */
import * as XLSX from 'xlsx';
import {
  SpreadsheetSession,
  SpreadsheetPayment,
  ParsedSpreadsheet,
  ParseError,
  EXPECTED_COLUMNS,
  VALID_STATUSES
} from '@/types/spreadsheetImport';

/**
 * Normaliza string para comparação de colunas
 */
function normalizeColumnName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Mapeia nome da coluna para chave esperada
 */
function mapColumnToKey(columnName: string): string | null {
  const normalized = normalizeColumnName(columnName);
  
  // Mapeamentos diretos
  const mappings: Record<string, string> = {
    'nome': 'cliente_nome',
    'nome_cliente': 'cliente_nome',
    'nome_do_cliente': 'cliente_nome',
    'cliente': 'cliente_nome',
    'email': 'cliente_email',
    'email_cliente': 'cliente_email',
    'email_do_cliente': 'cliente_email',
    'whatsapp': 'cliente_whatsapp',
    'telefone': 'cliente_whatsapp',
    'celular': 'cliente_whatsapp',
    'data': 'data_sessao',
    'data_sessao': 'data_sessao',
    'data_da_sessao': 'data_sessao',
    'hora': 'hora_sessao',
    'hora_sessao': 'hora_sessao',
    'horario': 'hora_sessao',
    'categoria': 'categoria',
    'tipo': 'categoria',
    'pacote': 'pacote',
    'status': 'status',
    'situacao': 'status',
    'valor_base': 'valor_base_pacote',
    'valor_base_pacote': 'valor_base_pacote',
    'valor_pacote': 'valor_base_pacote',
    'valor_foto_extra': 'valor_foto_extra',
    'foto_extra': 'valor_foto_extra',
    'qtd_fotos_extra': 'qtd_fotos_extra',
    'quantidade_fotos_extra': 'qtd_fotos_extra',
    'fotos_extra': 'qtd_fotos_extra',
    'valor_total_foto_extra': 'valor_total_foto_extra',
    'total_fotos_extra': 'valor_total_foto_extra',
    'valor_adicional': 'valor_adicional',
    'adicional': 'valor_adicional',
    'desconto': 'desconto',
    'valor_total': 'valor_total',
    'total': 'valor_total',
    'valor_pago': 'valor_pago',
    'pago': 'valor_pago',
    'descricao': 'descricao',
    'observacoes': 'observacoes',
    'obs': 'observacoes',
    'detalhes': 'detalhes',
  };
  
  return mappings[normalized] || null;
}

/**
 * Converte data do formato brasileiro ou ISO para YYYY-MM-DD
 */
function parseDate(value: any): string | null {
  if (!value) return null;
  
  // Se for número do Excel (serial date)
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      const year = date.y;
      const month = String(date.m).padStart(2, '0');
      const day = String(date.d).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  
  const str = String(value).trim();
  
  // Formato ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  
  // Formato brasileiro: DD/MM/YYYY ou DD-MM-YYYY
  const brMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Formato brasileiro curto: DD/MM/YY
  const brShortMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
  if (brShortMatch) {
    const [, day, month, yearShort] = brShortMatch;
    const year = parseInt(yearShort) > 50 ? `19${yearShort}` : `20${yearShort}`;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  return null;
}

/**
 * Converte hora para formato HH:MM
 */
function parseTime(value: any): string | null {
  if (!value) return null;
  
  // Se for número do Excel (fração do dia)
  if (typeof value === 'number') {
    const totalMinutes = Math.round(value * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
  
  const str = String(value).trim();
  
  // Formato HH:MM ou H:MM
  const timeMatch = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (timeMatch) {
    const [, hours, minutes] = timeMatch;
    return `${hours.padStart(2, '0')}:${minutes}`;
  }
  
  // Formato HHhMM
  const hMatch = str.match(/^(\d{1,2})h(\d{2})?$/i);
  if (hMatch) {
    const [, hours, minutes = '00'] = hMatch;
    return `${hours.padStart(2, '0')}:${minutes}`;
  }
  
  return null;
}

/**
 * Converte valor monetário para número
 */
function parseMonetaryValue(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  
  // Já é número
  if (typeof value === 'number') {
    return Math.round(value * 100) / 100;
  }
  
  const str = String(value).trim();
  
  // Remove R$, espaços e pontos de milhar
  let cleaned = str
    .replace(/R\$\s*/gi, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : Math.round(num * 100) / 100;
}

/**
 * Normaliza status para valor válido
 */
function normalizeStatus(value: any): string {
  if (!value) return 'agendado';
  
  const str = String(value).toLowerCase().trim();
  
  const statusMap: Record<string, string> = {
    'agendado': 'agendado',
    'agendada': 'agendado',
    'confirmado': 'confirmado',
    'confirmada': 'confirmado',
    'realizado': 'realizado',
    'realizada': 'realizado',
    'feito': 'realizado',
    'feita': 'realizado',
    'editando': 'editando',
    'edicao': 'editando',
    'edição': 'editando',
    'entregue': 'entregue',
    'entrega': 'entregue',
    'cancelado': 'cancelado',
    'cancelada': 'cancelado',
    'cancelar': 'cancelado',
  };
  
  return statusMap[str] || 'agendado';
}

/**
 * Faz o parse completo da planilha
 */
export async function parseWorkflowSpreadsheet(file: File): Promise<ParsedSpreadsheet> {
  const errors: ParseError[] = [];
  const warnings: string[] = [];
  const sessions: SpreadsheetSession[] = [];
  const payments: SpreadsheetPayment[] = [];
  
  try {
    // Ler arquivo
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    
    // Verificar se tem aba SESSÕES ou usar primeira aba
    let sessionsSheet = workbook.Sheets['SESSÕES'] || 
                        workbook.Sheets['SESSOES'] ||
                        workbook.Sheets['Sessões'] ||
                        workbook.Sheets['sessoes'] ||
                        workbook.Sheets[workbook.SheetNames[0]];
    
    if (!sessionsSheet) {
      errors.push({ row: 0, message: 'Planilha não possui abas válidas' });
      return { sessions, payments, errors, warnings };
    }
    
    // Converter para JSON
    const rawData = XLSX.utils.sheet_to_json(sessionsSheet, { header: 1 });
    
    if (rawData.length < 2) {
      errors.push({ row: 0, message: 'Planilha está vazia ou só tem cabeçalho' });
      return { sessions, payments, errors, warnings };
    }
    
    // Primeira linha é o cabeçalho
    const headerRow = rawData[0] as string[];
    
    // Mapear colunas
    const columnMap: Record<number, string> = {};
    const foundColumns: string[] = [];
    
    headerRow.forEach((col, index) => {
      if (col) {
        const key = mapColumnToKey(String(col));
        if (key) {
          columnMap[index] = key;
          foundColumns.push(key);
        }
      }
    });
    
    // Verificar colunas obrigatórias
    const requiredColumns = EXPECTED_COLUMNS.sessions
      .filter(c => c.required)
      .map(c => c.key);
    
    const missingColumns = requiredColumns.filter(c => !foundColumns.includes(c));
    
    if (missingColumns.length > 0) {
      const missing = missingColumns.map(c => 
        EXPECTED_COLUMNS.sessions.find(e => e.key === c)?.label || c
      ).join(', ');
      errors.push({ 
        row: 1, 
        message: `Colunas obrigatórias não encontradas: ${missing}` 
      });
      return { sessions, payments, errors, warnings };
    }
    
    // Processar linhas de dados
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i] as any[];
      const rowNumber = i + 1; // Linha no Excel (1-indexed)
      
      // Pular linhas vazias
      if (!row || row.every(cell => cell === null || cell === undefined || cell === '')) {
        continue;
      }
      
      // Extrair dados da linha
      const rowData: Record<string, any> = {};
      Object.entries(columnMap).forEach(([colIndex, key]) => {
        rowData[key] = row[parseInt(colIndex)];
      });
      
      // Validar e converter dados
      const session: Partial<SpreadsheetSession> = {};
      let rowHasError = false;
      
      // Cliente nome (obrigatório)
      if (!rowData.cliente_nome || String(rowData.cliente_nome).trim() === '') {
        errors.push({ row: rowNumber, column: 'cliente_nome', message: 'Nome do cliente é obrigatório' });
        rowHasError = true;
      } else {
        session.cliente_nome = String(rowData.cliente_nome).trim();
      }
      
      // Email
      if (rowData.cliente_email) {
        const email = String(rowData.cliente_email).trim().toLowerCase();
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          warnings.push(`Linha ${rowNumber}: Email inválido "${email}"`);
        }
        session.cliente_email = email;
      }
      
      // WhatsApp
      if (rowData.cliente_whatsapp) {
        session.cliente_whatsapp = String(rowData.cliente_whatsapp).replace(/\D/g, '');
      }
      
      // Data da sessão (obrigatório)
      const parsedDate = parseDate(rowData.data_sessao);
      if (!parsedDate) {
        errors.push({ 
          row: rowNumber, 
          column: 'data_sessao', 
          message: `Data inválida: "${rowData.data_sessao}"`,
          value: rowData.data_sessao
        });
        rowHasError = true;
      } else {
        session.data_sessao = parsedDate;
      }
      
      // Hora da sessão (opcional - padrão 00:00)
      const parsedTime = parseTime(rowData.hora_sessao);
      session.hora_sessao = parsedTime || '00:00';
      
      // Categoria (obrigatório)
      if (!rowData.categoria || String(rowData.categoria).trim() === '') {
        errors.push({ row: rowNumber, column: 'categoria', message: 'Categoria é obrigatória' });
        rowHasError = true;
      } else {
        session.categoria = String(rowData.categoria).trim();
      }
      
      // Campos opcionais
      if (rowData.pacote) session.pacote = String(rowData.pacote).trim();
      session.status = normalizeStatus(rowData.status);
      if (rowData.descricao) session.descricao = String(rowData.descricao).trim();
      if (rowData.observacoes) session.observacoes = String(rowData.observacoes).trim();
      if (rowData.detalhes) session.detalhes = String(rowData.detalhes).trim();
      
      // Valores financeiros
      const valorBase = parseMonetaryValue(rowData.valor_base_pacote);
      if (valorBase !== null) session.valor_base_pacote = valorBase;
      
      const valorFotoExtra = parseMonetaryValue(rowData.valor_foto_extra);
      if (valorFotoExtra !== null) session.valor_foto_extra = valorFotoExtra;
      
      const qtdFotosExtra = rowData.qtd_fotos_extra ? parseInt(String(rowData.qtd_fotos_extra)) : null;
      if (qtdFotosExtra !== null && !isNaN(qtdFotosExtra)) session.qtd_fotos_extra = qtdFotosExtra;
      
      const valorTotalFotoExtra = parseMonetaryValue(rowData.valor_total_foto_extra);
      if (valorTotalFotoExtra !== null) session.valor_total_foto_extra = valorTotalFotoExtra;
      
      const valorAdicional = parseMonetaryValue(rowData.valor_adicional);
      if (valorAdicional !== null) session.valor_adicional = valorAdicional;
      
      const desconto = parseMonetaryValue(rowData.desconto);
      if (desconto !== null) session.desconto = desconto;
      
      const valorTotal = parseMonetaryValue(rowData.valor_total);
      if (valorTotal !== null) session.valor_total = valorTotal;
      
      const valorPago = parseMonetaryValue(rowData.valor_pago);
      if (valorPago !== null) session.valor_pago = valorPago;
      
      // Adicionar sessão se não tiver erro crítico
      if (!rowHasError) {
        sessions.push(session as SpreadsheetSession);
      }
    }
    
    // Verificar aba de pagamentos (opcional)
    const paymentsSheet = workbook.Sheets['PAGAMENTOS'] || 
                          workbook.Sheets['Pagamentos'] ||
                          workbook.Sheets['pagamentos'];
    
    if (paymentsSheet) {
      const paymentsData = XLSX.utils.sheet_to_json(paymentsSheet, { header: 1 });
      
      if (paymentsData.length > 1) {
        const paymentHeader = paymentsData[0] as string[];
        const paymentColumnMap: Record<number, string> = {};
        
        paymentHeader.forEach((col, index) => {
          if (col) {
            const normalized = normalizeColumnName(String(col));
            if (['referencia', 'ref', 'session_ref', 'sessao'].includes(normalized)) {
              paymentColumnMap[index] = 'session_ref';
            } else if (['data', 'data_transacao', 'data_pagamento'].includes(normalized)) {
              paymentColumnMap[index] = 'data_transacao';
            } else if (['valor'].includes(normalized)) {
              paymentColumnMap[index] = 'valor';
            } else if (['descricao', 'obs', 'observacoes'].includes(normalized)) {
              paymentColumnMap[index] = 'descricao';
            }
          }
        });
        
        for (let i = 1; i < paymentsData.length; i++) {
          const row = paymentsData[i] as any[];
          const rowNumber = i + 1;
          
          if (!row || row.every(cell => cell === null || cell === undefined || cell === '')) {
            continue;
          }
          
          const paymentData: Record<string, any> = {};
          Object.entries(paymentColumnMap).forEach(([colIndex, key]) => {
            paymentData[key] = row[parseInt(colIndex)];
          });
          
          const payment: Partial<SpreadsheetPayment> = {};
          
          if (paymentData.session_ref) {
            payment.session_ref = String(paymentData.session_ref).trim();
          }
          
          const paymentDate = parseDate(paymentData.data_transacao);
          if (paymentDate) {
            payment.data_transacao = paymentDate;
          }
          
          const paymentValue = parseMonetaryValue(paymentData.valor);
          if (paymentValue !== null) {
            payment.valor = paymentValue;
          }
          
          if (paymentData.descricao) {
            payment.descricao = String(paymentData.descricao).trim();
          }
          
          if (payment.session_ref && payment.data_transacao && payment.valor) {
            payments.push(payment as SpreadsheetPayment);
          }
        }
      }
    }
    
    console.log(`📊 Parse completo: ${sessions.length} sessões, ${payments.length} pagamentos, ${errors.length} erros`);
    
  } catch (error) {
    console.error('Erro ao fazer parse da planilha:', error);
    errors.push({ 
      row: 0, 
      message: `Erro ao ler planilha: ${error instanceof Error ? error.message : 'Erro desconhecido'}` 
    });
  }
  
  return { sessions, payments, errors, warnings };
}

/**
 * Gera um template de planilha para download
 */
export function generateTemplateSpreadsheet(): Blob {
  const workbook = XLSX.utils.book_new();
  
  // Aba de sessões
  const sessionsHeader = EXPECTED_COLUMNS.sessions.map(c => c.label);
  const sessionsExample = [
    'Maria Silva',
    'maria@email.com',
    '11999999999',
    '15/01/2024',
    '14:00',
    'Newborn',
    'Pacote Completo',
    'realizado',
    '1500',
    '50',
    '5',
    '250',
    '100',
    '0',
    '1850',
    '1850',
    'Ensaio newborn com família',
    'Cliente VIP',
    'Preferência: tons pastéis'
  ];
  
  const sessionsData = [sessionsHeader, sessionsExample];
  const sessionsSheet = XLSX.utils.aoa_to_sheet(sessionsData);
  
  // Ajustar largura das colunas
  sessionsSheet['!cols'] = sessionsHeader.map(() => ({ wch: 20 }));
  
  XLSX.utils.book_append_sheet(workbook, sessionsSheet, 'SESSÕES');
  
  // Aba de pagamentos (opcional)
  const paymentsHeader = ['Referência Sessão', 'Data Pagamento', 'Valor', 'Descrição'];
  const paymentsExample = ['1', '10/01/2024', '1000', 'Entrada 50%'];
  const paymentsExample2 = ['1', '20/01/2024', '850', 'Restante'];
  
  const paymentsData = [paymentsHeader, paymentsExample, paymentsExample2];
  const paymentsSheet = XLSX.utils.aoa_to_sheet(paymentsData);
  paymentsSheet['!cols'] = paymentsHeader.map(() => ({ wch: 20 }));
  
  XLSX.utils.book_append_sheet(workbook, paymentsSheet, 'PAGAMENTOS');
  
  // Gerar arquivo
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
