import { FinancialExportData, MONTH_NAMES } from './types';
import { getCompanyInfo, getLogoElement, getTransactionsByGroup } from './pdfCommonHelpers';
import { formatCurrency } from '../financialUtils';
import { formatDateForDisplay, formatDateForPDF, getCurrentDateTimeForPDF } from '../dateUtils';

export const getMonthlyHTML = (data: FinancialExportData): string => {
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
        <p>${period.startDate && period.endDate ? 
          `${formatDateForPDF(period.startDate)} a ${formatDateForPDF(period.endDate)}` : 
          `${monthName} de ${period.year}`}</p>
        <p style="font-size: 0.9em; color: #888;">Gerado em ${getCurrentDateTimeForPDF()}</p>
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
        <p>${profile.empresa || profile.nome} - ${new Date().getFullYear()}</p>
      </div>
    </body>
    </html>
  `;
};
