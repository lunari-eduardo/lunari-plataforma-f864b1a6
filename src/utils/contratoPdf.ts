/**
 * Geração de PDF para contratos via html2pdf.js
 *
 * Estratégia (após PDFs em branco no Workflow e CRM):
 *
 * O modo de captura via DOM real (com `transform: translateY(-200vh)` e
 * `ignoreElements` apontando para o próprio container) estava produzindo PDFs
 * em branco. Foi substituído pela mesma estratégia que JÁ FUNCIONA nos outros
 * PDFs do projeto (`unifiedPdfUtils`, `newDemonstrativePdfUtils`,
 * `financialPdfUtils`):
 *
 *     await html2pdf().set(opt).from(htmlString).save()
 *
 * Diferenças importantes:
 *  1. Passamos um HTML <string> completo (com <html><head><body>) para o
 *     html2pdf, deixando ele criar o iframe de renderização internamente.
 *     Sem container manual, sem `transform`, sem `ignoreElements`, sem
 *     opacity:0/visibility:hidden — eliminando a causa raiz do "PDF branco".
 *  2. CSS 100% inline com cores hex literais (nunca CSS variables do app).
 *  3. Normalização robusta do HTML do editor preservando todo o texto.
 *  4. Diagnóstico completo no console quando habilitado em
 *     `localStorage.setItem('debugContratoPdf','1')` ou em ambiente preview.
 */

interface GenerateContratoPdfOptions {
  titulo: string;
  conteudoHtml: string;
  fotografoNome?: string;
  fotografoEmail?: string;
  filename?: string;
}

/* ------------------------------------------------------------------ */
/* Diagnóstico                                                         */
/* ------------------------------------------------------------------ */

function isDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.localStorage?.getItem('debugContratoPdf') === '1') return true;
  } catch { /* noop */ }
  // Preview/dev hostnames: ajuda a debugar em ambientes não produtivos
  const host = window.location?.hostname || '';
  return /localhost|127\.0\.0\.1|lovable\.app|preview/.test(host);
}

function diag(...args: unknown[]) {
  if (isDebugEnabled()) {
    // eslint-disable-next-line no-console
    console.log('[ContratoPDF]', ...args);
  }
}

/* ------------------------------------------------------------------ */
/* Normalização de conteúdo                                            */
/* ------------------------------------------------------------------ */

/** Remove classes/atributos do editor mantendo todo o texto. */
function neutralizarEstilosEditor(html: string): string {
  if (!html) return '';

  const stripClass = (input: string, className: string) =>
    input.replace(/class\s*=\s*(["'])([^"']*)\1/gi, (_full, quote, classes) => {
      const cleaned = String(classes)
        .split(/\s+/)
        .filter((c: string) => c !== className)
        .join(' ')
        .trim();
      return cleaned ? `class=${quote}${cleaned}${quote}` : '';
    });

  let out = html;
  out = stripClass(out, 'contrato-var-auto');
  out = stripClass(out, 'contrato-campo-editavel');
  out = out.replace(/\s*data-campo\s*=\s*(["'])[^"']*\1/gi, '');
  // Remove handlers inline por segurança
  out = out.replace(/\s*on[a-z]+\s*=\s*(["'])[^"']*\1/gi, '');
  // Remove style colors brancas/transparentes que poderiam esconder texto
  out = out.replace(/color\s*:\s*(white|#fff(?:fff)?|transparent)\s*;?/gi, '');
  out = out.replace(/<span\s*>\s*<\/span>/gi, '');
  return out;
}

/** Texto puro para checagens. */
function htmlToPlainText(html: string): string {
  return (html || '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .trim();
}

/** Garante HTML estruturado (envolve texto puro em <p>). */
function ensureStructuredHtml(html: string): string {
  const trimmed = (html || '').trim();
  if (!trimmed) return '';
  // Já tem alguma tag estrutural?
  if (/<\s*(p|div|h[1-6]|ul|ol|li|blockquote|section|article|table)\b/i.test(trimmed)) {
    return trimmed;
  }
  // Texto puro → quebra por linhas em parágrafos.
  return trimmed
    .split(/\n{2,}|\r\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

/* ------------------------------------------------------------------ */
/* Documento HTML do PDF                                               */
/* ------------------------------------------------------------------ */

function escapeHtml(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHtmlDocument(opts: GenerateContratoPdfOptions): string {
  const { titulo, fotografoNome, fotografoEmail } = opts;
  const dataGeracao = new Date().toLocaleDateString('pt-BR');
  const conteudoLimpo = neutralizarEstilosEditor(ensureStructuredHtml(opts.conteudoHtml || ''));

  // Documento COMPLETO (html/head/body) — html2pdf renderiza dentro de um
  // iframe próprio quando recebemos string. Cores em hex literal.
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(titulo || 'Contrato')}</title>
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #111827;
    font-family: Helvetica, Arial, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body {
    padding: 28px 36px 32px 36px;
    font-size: 12.5px;
    line-height: 1.65;
  }
  h1 { font-size: 22px; font-weight: 700; margin: 4px 0 0 0; color: #111827; }
  h2 { font-size: 16px; font-weight: 700; margin: 18px 0 8px 0; color: #111827; }
  h3 { font-size: 13.5px; font-weight: 700; margin: 14px 0 6px 0; color: #111827; }
  h4, h5, h6 { font-size: 12.5px; font-weight: 700; margin: 12px 0 4px 0; color: #111827; }
  p { margin: 8px 0; color: #1f2937; text-align: justify; }
  span, b, strong, em, i, u, li { color: inherit; }
  strong, b { font-weight: 700; color: #111827; }
  em, i { font-style: italic; }
  u { text-decoration: underline; }
  ul { list-style: disc; padding-left: 22px; margin: 8px 0; }
  ol { list-style: decimal; padding-left: 22px; margin: 8px 0; }
  li { margin: 4px 0; color: #1f2937; }
  blockquote {
    border-left: 3px solid #d1d5db;
    padding-left: 12px;
    margin: 12px 0;
    font-style: italic;
    color: #4b5563;
  }
  a { color: #1d4ed8; text-decoration: underline; }

  .pdf-header {
    border-bottom: 2px solid #111827;
    padding-bottom: 12px;
    margin-bottom: 18px;
    width: 100%;
    display: table;
  }
  .pdf-header-left, .pdf-header-right { display: table-cell; vertical-align: bottom; }
  .pdf-header-right { text-align: right; font-size: 11px; color: #6b7280; line-height: 1.5; }
  .pdf-eyebrow {
    font-size: 10px;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 2px;
  }
  .pdf-meta-strong { font-weight: 600; color: #111827; }

  .pdf-content { margin-top: 4px; }

  .pdf-footer {
    margin-top: 36px;
    padding-top: 10px;
    border-top: 1px solid #e5e7eb;
    font-size: 10px;
    color: #9ca3af;
    text-align: center;
  }

  /* Não cortar headings e listas no meio */
  h1, h2, h3 { page-break-after: avoid; }
  ul, ol, blockquote { page-break-inside: avoid; }
</style>
</head>
<body>
  <div class="pdf-header">
    <div class="pdf-header-left">
      <div class="pdf-eyebrow">Contrato</div>
      <h1>${escapeHtml(titulo || 'Contrato')}</h1>
    </div>
    <div class="pdf-header-right">
      ${fotografoNome ? `<div class="pdf-meta-strong">${escapeHtml(fotografoNome)}</div>` : ''}
      ${fotografoEmail ? `<div>${escapeHtml(fotografoEmail)}</div>` : ''}
      <div>Emitido em ${dataGeracao}</div>
    </div>
  </div>

  <div class="pdf-content">
    ${conteudoLimpo || '<p><em>Contrato sem conteúdo.</em></p>'}
  </div>

  <div class="pdf-footer">Gerado por Lunari · ${dataGeracao}</div>
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/* Geração                                                             */
/* ------------------------------------------------------------------ */

function getSafeScale(plainTextLength: number): number {
  if (plainTextLength > 12000) return 1;
  if (plainTextLength > 6000) return 1.5;
  return 2;
}

async function waitForFonts(): Promise<void> {
  if (typeof document === 'undefined') return;
  const anyDoc = document as any;
  if (anyDoc.fonts?.ready) {
    try { await anyDoc.fonts.ready; } catch { /* noop */ }
  }
}

function buildPdfOptions(filename: string, plainTextLength: number) {
  const scale = getSafeScale(plainTextLength);
  return {
    margin: [10, 10, 12, 10] as [number, number, number, number],
    filename,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: {
      scale,
      useCORS: true,
      letterRendering: true,
      backgroundColor: '#ffffff',
      logging: false,
      // 794px ≈ A4 a 96dpi
      windowWidth: 794,
    },
    jsPDF: {
      unit: 'mm' as const,
      format: 'a4' as const,
      orientation: 'portrait' as const,
      compress: true,
    },
    pagebreak: { mode: ['css', 'legacy'] as string[] },
  };
}

export async function generateContratoPdf(opts: GenerateContratoPdfOptions): Promise<Blob> {
  const plain = htmlToPlainText(opts.conteudoHtml || '');

  // Diagnóstico de entrada
  diag('Entrada', {
    titulo: opts.titulo,
    tamanhoHtml: (opts.conteudoHtml || '').length,
    tamanhoTextoPuro: plain.length,
    fotografoNome: opts.fotografoNome,
    placeholdersRestantes: (opts.conteudoHtml || '').match(/\{\{[^}]+\}\}/g) || [],
    amostraHtml: (opts.conteudoHtml || '').slice(0, 240),
  });

  if (!plain) {
    throw new Error('O contrato está vazio. Adicione conteúdo antes de gerar o PDF.');
  }

  const html2pdf = (await import('html2pdf.js')).default;

  await waitForFonts();

  const filename = opts.filename || `${opts.titulo || 'contrato'}.pdf`;
  const html = buildHtmlDocument(opts);
  diag('HTML final', { tamanho: html.length, amostra: html.slice(0, 400) });

  // 1) Geração principal — HTML string → html2pdf (mesma abordagem dos
  //    PDFs financeiros que funcionam).
  try {
    const pdfOpt = buildPdfOptions(filename, plain.length);
    const blob: Blob = await html2pdf()
      .set(pdfOpt as any)
      .from(html)
      .outputPdf('blob');

    diag('Blob gerado (string)', { size: blob?.size });
    if (blob && blob.size >= 2000) return blob;
    diag('Blob suspeito de vazio — tentando fallback DOM real');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[ContratoPDF] Falha na geração via string, tentando fallback DOM real:', err);
  }

  // 2) Fallback — montar container REAL no DOM, sem transform, sem
  //    ignoreElements. Apenas posicionado no topo com pointer-events:none.
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '794px';
  container.style.maxWidth = '794px';
  container.style.background = '#ffffff';
  container.style.color = '#111827';
  container.style.zIndex = '-1';        // atrás de tudo, mas presente
  container.style.pointerEvents = 'none';
  container.style.opacity = '1';        // NUNCA 0 — html2canvas captura literalmente
  document.body.appendChild(container);

  // espera layout
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

  diag('Fallback DOM dimensões', {
    scrollWidth: container.scrollWidth,
    scrollHeight: container.scrollHeight,
    clientWidth: container.clientWidth,
    clientHeight: container.clientHeight,
  });

  try {
    const pdfOpt = buildPdfOptions(filename, plain.length);
    const blob: Blob = await html2pdf()
      .set(pdfOpt as any)
      .from(container)
      .outputPdf('blob');

    diag('Blob gerado (DOM)', { size: blob?.size });
    if (!blob || blob.size < 2000) {
      throw new Error('Falha ao gerar o PDF: arquivo gerado parece vazio.');
    }
    return blob;
  } finally {
    if (container.parentNode) container.parentNode.removeChild(container);
  }
}

export async function downloadContratoPdf(opts: GenerateContratoPdfOptions): Promise<void> {
  const blob = await generateContratoPdf(opts);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = opts.filename || `${opts.titulo || 'contrato'}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Teste mínimo isolado: gera um PDF "Hello World" para diagnosticar se o
 * problema é do conteúdo do contrato ou do motor de geração.
 * Acessível via console: `await window.__testContratoPdf?.()`.
 */
export async function __testMinimalPdf(): Promise<Blob> {
  const html2pdf = (await import('html2pdf.js')).default;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:40px;font-family:Arial,sans-serif;color:#111;background:#fff">
<h1 style="color:#111">Teste de PDF</h1>
<p style="color:#111">Se você consegue ler esta linha no PDF, o motor está funcionando.</p>
</body></html>`;
  const blob: Blob = await html2pdf()
    .set({
      margin: 10,
      filename: 'teste.pdf',
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      html2canvas: { scale: 2, backgroundColor: '#ffffff', useCORS: true },
    } as any)
    .from(html)
    .outputPdf('blob');
  // eslint-disable-next-line no-console
  console.log('[ContratoPDF][TesteMinimo] Blob size:', blob?.size);
  return blob;
}

if (typeof window !== 'undefined') {
  (window as any).__testContratoPdf = __testMinimalPdf;
}
