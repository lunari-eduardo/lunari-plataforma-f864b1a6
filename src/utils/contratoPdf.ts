/**
 * Geração de PDF para contratos via html2pdf.js
 *
 * IMPORTANTE: o html2canvas (engine interna do html2pdf.js) tem várias armadilhas:
 *  1. Não captura corretamente elementos com `position: fixed; left: -9999px`
 *     → usamos `position: absolute; opacity: 0` mas dentro do viewport.
 *  2. Não resolve CSS variables (`hsl(var(--primary))`) em todos os contextos
 *     → todo CSS é inline com cores hex literais.
 *  3. Precisa de `width` explícita no elemento raiz, senão calcula 0px.
 *  4. Pode renderizar PDF em branco se as fontes ainda estiverem carregando
 *     → aguardamos `document.fonts.ready` antes.
 */

interface GenerateContratoPdfOptions {
  titulo: string;
  conteudoHtml: string;
  fotografoNome?: string;
  fotografoEmail?: string;
  filename?: string;
}

/**
 * Neutraliza as classes do editor (`contrato-var-auto`, `contrato-campo-editavel`)
 * substituindo-as por estilos inline neutros. No PDF final o documento fica limpo,
 * sem fundos coloridos que possam destoar de um contrato profissional.
 */
function neutralizarEstilosEditor(html: string): string {
  if (!html) return '';
  // Remove apenas as classes do contrato (mantendo outras se houver)
  return html
    // Variáveis automáticas: texto normal, mantém peso
    .replace(/class="contrato-var-auto"/g, 'style="font-weight:500"')
    .replace(/class='contrato-var-auto'/g, "style='font-weight:500'")
    // Campos editáveis: texto normal, sem destaque
    .replace(/class="contrato-campo-editavel"/g, 'style=""')
    .replace(/class='contrato-campo-editavel'/g, "style=''");
}

const buildHtmlDocument = (opts: GenerateContratoPdfOptions): string => {
  const { titulo, conteudoHtml, fotografoNome, fotografoEmail } = opts;
  const dataGeracao = new Date().toLocaleDateString('pt-BR');
  const conteudoLimpo = neutralizarEstilosEditor(conteudoHtml || '');

  // Estilos inline para evitar dependência do CSS global do app.
  // Todas as cores em hex/rgb literais — html2canvas não resolve CSS vars.
  return `
    <style>
      .pdf-root, .pdf-root * { box-sizing: border-box; }
      .pdf-root {
        font-family: Helvetica, Arial, sans-serif;
        color: #111827;
        background: #ffffff;
        padding: 32px 40px;
        width: 794px;
        font-size: 13px;
        line-height: 1.7;
      }
      .pdf-root h1 { font-size: 22px; font-weight: 700; margin: 4px 0 0 0; color: #111827; }
      .pdf-root h2 { font-size: 17px; font-weight: 700; margin: 18px 0 8px 0; color: #111827; }
      .pdf-root h3 { font-size: 14px; font-weight: 700; margin: 14px 0 6px 0; color: #111827; }
      .pdf-root p  { margin: 8px 0; color: #1f2937; text-align: justify; }
      .pdf-root strong, .pdf-root b { font-weight: 700; color: #111827; }
      .pdf-root em, .pdf-root i { font-style: italic; }
      .pdf-root u { text-decoration: underline; }
      .pdf-root ul { list-style: disc; padding-left: 24px; margin: 8px 0; }
      .pdf-root ol { list-style: decimal; padding-left: 24px; margin: 8px 0; }
      .pdf-root li { margin: 4px 0; color: #1f2937; }
      .pdf-root blockquote {
        border-left: 3px solid #d1d5db;
        padding-left: 12px;
        margin: 12px 0;
        font-style: italic;
        color: #4b5563;
      }
      .pdf-header {
        border-bottom: 2px solid #111827;
        padding-bottom: 14px;
        margin-bottom: 22px;
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
      }
      .pdf-eyebrow {
        font-size: 10px;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      .pdf-meta {
        text-align: right;
        font-size: 11px;
        color: #6b7280;
        line-height: 1.5;
      }
      .pdf-meta-strong { font-weight: 600; color: #111827; }
      .pdf-footer {
        margin-top: 48px;
        padding-top: 12px;
        border-top: 1px solid #e5e7eb;
        font-size: 10px;
        color: #9ca3af;
        text-align: center;
      }
    </style>
    <div class="pdf-root">
      <header class="pdf-header">
        <div>
          <div class="pdf-eyebrow">Contrato</div>
          <h1>${titulo}</h1>
        </div>
        <div class="pdf-meta">
          ${fotografoNome ? `<div class="pdf-meta-strong">${fotografoNome}</div>` : ''}
          ${fotografoEmail ? `<div>${fotografoEmail}</div>` : ''}
          <div>Emitido em ${dataGeracao}</div>
        </div>
      </header>
      <main>${conteudoLimpo}</main>
      <footer class="pdf-footer">Gerado por Lunari · ${dataGeracao}</footer>
    </div>
  `;
};

/** Aguarda fontes web carregarem (evita PDF em branco por fonte ausente). */
async function waitForFonts(): Promise<void> {
  if (typeof document === 'undefined') return;
  const anyDoc = document as any;
  if (anyDoc.fonts?.ready) {
    try {
      await anyDoc.fonts.ready;
    } catch {
      /* noop */
    }
  }
}

export async function generateContratoPdf(opts: GenerateContratoPdfOptions): Promise<Blob> {
  const html2pdf = (await import('html2pdf.js')).default;

  // Container visível porém invisível ao usuário, mas dentro do viewport
  // (html2canvas precisa de elemento renderizado em coordenadas reais).
  const container = document.createElement('div');
  container.innerHTML = buildHtmlDocument(opts);
  container.style.position = 'absolute';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '794px';
  container.style.background = '#ffffff';
  container.style.opacity = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '-1';
  document.body.appendChild(container);

  // Aguarda fontes carregarem antes de capturar (evita texto invisível)
  await waitForFonts();
  // Pequeno tick para garantir layout calculado pelo browser
  await new Promise((r) => requestAnimationFrame(() => r(null)));

  try {
    const blob: Blob = await html2pdf()
      .from(container)
      .set({
        margin: [12, 12, 14, 12] as [number, number, number, number],
        filename: opts.filename || `${opts.titulo}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
          backgroundColor: '#ffffff',
          windowWidth: 794,
          // 'logging: false' evita ruído no console
          logging: false,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
        // 'css' + 'legacy' deixa o conteúdo fluir naturalmente entre páginas.
        // Evita 'avoid-all' que pode esconder blocos grandes.
        pagebreak: { mode: ['css', 'legacy'] },
      } as any)
      .outputPdf('blob');

    return blob;
  } finally {
    document.body.removeChild(container);
  }
}

export async function downloadContratoPdf(opts: GenerateContratoPdfOptions): Promise<void> {
  const blob = await generateContratoPdf(opts);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = opts.filename || `${opts.titulo}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Pequeno delay antes de revogar — garante o download iniciar em todos os navegadores
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
