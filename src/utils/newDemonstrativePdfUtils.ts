import { formatCurrency } from './financialUtils';
import { formatDateForPDF, getCurrentDateTimeForPDF } from './dateUtils';
import { UserProfile } from '@/services/ProfileService';
import { UserBranding } from '@/types/userProfile';
import { DemonstrativoSimplificado } from '@/types/extrato';
import html2pdf from 'html2pdf.js';

export interface DemonstrativeExportData {
  profile: UserProfile & { logo_url?: string };
  branding?: UserBranding;
  period: {
    startDate: string;
    endDate: string;
  };
  demonstrativo: DemonstrativoSimplificado;
  regime?: 'caixa' | 'competencia';
}

export const getDemonstrativeHTML = (data: DemonstrativeExportData): string => {
  const { profile, branding, period, demonstrativo, regime = 'caixa' } = data;
  const { receitas, despesas, resumoFinal } = demonstrativo;
  const logoUrl = profile?.logo_url || branding?.logoUrl;
  const regimeLabel = regime === 'competencia' ? 'Regime de Competência' : 'Regime de Caixa';

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; background-color: #ffffff; padding: 24px 28px; line-height: 1.45; font-size: 13px;">
      
      <!-- Cabeçalho com Empresa e Logo -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 18px; margin-bottom: 20px;">
        <div style="flex: 1;">
          <h2 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em;">
            ${profile.empresa || profile.nome}
          </h2>
          ${profile.cpf_cnpj ? `<p style="margin: 2px 0; font-size: 11.5px; color: #64748b; font-weight: 500;">CNPJ/CPF: ${profile.cpf_cnpj}</p>` : ''}
          ${profile.endereco_comercial ? `<p style="margin: 2px 0; font-size: 11.5px; color: #64748b;">${profile.endereco_comercial}</p>` : ''}
          ${profile.email ? `<p style="margin: 2px 0; font-size: 11.5px; color: #64748b;">${profile.email}</p>` : ''}
          <div style="display: inline-block; margin-top: 6px; padding: 3px 9px; background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 10px; font-weight: 600; color: #334155; text-transform: uppercase;">
            ${regimeLabel}
          </div>
        </div>

        ${logoUrl ? `
          <div style="flex: 0 0 auto; margin-left: 20px; text-align: right;">
            <img src="${logoUrl}" alt="Logo" style="max-height: 65px; max-width: 180px; object-fit: contain; border-radius: 6px;" crossOrigin="anonymous" />
          </div>
        ` : ''}
      </div>

      <!-- Banner de Título do Relatório -->
      <div style="background: linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%); border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1 style="margin: 0; font-size: 18px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.03em;">
            Demonstrativo Financeiro (DRE)
          </h1>
          <p style="margin: 2px 0 0 0; font-size: 11.5px; color: #64748b;">
            Resumo consolidado para controle financeiro e contábil
          </p>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 12px; font-weight: 700; color: #1e293b;">
            Período: ${formatDateForPDF(period.startDate)} a ${formatDateForPDF(period.endDate)}
          </div>
          <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">
            Emissão: ${getCurrentDateTimeForPDF()}
          </div>
        </div>
      </div>

      <!-- Grid de Receitas e Despesas -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
        
        <!-- CARD RECEITAS -->
        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
          <div style="background-color: #059669; color: #ffffff; padding: 10px 14px; font-weight: 700; font-size: 13px; display: flex; justify-content: space-between; align-items: center;">
            <span>📈 RECEITAS</span>
            <span style="font-size: 11px; opacity: 0.9;">Créditos</span>
          </div>

          <div style="padding: 12px 14px;">
            <div style="display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #f1f5f9;">
              <span style="color: #475569;">Receita com sessões</span>
              <span style="font-weight: 600; color: #0f172a;">${formatCurrency(receitas.sessoes)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #f1f5f9;">
              <span style="color: #475569;">Receita com fotos extras</span>
              <span style="font-weight: 600; color: #0f172a;">${formatCurrency(receitas.fotosExtras || 0)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #f1f5f9;">
              <span style="color: #475569;">Receita com produtos</span>
              <span style="font-weight: 600; color: #0f172a;">${formatCurrency(receitas.produtos)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #f1f5f9;">
              <span style="color: #475569;">Receitas não operacionais</span>
              <span style="font-weight: 600; color: #0f172a;">${formatCurrency(receitas.naoOperacionais)}</span>
            </div>

            <!-- Box Total Receitas -->
            <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 10px 12px; margin-top: 14px; display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: 700; color: #065f46; font-size: 12px; text-transform: uppercase;">Total de Receitas</span>
              <span style="font-weight: 800; font-size: 15px; color: #047857;">${formatCurrency(receitas.totalReceitas)}</span>
            </div>
          </div>
        </div>

        <!-- CARD DESPESAS -->
        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
          <div style="background-color: #dc2626; color: #ffffff; padding: 10px 14px; font-weight: 700; font-size: 13px; display: flex; justify-content: space-between; align-items: center;">
            <span>📉 DESPESAS</span>
            <span style="font-size: 11px; opacity: 0.9;">Débitos</span>
          </div>

          <div style="padding: 12px 14px;">
            ${despesas.categorias.length === 0 ? `
              <div style="padding: 16px; text-align: center; color: #94a3b8; font-size: 12px;">
                Nenhuma despesa registrada no período
              </div>
            ` : despesas.categorias.map((cat, idx) => `
              <div style="margin-bottom: ${idx < despesas.categorias.length - 1 ? '10px' : '0'}; border-bottom: ${idx < despesas.categorias.length - 1 ? '1px solid #f1f5f9' : 'none'}; padding-bottom: 6px;">
                <div style="font-weight: 600; color: #334155; font-size: 11.5px; margin-bottom: 4px; display: flex; justify-content: space-between;">
                  <span>${cat.grupo}</span>
                  <span style="color: #b91c1c;">${formatCurrency(cat.total)}</span>
                </div>
                ${cat.itens.slice(0, 4).map(it => `
                  <div style="display: flex; justify-content: space-between; font-size: 11px; color: #64748b; padding: 2px 0 2px 8px;">
                    <span>${it.nome}</span>
                    <span>${formatCurrency(it.valor)}</span>
                  </div>
                `).join('')}
                ${cat.itens.length > 4 ? `
                  <div style="font-size: 10px; color: #94a3b8; padding-left: 8px; font-style: italic;">
                    + ${cat.itens.length - 4} outros itens
                  </div>
                ` : ''}
              </div>
            `).join('')}

            <!-- Box Total Despesas -->
            <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 10px 12px; margin-top: 14px; display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: 700; color: #991b1b; font-size: 12px; text-transform: uppercase;">Total de Despesas</span>
              <span style="font-weight: 800; font-size: 15px; color: #b91c1c;">${formatCurrency(despesas.totalDespesas)}</span>
            </div>
          </div>
        </div>

      </div>

      <!-- CARD RESUMO FINAL (DRE) -->
      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 18px 20px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 14px 0; font-size: 14px; font-weight: 700; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.02em; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
          💰 Resumo do Desempenho (DRE)
        </h3>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 16px;">
          <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px;">
            <div style="font-size: 11px; color: #64748b;">Receita Total</div>
            <div style="font-size: 15px; font-weight: 700; color: #047857; margin-top: 2px;">
              ${formatCurrency(resumoFinal.receitaTotal)}
            </div>
          </div>

          <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px;">
            <div style="font-size: 11px; color: #64748b;">(-) Despesas Totais</div>
            <div style="font-size: 15px; font-weight: 700; color: #b91c1c; margin-top: 2px;">
              ${formatCurrency(resumoFinal.despesaTotal)}
            </div>
          </div>

          <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px;">
            <div style="font-size: 11px; color: #64748b;">Margem Líquida</div>
            <div style="font-size: 15px; font-weight: 700; color: #2563eb; margin-top: 2px;">
              ${resumoFinal.margemLiquida.toFixed(1)}%
            </div>
          </div>
        </div>

        <!-- Bloco Hero: Resultado Líquido -->
        <div style="background: ${resumoFinal.resultadoLiquido >= 0 ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)' : 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)'}; border: 2px solid ${resumoFinal.resultadoLiquido >= 0 ? '#10b981' : '#ef4444'}; border-radius: 8px; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 13px; font-weight: 700; color: ${resumoFinal.resultadoLiquido >= 0 ? '#065f46' : '#991b1b'}; text-transform: uppercase;">
              = Resultado Líquido do Período
            </div>
            <div style="font-size: 11px; color: ${resumoFinal.resultadoLiquido >= 0 ? '#047857' : '#b91c1c'}; margin-top: 2px;">
              ${resumoFinal.resultadoLiquido >= 0 ? 'Lucro operacional acumulado' : 'Déficit no período'}
            </div>
          </div>
          <div style="font-size: 22px; font-weight: 800; color: ${resumoFinal.resultadoLiquido >= 0 ? '#047857' : '#b91c1c'}; letter-spacing: -0.02em;">
            ${formatCurrency(resumoFinal.resultadoLiquido)}
          </div>
        </div>
      </div>

      <!-- Rodapé -->
      <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 24px; text-align: center; font-size: 10.5px; color: #94a3b8;">
        Demonstrativo gerado automaticamente pelo <strong>Lunari Studio</strong> · Gestão Financeira para Fotografia
      </div>

    </div>
  `;
};

export async function generateDemonstrativePDF(data: DemonstrativeExportData): Promise<void> {
  // 1. Criar container isolado montado no DOM para garantir que html2canvas aplique 100% do layout e cores
  const container = document.createElement('div');
  container.id = 'pdf-export-temp-container';
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '794px'; // Largura exata A4 (96 DPI)
  container.style.backgroundColor = '#ffffff';
  container.style.zIndex = '-9999';
  container.innerHTML = getDemonstrativeHTML(data);
  document.body.appendChild(container);

  // 2. Aguardar carregamento do logotipo se houver
  const images = Array.from(container.querySelectorAll('img'));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) return resolve();
          img.onload = () => resolve();
          img.onerror = () => resolve(); // não trava se a imagem falhar
        })
    )
  );

  // 3. Aguardar estabilização do layout no DOM
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );

  const startDateStr = formatDateForPDF(data.period.startDate).replace(/\//g, '-');
  const endDateStr = formatDateForPDF(data.period.endDate).replace(/\//g, '-');
  const filename = `demonstrativo-${startDateStr}-a-${endDateStr}.pdf`;

  const opt = {
    margin: [6, 6, 6, 6],
    filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      letterRendering: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 794,
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait',
      compress: true,
    },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
  };

  try {
    await html2pdf().set(opt as any).from(container).save();
  } catch (error) {
    console.error('Erro ao gerar PDF do demonstrativo:', error);
    throw error;
  } finally {
    try {
      container.remove();
    } catch {
      // noop
    }
  }
}