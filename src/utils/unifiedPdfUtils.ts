import { formatCurrency } from './financialUtils';
import { formatDateForDisplay, formatDateForPDF, getCurrentDateTimeForPDF } from './dateUtils';
import { UserProfile } from '@/services/ProfileService';
import { UserBranding } from '@/types/userProfile';
import { TransacaoComItem } from '@/types/financas';
import html2pdf from 'html2pdf.js';

export interface UnifiedExtratoData {
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

const getExtratoHTML = (data: UnifiedExtratoData): string => {
  const { profile, branding, period, transactions, summary } = data;

  // Agrupar transações por seção
  const receitas = {
    operacionais: transactions.filter(t => t.item.grupo_principal === 'Receita Operacional'),
    naoOperacionais: transactions.filter(t => t.item.grupo_principal === 'Receita Não Operacional')
  };

  const despesas = {
    fixas: transactions.filter(t => t.item.grupo_principal === 'Despesa Fixa'),
    variaveis: transactions.filter(t => t.item.grupo_principal === 'Despesa Variável'),
    investimentos: transactions.filter(t => t.item.grupo_principal === 'Investimento')
  };

  // Calcular totais
  const totaisReceitas = {
    operacionais: receitas.operacionais.reduce((sum, t) => sum + t.valor, 0),
    naoOperacionais: receitas.naoOperacionais.reduce((sum, t) => sum + t.valor, 0)
  };

  const totaisDespesas = {
    fixas: despesas.fixas.reduce((sum, t) => sum + t.valor, 0),
    variaveis: despesas.variaveis.reduce((sum, t) => sum + t.valor, 0),
    investimentos: despesas.investimentos.reduce((sum, t) => sum + t.valor, 0)
  };

  const totalReceitasGeral = totaisReceitas.operacionais + totaisReceitas.naoOperacionais;
  const totalDespesasGeral = totaisDespesas.fixas + totaisDespesas.variaveis + totaisDespesas.investimentos;

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
        }

        header img {
          height: 50px;
        }

        .company-info h2 {
          margin: 0 0 5px 0;
          font-size: 18px;
          color: #2c3e50;
        }

        .company-info p {
          margin: 2px 0;
          color: #7f8c8d;
          font-size: 11px;
        }

        .period-info {
          text-align: center;
          font-size: 11px;
          color: #7f8c8d;
        }

        .report-title {
          text-align: center;
          margin: 20px 0;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .report-title h1 {
          margin: 0;
          font-size: 22px;
          color: #2c3e50;
          font-weight: bold;
        }

        .summary-cards {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          margin: 25px 0;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .summary-card {
          flex: 1;
          text-align: center;
          background: white;
          padding: 15px;
          border-radius: 6px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .summary-card h3 {
          margin: 0 0 8px 0;
          font-size: 11px;
          color: #7f8c8d;
          text-transform: uppercase;
          font-weight: 600;
        }

        .summary-card .value {
          margin: 0;
          font-size: 16px;
          font-weight: bold;
        }

        .summary-card.positive .value { color: #27ae60; }
        .summary-card.negative .value { color: #e74c3c; }
        .summary-card.neutral .value { color: #3498db; }

        .section {
          margin: 25px 0;
          page-break-inside: avoid;
        }

        .section h2 {
          background: #34495e;
          color: white;
          padding: 10px 15px;
          margin: 0 0 15px 0;
          font-size: 14px;
          font-weight: bold;
          border-radius: 4px;
        }

        .subsection {
          margin: 15px 0;
        }

        .subsection h3 {
          background: #ecf0f1;
          color: #2c3e50;
          padding: 8px 12px;
          margin: 0 0 10px 0;
          font-size: 12px;
          font-weight: 600;
          border-left: 4px solid #3498db;
        }

        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 15px;
        }

        .items-table th,
        .items-table td {
          padding: 8px 12px;
          text-align: left;
          border-bottom: 1px solid #ddd;
        }

        .items-table th {
          background: #f8f9fa;
          font-weight: 600;
          font-size: 11px;
          color: #2c3e50;
          text-transform: uppercase;
        }

        .items-table tr:nth-child(even) {
          background: #f9f9f9;
        }

        .items-table .currency {
          text-align: right;
          font-weight: 500;
        }

        .items-table .status {
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

        .subsection-total {
          text-align: right;
          font-weight: bold;
          padding: 8px 12px;
          background: #e8f4f8;
          border-top: 2px solid #3498db;
        }

        .section-total {
          text-align: right;
          font-weight: bold;
          font-size: 14px;
          padding: 12px 15px;
          background: #2c3e50;
          color: white;
          margin-top: 10px;
        }

        .final-summary {
          margin: 30px 0;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 8px;
          border-left: 5px solid #2c3e50;
        }

        .final-summary h2 {
          margin: 0 0 15px 0;
          color: #2c3e50;
          font-size: 16px;
        }

        .final-summary table {
          width: 100%;
        }

        .final-summary td {
          padding: 8px 0;
          border-bottom: 1px solid #ddd;
        }

        .final-summary .label {
          font-weight: 600;
          width: 70%;
        }

        .final-summary .amount {
          text-align: right;
          font-weight: bold;
          width: 30%;
        }

        .final-summary .total-row {
          border-top: 2px solid #2c3e50;
          font-size: 14px;
        }

        .final-summary .total-row.positive { color: #27ae60; }
        .final-summary .total-row.negative { color: #e74c3c; }

        .no-items {
          text-align: center;
          color: #7f8c8d;
          font-style: italic;
          padding: 20px;
        }

        @media print {
          body { margin: 20px; }
          .section { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <header>
        <div class="company-info">
          <h2>${profile.empresa || profile.nome}</h2>
          ${profile.cpf_cnpj ? `<p>CNPJ/CPF: ${profile.cpf_cnpj}</p>` : ''}
          ${profile.endereco_comercial ? `<p>${profile.endereco_comercial}</p>` : ''}
        </div>
        <div class="period-info">
          <strong>Período:</strong> ${formatDateForPDF(period.startDate)} a ${formatDateForPDF(period.endDate)}<br>
          <strong>Data da emissão:</strong> ${getCurrentDateTimeForPDF()}
        </div>
        ${branding.logoUrl ? `<img src="${branding.logoUrl}" alt="Logo da empresa">` : ''}
      </header>

      <div class="report-title">
        <h1>Extrato Financeiro Detalhado</h1>
      </div>

      <div class="summary-cards">
        <div class="summary-card positive">
          <h3>Total de Receitas</h3>
          <p class="value">${formatCurrency(totalReceitasGeral)}</p>
        </div>
        <div class="summary-card negative">
          <h3>Total de Despesas</h3>
          <p class="value">${formatCurrency(totalDespesasGeral)}</p>
        </div>
        <div class="summary-card ${totalReceitasGeral - totalDespesasGeral >= 0 ? 'positive' : 'negative'}">
          <h3>Resultado Líquido</h3>
          <p class="value">${formatCurrency(totalReceitasGeral - totalDespesasGeral)}</p>
        </div>
        <div class="summary-card neutral">
          <h3>Total de Transações</h3>
          <p class="value">${transactions.length}</p>
        </div>
      </div>

      <!-- RECEITAS -->
      ${totalReceitasGeral > 0 ? `
        <div class="section">
          <h2>💰 RECEITAS</h2>
          
          ${receitas.operacionais.length > 0 ? `
            <div class="subsection">
              <h3>Receitas Operacionais (Sessões/Serviços)</h3>
              <table class="items-table">
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
                  ${receitas.operacionais.map(t => `
                    <tr>
                      <td>${formatDateForDisplay(t.data_vencimento)}</td>
                      <td>${t.item.nome}</td>
                      <td class="currency">${formatCurrency(t.valor)}</td>
                      <td class="status">
                        <span class="status-badge status-${t.status.toLowerCase()}">${t.status}</span>
                      </td>
                      <td>${t.observacoes || '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              <div class="subsection-total">
                Subtotal Receitas Operacionais: ${formatCurrency(totaisReceitas.operacionais)}
              </div>
            </div>
          ` : ''}

          ${receitas.naoOperacionais.length > 0 ? `
            <div class="subsection">
              <h3>Receitas Não Operacionais</h3>
              <table class="items-table">
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
                  ${receitas.naoOperacionais.map(t => `
                    <tr>
                      <td>${formatDateForDisplay(t.data_vencimento)}</td>
                      <td>${t.item.nome}</td>
                      <td class="currency">${formatCurrency(t.valor)}</td>
                      <td class="status">
                        <span class="status-badge status-${t.status.toLowerCase()}">${t.status}</span>
                      </td>
                      <td>${t.observacoes || '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              <div class="subsection-total">
                Subtotal Receitas Não Operacionais: ${formatCurrency(totaisReceitas.naoOperacionais)}
              </div>
            </div>
          ` : ''}

          <div class="section-total">
            TOTAL RECEITAS: ${formatCurrency(totalReceitasGeral)}
          </div>
        </div>
      ` : ''}

      <!-- DESPESAS -->
      ${totalDespesasGeral > 0 ? `
        <div class="section">
          <h2>💸 DESPESAS</h2>
          
          ${despesas.fixas.length > 0 ? `
            <div class="subsection">
              <h3>Despesas Fixas</h3>
              <table class="items-table">
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
                  ${despesas.fixas.map(t => `
                    <tr>
                      <td>${formatDateForDisplay(t.data_vencimento)}</td>
                      <td>${t.item.nome}</td>
                      <td class="currency">${formatCurrency(t.valor)}</td>
                      <td class="status">
                        <span class="status-badge status-${t.status.toLowerCase()}">${t.status}</span>
                      </td>
                      <td>${t.observacoes || '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              <div class="subsection-total">
                Subtotal Despesas Fixas: ${formatCurrency(totaisDespesas.fixas)}
              </div>
            </div>
          ` : ''}

          ${despesas.variaveis.length > 0 ? `
            <div class="subsection">
              <h3>Despesas Variáveis</h3>
              <table class="items-table">
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
                  ${despesas.variaveis.map(t => `
                    <tr>
                      <td>${formatDateForDisplay(t.data_vencimento)}</td>
                      <td>${t.item.nome}</td>
                      <td class="currency">${formatCurrency(t.valor)}</td>
                      <td class="status">
                        <span class="status-badge status-${t.status.toLowerCase()}">${t.status}</span>
                      </td>
                      <td>${t.observacoes || '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              <div class="subsection-total">
                Subtotal Despesas Variáveis: ${formatCurrency(totaisDespesas.variaveis)}
              </div>
            </div>
          ` : ''}

          ${despesas.investimentos.length > 0 ? `
            <div class="subsection">
              <h3>Investimentos</h3>
              <table class="items-table">
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
                  ${despesas.investimentos.map(t => `
                    <tr>
                      <td>${formatDateForDisplay(t.data_vencimento)}</td>
                      <td>${t.item.nome}</td>
                      <td class="currency">${formatCurrency(t.valor)}</td>
                      <td class="status">
                        <span class="status-badge status-${t.status.toLowerCase()}">${t.status}</span>
                      </td>
                      <td>${t.observacoes || '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              <div class="subsection-total">
                Subtotal Investimentos: ${formatCurrency(totaisDespesas.investimentos)}
              </div>
            </div>
          ` : ''}

          <div class="section-total">
            TOTAL DESPESAS: ${formatCurrency(totalDespesasGeral)}
          </div>
        </div>
      ` : ''}

      <!-- RESUMO FINAL -->
      <div class="final-summary">
        <h2>📊 Resumo Final</h2>
        <table>
          <tr>
            <td class="label">Total de Receitas:</td>
            <td class="amount">${formatCurrency(totalReceitasGeral)}</td>
          </tr>
          <tr>
            <td class="label">(-) Total de Despesas:</td>
            <td class="amount">${formatCurrency(totalDespesasGeral)}</td>
          </tr>
          <tr class="total-row ${totalReceitasGeral - totalDespesasGeral >= 0 ? 'positive' : 'negative'}">
            <td class="label"><strong>Resultado Líquido:</strong></td>
            <td class="amount"><strong>${formatCurrency(totalReceitasGeral - totalDespesasGeral)}</strong></td>
          </tr>
          <tr>
            <td class="label">Margem Líquida:</td>
            <td class="amount">${totalReceitasGeral > 0 ? (((totalReceitasGeral - totalDespesasGeral) / totalReceitasGeral) * 100).toFixed(1) : '0.0'}%</td>
          </tr>
        </table>
      </div>

      <footer style="margin-top: 40px; padding-top: 15px; border-top: 1px solid #ddd; text-align: center; color: #7f8c8d; font-size: 10px;">
        <p>Relatório gerado automaticamente pelo sistema de gestão financeira em ${getCurrentDateTimeForPDF()}</p>
        <p>${profile.empresa || profile.nome} - Extrato Financeiro</p>
      </footer>
    </body>
    </html>
  `;
};

export async function generateUnifiedExtratoFDF(data: UnifiedExtratoData): Promise<void> {
  const htmlContent = getExtratoHTML(data);
  
  const opt = {
    margin: [0.5, 0.5, 0.5, 0.5],
    filename: `extrato-financeiro-${formatDateForPDF(data.period.startDate).replace(/\//g, '-')}-${formatDateForPDF(data.period.endDate).replace(/\//g, '-')}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { 
      scale: 2, 
      useCORS: true, 
      logging: false,
      letterRendering: true,
      allowTaint: false
    },
    jsPDF: { 
      unit: 'in', 
      format: 'a4', 
      orientation: 'portrait',
      compress: true
    }
  };

  await html2pdf().set(opt).from(htmlContent).save();
}