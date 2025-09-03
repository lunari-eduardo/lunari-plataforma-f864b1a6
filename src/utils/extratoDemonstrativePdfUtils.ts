import { formatCurrency } from './financialUtils';
import { formatDateForDisplay, formatDateForPDF, getCurrentDateTimeForPDF, groupTransactionsByMonth, sortMonthKeys, getMonthNameInPortuguese } from './dateUtils';
import { UserProfile, UserBranding } from '@/types/userProfile';
import { TransacaoComItem } from '@/types/financas';
import html2pdf from 'html2pdf.js';

export interface ExtratoDetalhadoData {
  profile: UserProfile;
  branding: UserBranding;
  transactions: TransacaoComItem[];
  period: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalReceitas: number;
    totalDespesas: number;
    saldoFinal: number;
    transacoesPagas: number;
    transacoesFaturadas: number;
    transacoesAgendadas: number;
  };
}

interface MonthlyGroup {
  monthKey: string;
  monthName: string;
  receitas: TransacaoComItem[];
  despesas: TransacaoComItem[];
  totalReceitas: number;
  totalDespesas: number;
  saldoMes: number;
}

const getExtratoDetalhadoHTML = (data: ExtratoDetalhadoData): string => {
  const { profile, branding, period, transactions, summary } = data;

  // Separar receitas e despesas
  const receitas = transactions.filter(t => t.item.grupo_principal?.includes('Receita'));
  const despesas = transactions.filter(t => !t.item.grupo_principal?.includes('Receita'));

  // Agrupar por mês
  const receitasPorMes = groupTransactionsByMonth(receitas);
  const despesasPorMes = groupTransactionsByMonth(despesas);

  // Obter todos os meses presentes nos dados
  const allMonthKeys = [...new Set([
    ...Object.keys(receitasPorMes),
    ...Object.keys(despesasPorMes)
  ])];
  const sortedMonthKeys = sortMonthKeys(allMonthKeys);

  // Criar grupos mensais
  const monthlyGroups: MonthlyGroup[] = sortedMonthKeys.map(monthKey => {
    const monthReceitas = receitasPorMes[monthKey] || [];
    const monthDespesas = despesasPorMes[monthKey] || [];
    
    const totalReceitas = monthReceitas.reduce((sum, t) => sum + t.valor, 0);
    const totalDespesas = monthDespesas.reduce((sum, t) => sum + t.valor, 0);
    
    return {
      monthKey,
      monthName: getMonthNameInPortuguese(`${monthKey}-01`),
      receitas: monthReceitas,
      despesas: monthDespesas,
      totalReceitas,
      totalDespesas,
      saldoMes: totalReceitas - totalDespesas
    };
  });

  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pago': return 'status-pago';
      case 'faturado': return 'status-faturado';
      case 'agendado': return 'status-agendado';
      default: return 'status-agendado';
    }
  };

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Extrato Financeiro Detalhado</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          font-size: 12px;
          color: #333;
          margin: 40px;
          line-height: 1.4;
        }

        header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #eee;
          padding-bottom: 10px;
          margin-bottom: 20px;
          page-break-after: avoid;
        }

        header img {
          height: 50px;
        }

        .company-info h2 {
          margin: 0 0 5px 0;
          font-size: 16px;
          color: #333;
        }

        .company-info p {
          margin: 2px 0;
          font-size: 11px;
          color: #666;
        }

        .period-info {
          text-align: right;
        }

        .period-info strong {
          font-size: 13px;
          color: #333;
        }

        h1 {
          text-align: center;
          font-size: 20px;
          margin: 20px 0 10px 0;
          color: #333;
          page-break-after: avoid;
        }

        .subtitle {
          text-align: center;
          font-size: 12px;
          color: #666;
          margin-bottom: 30px;
          font-style: italic;
          page-break-after: avoid;
        }

        .month-section {
          margin-bottom: 30px;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .month-header {
          background: #f8f8f8;
          color: #333;
          padding: 12px 15px;
          margin: 0 0 15px 0;
          font-size: 16px;
          font-weight: bold;
          text-align: center;
          border-left: 4px solid #333;
          page-break-after: avoid;
          page-break-inside: avoid;
        }

        .section {
          margin-bottom: 20px;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .section h2 {
          font-size: 14px;
          margin: 0 0 15px 0;
          padding: 8px 12px;
          background-color: #f8f8f8;
          border-left: 4px solid #333;
          color: #333;
          page-break-after: avoid;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 15px;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        th, td {
          padding: 8px 12px;
          border: 1px solid #ddd;
          text-align: left;
          font-size: 11px;
        }

        th {
          background-color: #f8f8f8;
          font-weight: bold;
          font-size: 10px;
          text-transform: uppercase;
        }

        .valor {
          text-align: right;
          font-family: monospace;
          font-weight: bold;
        }

        .status {
          text-align: center;
        }

        .status-badge {
          padding: 3px 8px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .status-pago { background: #d4edda; color: #155724; }
        .status-faturado { background: #fff3cd; color: #856404; }
        .status-agendado { background: #cce5ff; color: #004085; }

        .total-section {
          background-color: #fafafa;
          font-weight: bold;
        }

        .receitas-total {
          background-color: #e8f5e8;
          color: #2d5a2d;
        }

        .despesas-total {
          background-color: #ffe8e8;
          color: #5a2d2d;
        }

        .month-summary {
          margin-top: 15px;
          padding: 15px;
          background-color: #f9f9f9;
          border: 1px solid #ddd;
          border-radius: 4px;
          page-break-inside: avoid;
        }

        .month-summary h3 {
          margin: 0 0 10px 0;
          font-size: 14px;
          color: #333;
        }

        .month-summary-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 15px;
        }

        .month-summary-item {
          text-align: center;
        }

        .month-summary-item .label {
          font-size: 10px;
          color: #666;
          text-transform: uppercase;
        }

        .month-summary-item .value {
          font-size: 13px;
          font-weight: bold;
          font-family: monospace;
          margin-top: 3px;
        }

        .month-summary-item.positive .value { color: #2d5a2d; }
        .month-summary-item.negative .value { color: #5a2d2d; }
        .month-summary-item.neutral .value { color: #333; }

        .resumo-final {
          margin-top: 30px;
          border: 2px solid #333;
          padding: 20px;
          background-color: #f9f9f9;
          page-break-inside: avoid;
        }

        .resumo-final h2 {
          text-align: center;
          margin-top: 0;
          background: none;
          border: none;
          padding: 0;
          font-size: 16px;
        }

        .resumo-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }

        .resumo-item {
          display: flex;
          justify-content: space-between;
          padding: 5px 0;
          border-bottom: 1px solid #ddd;
        }

        .resultado-final {
          text-align: center;
          padding: 15px;
          border: 2px solid #333;
          margin-top: 15px;
          font-size: 14px;
        }

        .resultado-final.positive {
          background-color: #e8f5e8;
          color: #2d5a2d;
          border-color: #4a7c59;
        }

        .resultado-final.negative {
          background-color: #ffe8e8;
          color: #5a2d2d;
          border-color: #c53030;
        }

        .resultado-final .label {
          font-weight: bold;
          margin-bottom: 5px;
        }

        .resultado-final .value {
          font-size: 18px;
          font-weight: bold;
          font-family: monospace;
        }

        .no-items {
          text-align: center;
          color: #666;
          font-style: italic;
          padding: 20px;
        }

        footer {
          position: fixed;
          bottom: 20px;
          left: 40px;
          right: 40px;
          text-align: right;
          font-size: 10px;
          color: #777;
          border-top: 1px solid #eee;
          padding-top: 5px;
        }

        footer img {
          height: 18px;
          vertical-align: middle;
          margin-left: 5px;
          opacity: 0.7;
        }

        @media print {
          body { margin: 20px; }
          footer { position: fixed; }
          .month-section { 
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .section { 
            page-break-inside: avoid;
            break-inside: avoid;
          }
          table { 
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .month-header {
            page-break-after: avoid;
          }
          .section h2 {
            page-break-after: avoid;
          }
        }
      </style>
    </head>
    <body>
      <header>
        <div class="company-info">
          <h2>${profile.nomeEmpresa || profile.nomeCompleto}</h2>
          ${profile.cpfCnpj ? `<p>CNPJ/CPF: ${profile.cpfCnpj}</p>` : ''}
          ${profile.enderecoComercial ? `<p>${profile.enderecoComercial}</p>` : ''}
        </div>
        <div class="period-info">
          <strong>Período:</strong> ${formatDateForPDF(period.startDate)} a ${formatDateForPDF(period.endDate)}<br>
          <strong>Data da emissão:</strong> ${getCurrentDateTimeForPDF()}
        </div>
        ${branding.logoUrl ? `<img src="${branding.logoUrl}" alt="Logo da empresa">` : ''}
      </header>

      <h1>Extrato Financeiro Detalhado</h1>
      <div class="subtitle">Movimentação mensal detalhada por categoria</div>

      ${monthlyGroups.length === 0 ? `
        <div class="no-items">
          Nenhuma transação encontrada no período selecionado.
        </div>
      ` : monthlyGroups.map(month => `
        <div class="month-section">
          <div class="month-header">${month.monthName}</div>
          
          ${month.receitas.length > 0 ? `
            <div class="section">
              <h2>Receitas</h2>
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Categoria</th>
                    <th>Descrição</th>
                    <th>Valor</th>
                    <th>Status</th>
                    <th>Observações</th>
                  </tr>
                </thead>
                <tbody>
                  ${month.receitas.map(t => `
                    <tr>
                      <td>${formatDateForDisplay(t.data_vencimento)}</td>
                      <td>${t.item.grupo_principal}</td>
                      <td>${t.item.nome}</td>
                      <td class="valor">${formatCurrency(t.valor)}</td>
                      <td class="status">
                        <span class="status-badge ${getStatusBadgeClass(t.status)}">${t.status}</span>
                      </td>
                      <td>${t.observacoes || '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
                <tfoot>
                  <tr class="total-section receitas-total">
                    <td colspan="3"><strong>Total Receitas do Mês</strong></td>
                    <td class="valor"><strong>${formatCurrency(month.totalReceitas)}</strong></td>
                    <td colspan="2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ` : ''}

          ${month.despesas.length > 0 ? `
            <div class="section">
              <h2>Despesas</h2>
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Categoria</th>
                    <th>Descrição</th>
                    <th>Valor</th>
                    <th>Status</th>
                    <th>Observações</th>
                  </tr>
                </thead>
                <tbody>
                  ${month.despesas.map(t => `
                    <tr>
                      <td>${formatDateForDisplay(t.data_vencimento)}</td>
                      <td>${t.item.grupo_principal}</td>
                      <td>${t.item.nome}</td>
                      <td class="valor">${formatCurrency(t.valor)}</td>
                      <td class="status">
                        <span class="status-badge ${getStatusBadgeClass(t.status)}">${t.status}</span>
                      </td>
                      <td>${t.observacoes || '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
                <tfoot>
                  <tr class="total-section despesas-total">
                    <td colspan="3"><strong>Total Despesas do Mês</strong></td>
                    <td class="valor"><strong>${formatCurrency(month.totalDespesas)}</strong></td>
                    <td colspan="2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ` : ''}

          <div class="month-summary">
            <h3>Resumo de ${month.monthName}</h3>
            <div class="month-summary-grid">
              <div class="month-summary-item positive">
                <div class="label">Receitas</div>
                <div class="value">${formatCurrency(month.totalReceitas)}</div>
              </div>
              <div class="month-summary-item negative">
                <div class="label">Despesas</div>
                <div class="value">${formatCurrency(month.totalDespesas)}</div>
              </div>
              <div class="month-summary-item ${month.saldoMes >= 0 ? 'positive' : 'negative'}">
                <div class="label">Resultado</div>
                <div class="value">${formatCurrency(month.saldoMes)}</div>
              </div>
            </div>
          </div>
        </div>
      `).join('')}

      <!-- Resumo Final -->
      <div class="resumo-final">
        <h2>Resumo Final do Período</h2>
        
        <div class="resumo-grid">
          <div>
            <div class="resumo-item">
              <span>Receita total</span>
              <span class="valor">${formatCurrency(summary.totalReceitas)}</span>
            </div>
            <div class="resumo-item">
              <span>(-) Total de despesas</span>
              <span class="valor">${formatCurrency(summary.totalDespesas)}</span>
            </div>
          </div>
          
          <div>
            <div class="resumo-item">
              <span>Transações pagas</span>
              <span class="valor">${summary.transacoesPagas}</span>
            </div>
            <div class="resumo-item">
              <span>Transações faturadas</span>
              <span class="valor">${summary.transacoesFaturadas}</span>
            </div>
            <div class="resumo-item">
              <span>Transações agendadas</span>
              <span class="valor">${summary.transacoesAgendadas}</span>
            </div>
          </div>
        </div>
        
        <div class="resultado-final ${summary.saldoFinal >= 0 ? 'positive' : 'negative'}">
          <div class="label">Resultado líquido do período</div>
          <div class="value">${formatCurrency(summary.saldoFinal)}</div>
        </div>
      </div>

      <footer>
        Gerado via Lunari
      </footer>
    </body>
    </html>
  `;
};

export async function generateExtratoDetalhadoPDF(data: ExtratoDetalhadoData): Promise<void> {
  const html = getExtratoDetalhadoHTML(data);
  
  const opt = {
    margin: [0.5, 0.5, 0.8, 0.5],
    filename: `extrato-detalhado-${formatDateForPDF(data.period.startDate).replace(/\//g, '-')}-${formatDateForPDF(data.period.endDate).replace(/\//g, '-')}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { 
      scale: 2, 
      useCORS: true, 
      logging: false,
      allowTaint: true,
      foreignObjectRendering: true
    },
    jsPDF: { 
      unit: 'in', 
      format: 'a4', 
      orientation: 'portrait',
      compress: true
    },
    pagebreak: { 
      mode: ['avoid-all', 'css', 'legacy'],
      before: '.month-section',
      after: '.resumo-final'
    }
  };

  try {
    await html2pdf().set(opt).from(html).save();
  } catch (error) {
    console.error('Erro ao gerar PDF do extrato detalhado:', error);
    throw error;
  }
}