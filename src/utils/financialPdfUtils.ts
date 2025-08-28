import html2pdf from 'html2pdf.js';
import { UserProfile, UserBranding } from '@/types/userProfile';
import { NovaTransacaoFinanceira, TransacaoComItem, GrupoPrincipal } from '@/types/financas';

import { formatCurrency } from './financialUtils';
import { formatDateForDisplay } from './dateUtils';

export interface FinancialExportData {
  profile: UserProfile;
  branding: UserBranding;
  transactions: TransacaoComItem[];
  period: {
    month: number;
    year: number;
    isAnnual?: boolean;
  };
  summary: {
    totalReceitas: number;
    totalDespesas: number;
    saldoFinal: number;
    transacoesPagas: number;
    transacoesFaturadas: number;
    transacoesAgendadas: number;
  };
  // Opcional: mapa de receitas operacionais (Workflow) por mês quando anual
  workflowMonthlyReceita?: Record<number, number>;
}

export interface ExportOptions {
  type: 'monthly' | 'annual';
  period: {
    month?: number;
    year: number;
    startMonth?: number;
    endMonth?: number;
  };
  includeDetails: boolean;
  includeGraphics: boolean;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const getLogoElement = (branding: UserBranding): string => {
  if (!branding.logoUrl) return '';
  return `<img src="${branding.logoUrl}" alt="Logo da empresa" style="max-height: 60px; max-width: 200px; object-fit: contain;">`;
};

const getCompanyInfo = (profile: UserProfile): string => {
  return `
    <div class="company-info">
      <h2 class="company-name">${profile.nomeEmpresa || profile.nomeCompleto}</h2>
      ${profile.cpfCnpj ? `<p class="company-doc">CNPJ/CPF: ${profile.cpfCnpj}</p>` : ''}
      ${profile.enderecoComercial ? `<p class="company-address">${profile.enderecoComercial}</p>` : ''}
      ${profile.emailPrincipal ? `<p class="company-email">${profile.emailPrincipal}</p>` : ''}
    </div>
  `;
};

const getTransactionsByGroup = (transactions: TransacaoComItem[]): Record<GrupoPrincipal, TransacaoComItem[]> => {
  const groups: Record<GrupoPrincipal, TransacaoComItem[]> = {
    'Despesa Fixa': [],
    'Despesa Variável': [],
    'Investimento': [],
    'Receita Não Operacional': []
  };

  transactions.forEach(transaction => {
    const group = transaction.item.grupo_principal;
    if (groups[group]) {
      groups[group].push(transaction);
    }
  });

  return groups;
};

const getMonthlyHTML = (data: FinancialExportData): string => {
  const { profile, branding, transactions, period, summary } = data;
  const monthName = MONTH_NAMES[period.month - 1];
  const transactionsByGroup = getTransactionsByGroup(transactions);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Extrato Financeiro - ${monthName}/${period.year}</title>
      <style>
        body { 
          font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          margin: 0; 
          padding: 24px; 
          color: #1a1a1a; 
          background: #ffffff; 
          line-height: 1.5;
          font-size: 14px;
        }
        .header { 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          border-bottom: 3px solid #2563eb; 
          padding-bottom: 24px; 
          margin-bottom: 36px; 
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          padding: 24px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        .company-info { flex: 1; }
        .company-name { 
          font-size: 2.2em; 
          font-weight: 700; 
          color: #1e40af; 
          margin: 0 0 8px 0; 
          letter-spacing: -0.025em;
        }
        .company-doc, .company-address, .company-email { 
          margin: 4px 0; 
          color: #64748b; 
          font-size: 0.95em; 
          font-weight: 500;
        }
        .logo-container { flex: 0 0 auto; margin-left: 24px; }
        .report-title { 
          text-align: center; 
          margin: 36px 0; 
          padding: 24px;
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          border-radius: 16px;
          border: 1px solid #bfdbfe;
        }
        .report-title h1 { 
          font-size: 2.4em; 
          color: #1e40af; 
          margin: 0; 
          font-weight: 800;
          letter-spacing: -0.025em;
        }
        .report-title p { 
          font-size: 1.2em; 
          color: #475569; 
          margin: 8px 0; 
          font-weight: 600;
        }
        .summary-cards { 
          display: grid; 
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); 
          gap: 24px; 
          margin: 36px 0; 
        }
        .summary-card { 
          background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); 
          border: 2px solid #e2e8f0; 
          border-radius: 16px; 
          padding: 24px; 
          text-align: center; 
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          transition: all 0.2s ease;
        }
        .summary-card h3 { 
          font-size: 0.85em; 
          color: #64748b; 
          margin: 0 0 12px 0; 
          text-transform: uppercase; 
          font-weight: 700;
          letter-spacing: 0.05em;
        }
        .summary-card .value { 
          font-size: 1.8em; 
          font-weight: 800; 
          margin: 0; 
          letter-spacing: -0.025em;
        }
        .summary-card.positive .value { color: #059669; }
        .summary-card.negative .value { color: #dc2626; }
        .summary-card.neutral .value { color: #2563eb; }
        .section { 
          margin: 48px 0; 
          background: #ffffff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          border: 1px solid #f1f5f9;
        }
        .section h2 { 
          font-size: 1.5em; 
          color: #1e40af; 
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          padding: 20px 24px; 
          margin: 0 0 0 0; 
          font-weight: 700;
          border-bottom: 2px solid #e2e8f0;
        }
        .transactions-table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 0;
          font-size: 0.9em;
        }
        .transactions-table th, .transactions-table td { 
          border-bottom: 1px solid #e2e8f0; 
          padding: 16px 20px; 
          text-align: left; 
          border-left: none;
          border-right: none;
        }
        .transactions-table th { 
          background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); 
          font-weight: 700; 
          color: #374151;
          font-size: 0.85em;
          text-transform: uppercase;
          letter-spacing: 0.025em;
        }
        .transactions-table tbody tr:nth-child(even) { 
          background: linear-gradient(135deg, #fafbfc 0%, #f8fafc 100%); 
        }
        .transactions-table tbody tr:hover { 
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); 
        }
        .status-badge { 
          padding: 6px 12px; 
          border-radius: 8px; 
          font-size: 0.8em; 
          font-weight: 600; 
          text-transform: uppercase;
          letter-spacing: 0.025em;
        }
        .status-pago { background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%); color: #166534; border: 1px solid #86efac; }
        .status-faturado { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); color: #92400e; border: 1px solid #fbbf24; }
        .status-agendado { background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%); color: #3730a3; border: 1px solid #a5b4fc; }
        .group-total { 
          font-weight: 700; 
          background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); 
          border-top: 2px solid #cbd5e1;
          font-size: 1.05em;
        }
        .footer { 
          margin-top: 60px; 
          padding-top: 24px; 
          border-top: 2px solid #e2e8f0; 
          text-align: center; 
          color: #64748b; 
          font-size: 0.85em; 
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          padding: 24px;
          border-radius: 12px;
        }
        .no-transactions { 
          text-align: center; 
          color: #64748b; 
          font-style: italic; 
          padding: 40px; 
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border-radius: 12px;
          margin: 24px 0;
        }
        @media print { 
          body { margin: 0; padding: 16px; } 
          .summary-cards { grid-template-columns: repeat(2, 1fr); gap: 16px; } 
          .section { margin: 32px 0; }
          .header { padding: 16px; }
          .report-title { padding: 16px; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        ${getCompanyInfo(profile)}
        <div class="logo-container">
          ${getLogoElement(branding)}
        </div>
      </div>

      <div class="report-title">
        <h1>Extrato Financeiro</h1>
        <p>${monthName} de ${period.year}</p>
        <p style="font-size: 0.9em; color: #888;">Gerado em ${formatDateForDisplay(new Date().toISOString())}</p>
      </div>

      <div class="summary-cards">
        <div class="summary-card positive">
          <h3>Receitas</h3>
          <p class="value">${formatCurrency(summary.totalReceitas)}</p>
        </div>
        <div class="summary-card negative">
          <h3>Despesas</h3>
          <p class="value">${formatCurrency(summary.totalDespesas)}</p>
        </div>
        <div class="summary-card ${summary.saldoFinal >= 0 ? 'positive' : 'negative'}">
          <h3>Saldo Final</h3>
          <p class="value">${formatCurrency(summary.saldoFinal)}</p>
        </div>
        <div class="summary-card neutral">
          <h3>Total de Transações</h3>
          <p class="value">${transactions.length}</p>
        </div>
      </div>

      ${Object.entries(transactionsByGroup).map(([group, groupTransactions]) => {
        if (groupTransactions.length === 0) return '';
        
        const groupTotal = groupTransactions.reduce((sum, t) => sum + t.valor, 0);
        const isExpense = group.includes('Despesa') || group === 'Investimento';
        
        return `
          <div class="section">
            <h2>${group}</h2>
            <table class="transactions-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Observações</th>
                </tr>
              </thead>
              <tbody>
                ${groupTransactions.map(transaction => `
                  <tr>
                    <td>${formatDateForDisplay(transaction.data_vencimento)}</td>
                    <td>${transaction.item.nome}</td>
                    <td style="text-align: right; font-weight: 500;">${formatCurrency(transaction.valor)}</td>
                    <td><span class="status-badge status-${transaction.status.toLowerCase()}">${transaction.status}</span></td>
                    <td>${transaction.observacoes || '-'}</td>
                  </tr>
                `).join('')}
                <tr class="group-total">
                  <td colspan="2">Total ${group}</td>
                  <td style="text-align: right;">${formatCurrency(groupTotal)}</td>
                  <td colspan="2"></td>
                </tr>
              </tbody>
            </table>
          </div>
        `;
      }).join('')}

      <div class="footer">
        <p>Relatório gerado automaticamente pelo sistema de gestão financeira</p>
        <p>${profile.nomeEmpresa || profile.nomeCompleto} - ${new Date().getFullYear()}</p>
      </div>
    </body>
    </html>
  `;
};

const getAnnualHTML = (data: FinancialExportData): string => {
  const { profile, branding, transactions, period, summary } = data;
  
  // Group transactions by month for annual view
  const transactionsByMonth: Record<number, TransacaoComItem[]> = {};
  for (let i = 1; i <= 12; i++) {
    transactionsByMonth[i] = [];
  }
  
  transactions.forEach(transaction => {
    const month = new Date(transaction.data_vencimento).getMonth() + 1;
    if (transactionsByMonth[month]) {
      transactionsByMonth[month].push(transaction);
    }
  });

  const monthlyTotals = Object.entries(transactionsByMonth).map(([month, monthTransactions]) => {
    const receitas = monthTransactions
      .filter(t => t.item.grupo_principal === 'Receita Não Operacional')
      .reduce((sum, t) => sum + t.valor, 0);
    const despesas = monthTransactions
      .filter(t => t.item.grupo_principal !== 'Receita Não Operacional')
      .reduce((sum, t) => sum + t.valor, 0);
    
    return {
      month: parseInt(month),
      monthName: MONTH_NAMES[parseInt(month) - 1],
      receitas,
      despesas,
      saldo: receitas - despesas,
      total: monthTransactions.length
    };
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Relatório Anual - ${period.year}</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; color: #333; background: #fff; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid hsl(var(--primary)); padding-bottom: 20px; margin-bottom: 30px; }
        .company-info { flex: 1; }
        .company-name { font-size: 1.8em; font-weight: bold; color: hsl(var(--primary)); margin: 0 0 5px 0; }
        .company-doc, .company-address, .company-email { margin: 2px 0; color: #666; font-size: 0.9em; }
        .logo-container { flex: 0 0 auto; margin-left: 20px; }
        .report-title { text-align: center; margin: 30px 0; }
        .report-title h1 { font-size: 2.2em; color: hsl(var(--primary)); margin: 0; }
        .report-title p { font-size: 1.1em; color: #666; margin: 5px 0; }
        .annual-summary { background: linear-gradient(135deg, hsl(var(--primary)/0.1), hsl(var(--accent)/0.1)); border-radius: 12px; padding: 30px; margin: 30px 0; text-align: center; }
        .annual-summary h2 { color: hsl(var(--primary)); margin: 0 0 20px 0; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; }
        .summary-item { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
        .summary-item h3 { font-size: 0.9em; color: #666; margin: 0 0 10px 0; text-transform: uppercase; }
        .summary-item .value { font-size: 1.4em; font-weight: bold; margin: 0; }
        .summary-item.positive .value { color: #16a34a; }
        .summary-item.negative .value { color: #dc2626; }
        .summary-item.neutral .value { color: hsl(var(--primary)); }
        .monthly-breakdown { margin: 40px 0; }
        .monthly-breakdown h2 { font-size: 1.4em; color: hsl(var(--primary)); border-bottom: 1px solid hsl(var(--border)); padding-bottom: 10px; margin-bottom: 20px; }
        .monthly-table { width: 100%; border-collapse: collapse; }
        .monthly-table th, .monthly-table td { border: 1px solid hsl(var(--border)); padding: 12px; text-align: left; }
        .monthly-table th { background: hsl(var(--muted)); font-weight: 600; color: hsl(var(--muted-foreground)); text-align: center; }
        .monthly-table tbody tr:nth-child(even) { background: hsl(var(--muted)/0.3); }
        .monthly-table td:not(:first-child) { text-align: right; font-weight: 500; }
        .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid hsl(var(--border)); text-align: center; color: #666; font-size: 0.8em; }
        @media print { body { margin: 0; } .summary-grid { grid-template-columns: repeat(2, 1fr); } }
      </style>
    </head>
    <body>
      <div class="header">
        ${getCompanyInfo(profile)}
        <div class="logo-container">
          ${getLogoElement(branding)}
        </div>
      </div>

      <div class="report-title">
        <h1>Relatório Anual</h1>
        <p>Exercício ${period.year}</p>
        <p style="font-size: 0.9em; color: #888;">Gerado em ${formatDateForDisplay(new Date().toISOString())}</p>
      </div>

      <div class="annual-summary">
        <h2>Resumo do Exercício ${period.year}</h2>
        <div class="summary-grid">
          <div class="summary-item positive">
            <h3>Total de Receitas</h3>
            <p class="value">${formatCurrency(summary.totalReceitas)}</p>
          </div>
          <div class="summary-item negative">
            <h3>Total de Despesas</h3>
            <p class="value">${formatCurrency(summary.totalDespesas)}</p>
          </div>
          <div class="summary-item ${summary.saldoFinal >= 0 ? 'positive' : 'negative'}">
            <h3>Resultado Final</h3>
            <p class="value">${formatCurrency(summary.saldoFinal)}</p>
          </div>
          <div class="summary-item neutral">
            <h3>Total de Transações</h3>
            <p class="value">${transactions.length}</p>
          </div>
          <div class="summary-item neutral">
            <h3>Transações Pagas</h3>
            <p class="value">${summary.transacoesPagas}</p>
          </div>
          <div class="summary-item neutral">
            <h3>Média Mensal</h3>
            <p class="value">${formatCurrency(summary.saldoFinal / 12)}</p>
          </div>
        </div>
      </div>

      <div class="monthly-breakdown">
        <h2>Evolução Mensal</h2>
        <table class="monthly-table">
          <thead>
            <tr>
              <th>Mês</th>
              <th>Receitas</th>
              <th>Despesas</th>
              <th>Saldo</th>
              <th>Transações</th>
            </tr>
          </thead>
          <tbody>
            ${monthlyTotals.map(month => `
              <tr>
                <td style="font-weight: 600;">${month.monthName}</td>
                <td style="color: #16a34a;">${formatCurrency(month.receitas)}</td>
                <td style="color: #dc2626;">${formatCurrency(month.despesas)}</td>
                <td style="color: ${month.saldo >= 0 ? '#16a34a' : '#dc2626'};">${formatCurrency(month.saldo)}</td>
                <td>${month.total}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="footer">
        <p>Relatório gerado automaticamente pelo sistema de gestão financeira</p>
        <p>${profile.nomeEmpresa || profile.nomeCompleto} - ${period.year}</p>
      </div>
    </body>
    </html>
  `;
};

export const generateFinancialPDF = async (data: FinancialExportData, options: ExportOptions): Promise<void> => {
  const isAnnual = options.type === 'annual';
  const html = isAnnual ? getAnnualHTML(data) : getMonthlyHTML(data);
  
  const periodText = isAnnual 
    ? `relatorio-anual-${options.period.year}`
    : `extrato-${String(options.period.month).padStart(2, '0')}-${options.period.year}`;
  
  const filename = `${periodText}-${data.profile.nomeEmpresa || 'financeiro'}.pdf`.replace(/[^a-zA-Z0-9-_]/g, '-');

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
    await html2pdf().set(pdfOptions).from(html).save();
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    throw new Error('Falha na geração do PDF. Tente novamente.');
  }
};

export const previewFinancialHTML = (data: FinancialExportData, options: ExportOptions): string => {
  return options.type === 'annual' ? getAnnualHTML(data) : getMonthlyHTML(data);
};
