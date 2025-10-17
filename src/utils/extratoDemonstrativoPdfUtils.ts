import { formatCurrency } from './financialUtils';
import { formatDateForDisplay, formatDateForPDF, getCurrentDateTimeForPDF, groupTransactionsByMonth, sortMonthKeys, getMonthNameInPortuguese } from './dateUtils';
import { UserProfile } from '@/services/ProfileService';
import { UserBranding } from '@/types/userProfile';
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

  console.log('🔍 [HTML Debug] Gerando HTML para PDF:', {
    transactionsTotal: transactions.length,
    profile: profile?.empresa || profile?.nome,
    period: period
  });

  const receitas = transactions.filter(t => {
    const isReceita = t.item.grupo_principal === 'Receita Operacional' || 
                     t.item.grupo_principal === 'Receita Não Operacional';
    return isReceita;
  });
  
  const despesas = transactions.filter(t => {
    const isDespesa = t.item.grupo_principal === 'Despesa Fixa' || 
                     t.item.grupo_principal === 'Despesa Variável' ||
                     t.item.grupo_principal === 'Investimento';
    return isDespesa;
  });

  const receitasValidas = receitas.filter(r => r.data_vencimento && r.data_vencimento.match(/^\d{4}-\d{2}-\d{2}$/));
  const despesasValidas = despesas.filter(d => d.data_vencimento && d.data_vencimento.match(/^\d{4}-\d{2}-\d{2}$/));

  const receitasPorMes = groupTransactionsByMonth(receitasValidas);
  const despesasPorMes = groupTransactionsByMonth(despesasValidas);

  const allMonthKeys = new Set([...Object.keys(receitasPorMes), ...Object.keys(despesasPorMes)]);
  const sortedMonthKeys = sortMonthKeys(Array.from(allMonthKeys));

  const monthlyGroups: MonthlyGroup[] = sortedMonthKeys.map(monthKey => {
    const monthReceitas = receitasPorMes[monthKey] || [];
    const monthDespesas = despesasPorMes[monthKey] || [];
    
    return {
      monthKey,
      monthName: getMonthNameInPortuguese(monthKey),
      receitas: monthReceitas,
      despesas: monthDespesas,
      totalReceitas: monthReceitas.reduce((sum, t) => sum + t.valor, 0),
      totalDespesas: monthDespesas.reduce((sum, t) => sum + t.valor, 0),
      saldoMes: monthReceitas.reduce((sum, t) => sum + t.valor, 0) - monthDespesas.reduce((sum, t) => sum + t.valor, 0)
    };
  });

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Extrato Financeiro Detalhado</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; color: #333; margin: 40px; line-height: 1.4; }
        header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
        header img { height: 50px; }
        .company-info h2 { margin: 0 0 5px 0; font-size: 18px; color: #2c3e50; }
        .company-info p { margin: 2px 0; color: #7f8c8d; font-size: 11px; }
        h1 { text-align: center; font-size: 20px; margin: 20px 0 10px 0; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f8f8; font-weight: 600; }
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
        ${branding.logoUrl ? `<img src="${branding.logoUrl}" alt="Logo da empresa" crossorigin="anonymous">` : ''}
      </header>

      <h1>Extrato Financeiro Detalhado</h1>

      ${monthlyGroups.map(month => `
        <div class="month-section">
          <h2>${month.monthName}</h2>
          <table>
            <thead>
              <tr><th>Data</th><th>Descrição</th><th>Valor</th></tr>
            </thead>
            <tbody>
              ${month.receitas.map(t => `<tr><td>${formatDateForDisplay(t.data_vencimento)}</td><td>${t.item.nome}</td><td>${formatCurrency(t.valor)}</td></tr>`).join('')}
              ${month.despesas.map(t => `<tr><td>${formatDateForDisplay(t.data_vencimento)}</td><td>${t.item.nome}</td><td>${formatCurrency(t.valor)}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      `).join('')}
      
      <footer>Gerado via Lunari</footer>
    </body>
    </html>
  `;
};

export async function generateExtratoDetalhadoPDF(data: ExtratoDetalhadoData): Promise<void> {
  const htmlContent = getExtratoDetalhadoHTML(data);
  
  const opt = {
    margin: [0.5, 0.5],
    filename: `extrato-detalhado-${formatDateForPDF(data.period.startDate)}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
  };

  await html2pdf().from(htmlContent).set(opt).save();
}
