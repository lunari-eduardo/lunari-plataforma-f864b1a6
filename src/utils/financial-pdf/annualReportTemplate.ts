import { FinancialExportData, MONTH_NAMES } from './types';
import { getCompanyInfo, getLogoElement } from './pdfCommonHelpers';
import { formatCurrency } from '../financialUtils';
import { getCurrentDateTimeForPDF } from '../dateUtils';
import { TransacaoComItem } from '@/types/financas';

export const getAnnualHTML = (data: FinancialExportData): string => {
  const { profile, branding, transactions, period, summary } = data;
  
  // Group transactions by month for annual view
  const transactionsByMonth: Record<number, TransacaoComItem[]> = {};
  for (let i = 1; i <= 12; i++) {
    transactionsByMonth[i] = [];
  }
  
  transactions.forEach(transaction => {
    const dateString = transaction.data_vencimento;
    if (dateString && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [, month] = dateString.split('-').map(Number);
      if (transactionsByMonth[month]) {
        transactionsByMonth[month].push(transaction);
      }
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
        <p style="font-size: 0.9em; color: #888;">Gerado em ${getCurrentDateTimeForPDF()}</p>
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
        <p>${profile.empresa || profile.nome} - ${period.year}</p>
      </div>
    </body>
    </html>
  `;
};
