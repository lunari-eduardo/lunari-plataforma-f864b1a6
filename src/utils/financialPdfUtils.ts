import html2pdf from 'html2pdf.js';
import {
  FinancialExportData,
  ExportOptions,
  DemonstrativeExportData,
  MONTH_NAMES,
} from './financial-pdf/types';

import {
  getCompanyInfo,
  getLogoElement,
  getTransactionsByGroup,
} from './financial-pdf/pdfCommonHelpers';

import { getMonthlyHTML } from './financial-pdf/monthlyReportTemplate';
import { getAnnualHTML } from './financial-pdf/annualReportTemplate';
import { getDemonstrativeHTML } from './financial-pdf/demonstrativeReportTemplate';

export type {
  FinancialExportData,
  ExportOptions,
  DemonstrativeExportData,
};

export {
  MONTH_NAMES,
  getCompanyInfo,
  getLogoElement,
  getTransactionsByGroup,
  getMonthlyHTML,
  getAnnualHTML,
  getDemonstrativeHTML,
};

export const generateFinancialPDF = async (data: FinancialExportData, options: ExportOptions): Promise<void> => {
  const isAnnual = options.type === 'annual';
  const html = isAnnual ? getAnnualHTML(data) : getMonthlyHTML(data);
  
  const periodText = isAnnual 
    ? `relatorio-anual-${options.period.year}`
    : `extrato-${String(options.period.month).padStart(2, '0')}-${options.period.year}`;
  
  const filename = `${periodText}-${data.profile.empresa || 'financeiro'}.pdf`.replace(/[^a-zA-Z0-9-_]/g, '-');

  const pdfOptions = {
    margin: 8,
    filename: filename,
    image: { type: 'jpeg', quality: 1.0 },
    html2canvas: { 
      scale: 3,
      useCORS: true,
      letterRendering: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      width: 794,
      height: 1123
    },
    jsPDF: { 
      unit: 'mm', 
      format: 'a4', 
      orientation: 'portrait',
      compress: true
    }
  };

  try {
    await html2pdf().set(pdfOptions as any).from(html).save();
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    throw new Error('Falha na geração do PDF. Tente novamente.');
  }
};

export const previewFinancialHTML = (data: FinancialExportData, options: ExportOptions): string => {
  return options.type === 'annual' ? getAnnualHTML(data) : getMonthlyHTML(data);
};

export async function generateDemonstrativePDF(data: DemonstrativeExportData): Promise<void> {
  const html = getDemonstrativeHTML(data);
  
  const opt = {
    margin: [0.5, 0.5, 0.5, 0.5],
    filename: `demonstrativo-financeiro-${new Date(data.period.startDate).toLocaleDateString('pt-BR').replace(/\//g, '-')}-${new Date(data.period.endDate).toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
  };

  try {
    await html2pdf().set(opt as any).from(html).save();
  } catch (error) {
    console.error('Erro ao gerar PDF do demonstrativo:', error);
    throw error;
  }
}
