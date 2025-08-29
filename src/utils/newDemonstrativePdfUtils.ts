import { formatCurrency } from './financialUtils';
import { formatDateForDisplay } from './dateUtils';
import { UserProfile, UserBranding } from '@/types/userProfile';
import { DemonstrativoSimplificado } from '@/types/extrato';
import html2pdf from 'html2pdf.js';

export interface DemonstrativeExportData {
  profile: UserProfile;
  branding: UserBranding;
  period: {
    startDate: string;
    endDate: string;
  };
  demonstrativo: DemonstrativoSimplificado;
}

const getDemonstrativeHTML = (data: DemonstrativeExportData): string => {
  const { profile, branding, period, demonstrativo } = data;
  const { receitas, despesas, resumoFinal } = demonstrativo;

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Demonstrativo Financeiro</title>
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
        }

        .subtitle {
          text-align: center;
          font-size: 12px;
          color: #666;
          margin-bottom: 30px;
          font-style: italic;
        }

        .section {
          margin-bottom: 25px;
        }

        .section h2 {
          font-size: 14px;
          margin: 0 0 15px 0;
          padding: 8px 12px;
          background-color: #f8f8f8;
          border-left: 4px solid #333;
          color: #333;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 15px;
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

        .resumo-final {
          margin-top: 30px;
          border: 2px solid #333;
          padding: 20px;
          background-color: #f9f9f9;
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
          <strong>Período:</strong> ${new Date(period.startDate).toLocaleDateString('pt-BR')} a ${new Date(period.endDate).toLocaleDateString('pt-BR')}<br>
          <strong>Data da emissão:</strong> ${new Date().toLocaleDateString('pt-BR')}
        </div>
        ${branding.logoUrl ? `<img src="${branding.logoUrl}" alt="Logo da empresa">` : ''}
      </header>

      <h1>Demonstrativo Financeiro</h1>
      <div class="subtitle">Resumo categorizado para análise contábil</div>

      <!-- Seção de Receitas -->
      <div class="section">
        <h2>Receitas</h2>
        <table>
          <thead>
            <tr>
              <th>Categoria</th>
              <th>Descrição</th>
              <th>Valor (R$)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Receitas Operacionais</td>
              <td>Receita com sessões</td>
              <td class="valor">${formatCurrency(receitas.sessoes)}</td>
            </tr>
            <tr>
              <td>Receitas Operacionais</td>
              <td>Receita com produtos</td>
              <td class="valor">${formatCurrency(receitas.produtos)}</td>
            </tr>
            <tr>
              <td>Receitas Não Operacionais</td>
              <td>Receitas não operacionais</td>
              <td class="valor">${formatCurrency(receitas.naoOperacionais)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="total-section receitas-total">
              <td colspan="2"><strong>Total de Receitas</strong></td>
              <td class="valor"><strong>${formatCurrency(receitas.totalReceitas)}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Seção de Despesas -->
      <div class="section">
        <h2>Despesas</h2>
        <table>
          <thead>
            <tr>
              <th>Categoria</th>
              <th>Descrição</th>
              <th>Valor (R$)</th>
            </tr>
          </thead>
          <tbody>
            ${despesas.categorias.map(categoria => 
              categoria.itens.map((item, index) => `
                <tr>
                  <td>${index === 0 ? categoria.grupo : ''}</td>
                  <td>${item.nome}</td>
                  <td class="valor">${formatCurrency(item.valor)}</td>
                </tr>
              `).join('') +
              `<tr class="total-section">
                <td colspan="2"><strong>Total ${categoria.grupo}</strong></td>
                <td class="valor"><strong>${formatCurrency(categoria.total)}</strong></td>
              </tr>`
            ).join('')}
          </tbody>
          <tfoot>
            <tr class="total-section despesas-total">
              <td colspan="2"><strong>Total de Despesas</strong></td>
              <td class="valor"><strong>${formatCurrency(despesas.totalDespesas)}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Resumo Final -->
      <div class="resumo-final">
        <h2>Resumo Final</h2>
        
        <div class="resumo-grid">
          <div>
            <div class="resumo-item">
              <span>Receita total</span>
              <span class="valor">${formatCurrency(resumoFinal.receitaTotal)}</span>
            </div>
            <div class="resumo-item">
              <span>(-) Total de despesas</span>
              <span class="valor">${formatCurrency(resumoFinal.despesaTotal)}</span>
            </div>
          </div>
          
          <div>
            <div class="resumo-item">
              <span>Margem líquida (%)</span>
              <span class="valor">${resumoFinal.margemLiquida.toFixed(1)}%</span>
            </div>
          </div>
        </div>
        
        <div class="resultado-final ${resumoFinal.resultadoLiquido >= 0 ? 'positive' : 'negative'}">
          <div class="label">Resultado líquido do período</div>
          <div class="value">${formatCurrency(resumoFinal.resultadoLiquido)}</div>
        </div>
      </div>

      <footer>
        Gerado via Lunari
      </footer>
    </body>
    </html>
  `;
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
    await html2pdf().set(opt).from(html).save();
  } catch (error) {
    console.error('Erro ao gerar PDF do demonstrativo:', error);
    throw error;
  }
}