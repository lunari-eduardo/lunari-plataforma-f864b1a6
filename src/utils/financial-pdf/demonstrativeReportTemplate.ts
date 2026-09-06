import { DemonstrativeExportData } from './types';
import { getCompanyInfo, getLogoElement } from './pdfCommonHelpers';
import { formatCurrency } from '../financialUtils';
import { formatDateForDisplay } from '../dateUtils';

export const getDemonstrativeHTML = (data: DemonstrativeExportData): string => {
  const { profile, branding, period, demonstrativo } = data;
  const { receitas, despesas, resumoFinal } = demonstrativo;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Demonstrativo Financeiro</title>
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
        .content { 
          display: grid; 
          grid-template-columns: 1fr 1fr; 
          gap: 32px; 
          margin: 36px 0; 
        }
        .section { 
          background: #ffffff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          border: 1px solid #f1f5f9;
        }
        .section h2 { 
          font-size: 1.3em; 
          color: #1e40af; 
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          padding: 20px 24px; 
          margin: 0; 
          font-weight: 700;
          border-bottom: 2px solid #e2e8f0;
          display: flex;
          align-items: center;
        }
        .section-content { 
          padding: 24px; 
        }
        .receita-item, .despesa-item { 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          padding: 12px 0; 
          border-bottom: 1px solid #f1f5f9;
        }
        .receita-item:last-child, .despesa-item:last-child { 
          border-bottom: none; 
        }
        .receita-item .label { 
          color: #64748b; 
          font-size: 0.9em; 
        }
        .receita-item .value { 
          font-weight: 600; 
          color: #059669; 
        }
        .total-receitas { 
          background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%); 
          border-radius: 8px; 
          padding: 16px; 
          margin-top: 16px;
        }
        .total-receitas .label { 
          font-weight: 700; 
          color: #166534; 
        }
        .total-receitas .value { 
          font-weight: 800; 
          font-size: 1.2em; 
          color: #059669; 
        }
        .categoria-despesa { 
          margin-bottom: 20px; 
          padding-bottom: 16px; 
          border-bottom: 1px solid #e2e8f0;
        }
        .categoria-despesa:last-child { 
          border-bottom: none; 
          margin-bottom: 0; 
        }
        .categoria-title { 
          font-weight: 600; 
          color: #374151; 
          margin-bottom: 12px; 
          padding-bottom: 8px; 
          border-bottom: 1px solid #f1f5f9;
          font-size: 0.9em;
        }
        .categoria-item { 
          display: flex; 
          justify-content: space-between; 
          padding: 6px 0 6px 16px; 
          color: #64748b; 
          font-size: 0.85em; 
        }
        .categoria-item .value { 
          font-weight: 500; 
          color: #dc2626; 
        }
        .categoria-total { 
          display: flex; 
          justify-content: space-between; 
          padding: 8px 0 8px 16px; 
          border-top: 1px solid #f1f5f9; 
          margin-top: 8px;
          font-weight: 600;
        }
        .categoria-total .value { 
          color: #dc2626; 
        }
        .total-despesas { 
          background: linear-gradient(135deg, #fef2f2 0%, #fecaca 100%); 
          border-radius: 8px; 
          padding: 16px; 
          margin-top: 16px;
        }
        .total-despesas .label { 
          font-weight: 700; 
          color: #991b1b; 
        }
        .total-despesas .value { 
          font-weight: 800; 
          font-size: 1.2em; 
          color: #dc2626; 
        }
        .resumo-final { 
          grid-column: 1 / -1; 
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border-radius: 12px;
          padding: 32px;
          margin-top: 32px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.06);
        }
        .resumo-final h2 { 
          font-size: 1.5em; 
          color: #1e40af; 
          margin: 0 0 24px 0; 
          text-align: center;
        }
        .resumo-grid { 
          display: grid; 
          grid-template-columns: 1fr 1fr; 
          gap: 24px; 
          margin-bottom: 24px;
        }
        .resumo-item { 
          display: flex; 
          justify-content: space-between; 
          padding: 12px 0;
        }
        .resumo-item .label { 
          color: #475569; 
          font-size: 0.95em; 
        }
        .resumo-item .value { 
          font-weight: 600; 
        }
        .resumo-item.receita .value { 
          color: #059669; 
        }
        .resumo-item.despesa .value { 
          color: #dc2626; 
        }
        .resumo-item.margem .value { 
          color: #2563eb; 
        }
        .resultado-final { 
          background: #ffffff; 
          border-radius: 12px; 
          padding: 24px; 
          text-align: center; 
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        .resultado-final .label { 
          font-size: 1.1em; 
          font-weight: 700; 
          color: #374151; 
          margin-bottom: 8px;
        }
        .resultado-final .value { 
          font-size: 2em; 
          font-weight: 800; 
          letter-spacing: -0.025em;
        }
        .resultado-final.positive .value { 
          color: #059669; 
        }
        .resultado-final.negative .value { 
          color: #dc2626; 
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
        @media print { 
          body { margin: 0; padding: 16px; } 
          .content { grid-template-columns: 1fr; gap: 20px; } 
          .header { padding: 16px; }
          .report-title { padding: 16px; }
          .resumo-final { padding: 20px; }
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
        <h1>Demonstrativo Financeiro</h1>
        <p>${new Date(period.startDate).toLocaleDateString('pt-BR')} a ${new Date(period.endDate).toLocaleDateString('pt-BR')}</p>
        <p style="font-size: 0.9em; color: #888;">Gerado em ${formatDateForDisplay(new Date().toISOString())}</p>
      </div>

      <div class="content">
        <!-- Seção de Receitas -->
        <div class="section">
          <h2>
            📈 Receitas
          </h2>
          <div class="section-content">
            <div class="receita-item">
              <span class="label">Receita com sessões</span>
              <span class="value">${formatCurrency(receitas.sessoes)}</span>
            </div>
            <div class="receita-item">
              <span class="label">Receita com produtos</span>
              <span class="value">${formatCurrency(receitas.produtos)}</span>
            </div>
            <div class="receita-item">
              <span class="label">Receitas não operacionais</span>
              <span class="value">${formatCurrency(receitas.naoOperacionais)}</span>
            </div>
            
            <div class="total-receitas">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="label">Total de Receitas</span>
                <span class="value">${formatCurrency(receitas.totalReceitas)}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Seção de Despesas -->
        <div class="section">
          <h2>
            📉 Despesas
          </h2>
          <div class="section-content">
            ${despesas.categorias.map(categoria => `
              <div class="categoria-despesa">
                <div class="categoria-title">${categoria.grupo}</div>
                ${categoria.itens.map(item => `
                  <div class="categoria-item">
                    <span class="label">${item.nome}</span>
                    <span class="value">${formatCurrency(item.valor)}</span>
                  </div>
                `).join('')}
                <div class="categoria-total">
                  <span class="label">Total ${categoria.grupo}</span>
                  <span class="value">${formatCurrency(categoria.total)}</span>
                </div>
              </div>
            `).join('')}
            
            <div class="total-despesas">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="label">Total de Despesas</span>
                <span class="value">${formatCurrency(despesas.totalDespesas)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Resumo Final -->
      <div class="resumo-final">
        <h2>💰 Resumo Final</h2>
        
        <div class="resumo-grid">
          <div>
            <div class="resumo-item receita">
              <span class="label">Receita total</span>
              <span class="value">${formatCurrency(resumoFinal.receitaTotal)}</span>
            </div>
            <div class="resumo-item despesa">
              <span class="label">(-) Total de despesas</span>
              <span class="value">${formatCurrency(resumoFinal.despesaTotal)}</span>
            </div>
          </div>
          
          <div>
            <div class="resumo-item margem">
              <span class="label">📊 Margem líquida</span>
              <span class="value">${resumoFinal.margemLiquida.toFixed(1)}%</span>
            </div>
          </div>
        </div>
        
        <div class="resultado-final ${resumoFinal.resultadoLiquido >= 0 ? 'positive' : 'negative'}">
          <div class="label">= Resultado líquido do período</div>
          <div class="value">${formatCurrency(resumoFinal.resultadoLiquido)}</div>
        </div>
      </div>

      <div class="footer">
        <p>Demonstrativo gerado automaticamente pelo sistema de gestão financeira</p>
        <p>${profile.empresa || profile.nome} - ${new Date().getFullYear()}</p>
      </div>
    </body>
    </html>
  `;
};
