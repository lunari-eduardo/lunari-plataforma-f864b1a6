import { escapeHtml } from '../helpers.ts';
import { BuildLayoutParams } from '../types.ts';

/**
 * Constrói o layout HTML do e-mail com design premium, alinhado à identidade visual
 * do fotógrafo (cores do tema, logo do estúdio e tipografia editorial).
 */
export function buildLayout(params: BuildLayoutParams) {
  const primaryColor = params.primaryColor || '#C6A36A';
  
  // Header: Logo do estúdio ou Nome Fantasia estilizado
  const headerContent = params.studioLogoUrl
    ? `<div style="text-align:center;margin-bottom:28px;">
        <img src="${escapeHtml(params.studioLogoUrl)}" alt="${escapeHtml(params.studioName)}" style="max-height:56px;max-width:240px;height:auto;width:auto;object-fit:contain;display:inline-block;" />
       </div>`
    : `<div style="text-align:center;margin-bottom:24px;">
        <span style="font-size:13px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${escapeHtml(primaryColor)};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          ${escapeHtml(params.studioName)}
        </span>
       </div>`;

  // Badge opcional (ex: "Galeria de Entrega" ou "Seleção de Fotos")
  const badgeHtml = params.badgeText
    ? `<div style="text-align:center;margin-bottom:16px;">
        <span style="display:inline-block;background-color:rgba(0,0,0,0.04);border:1px solid rgba(0,0,0,0.08);color:#6B635B;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;padding:4px 12px;border-radius:20px;">
          ${escapeHtml(params.badgeText)}
        </span>
       </div>`
    : '';

  // Box de detalhes / informações da sessão
  let detailsHtml = '';
  if (params.details && params.details.length > 0) {
    const rows = params.details.map((d, index) => {
      const borderStyle = index > 0 ? 'border-top:1px solid #EBE5DF;' : '';
      return `<tr>
        <td style="padding:11px 16px;color:#78716C;font-size:13px;${borderStyle}">${escapeHtml(d.label)}</td>
        <td align="right" style="padding:11px 16px;color:#1C1917;font-size:13px;${d.isBold ? 'font-weight:700;' : 'font-weight:500;'}${borderStyle}">${escapeHtml(d.value)}</td>
      </tr>`;
    }).join('');

    detailsHtml = `
      <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;background:#F9F8F6;border:1px solid #EAE5DF;border-radius:12px;margin:22px 0 10px;overflow:hidden;">
        ${rows}
      </table>
    `;
  }

  // Botão CTA estilizado com a cor da identidade do fotógrafo
  const button = params.buttonUrl ? `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 20px;width:100%;">
      <tr>
        <td align="center">
          <a href="${escapeHtml(params.buttonUrl)}" style="display:inline-block;background-color:${escapeHtml(primaryColor)};color:#FFFFFF;text-decoration:none;font-weight:500;font-size:14px;letter-spacing:0.06em;text-transform:uppercase;border-radius:6px;padding:16px 36px;box-shadow:0 4px 14px rgba(0,0,0,0.08);font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
            ${escapeHtml(params.buttonText || 'Acessar')}
          </a>
        </td>
      </tr>
    </table>` : '';

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(params.title)}</title>
  </head>
  <body style="margin:0;background-color:#F5F4F0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#2D2A26;-webkit-font-smoothing:antialiased;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(params.preview)}</div>
    <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;background-color:#F5F4F0;padding:40px 16px 48px;">
      <tr>
        <td align="center">
          <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;max-width:580px;background:#FFFFFF;border:1px solid #E8E3DC;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,0.04);overflow:hidden;">
            <tr>
              <td style="padding:44px 36px 36px;">
                ${headerContent}
                ${badgeHtml}
                <h1 style="margin:0 0 22px;color:#1C1917;font-size:24px;line-height:1.3;font-weight:400;text-align:center;font-family:Georgia,'Times New Roman',serif;">
                  ${escapeHtml(params.title)}
                </h1>
                
                <div style="margin:0 0 8px;">
                  ${params.children}
                </div>

                ${detailsHtml}
                ${button}

                <div style="margin-top:32px;padding-top:20px;border-top:1px solid #F0ECE7;text-align:center;">
                  <p style="margin:0;color:#78716C;font-size:13px;line-height:1.6;">
                    Com carinho,<br>
                    <strong style="color:#1C1917;font-size:14px;">${escapeHtml(params.studioName)}</strong>
                  </p>
                </div>
              </td>
            </tr>
          </table>

          <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;max-width:580px;margin-top:20px;">
            <tr>
              <td align="center" style="color:#A8A29E;font-size:11px;line-height:1.5;">
                Enviado com carinho através de <a href="https://lunarihub.com" style="color:#A8A29E;text-decoration:underline;">Lunari</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
