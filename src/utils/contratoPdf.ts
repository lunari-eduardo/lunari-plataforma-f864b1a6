/**
 * Geração de PDF para contratos via html2pdf.js
 *
 * Estratégia revisada após PDFs em branco no Workflow e CRM:
 *
 * 1. NUNCA usar opacity/visibility/display:none no container — html2canvas pode
 *    capturar exatamente isso e devolver um canvas em branco.
 * 2. Container fica fora da viewport (top: -10000px) mas com tudo VISÍVEL
 *    (sem opacity), preservando a captura.
 * 3. CSS 100% inline com cores hex literais — nada depende do tema do app.
 * 4. Normalização robusta do HTML do editor (regex tolerante a múltiplos atributos).
 * 5. Escala adaptativa para evitar limite de canvas em contratos longos.
 * 6. Validação do Blob: se vier menor que ~3KB (PDF vazio típico), lança erro
 *    em vez de baixar arquivo inutilizável.
 */

interface GenerateContratoPdfOptions {
  titulo: string;
  conteudoHtml: string;
  fotografoNome?: string;
  fotografoEmail?: string;
  filename?: string;
}

/**
 * Remove as classes do editor de contratos (`contrato-var-auto` e
 * `contrato-campo-editavel`) preservando o texto. Tolerante a:
 *   - aspas simples ou duplas
 *   - múltiplas classes no mesmo span
 *   - outros atributos antes/depois (data-campo, style, etc.)
 */
function neutralizarEstilosEditor(html: string): string {
  if (!html) return '';

  // Remove a classe inteira mantendo o atributo `class=""` apenas se sobrar algo.
  // Funciona para:  class="contrato-var-auto"  |  class="x contrato-var-auto y"
  const stripClass = (input: string, className: string) => {
    return input.replace(
      /class\s*=\s*(["'])([^"']*)\1/gi,
      (full, quote, classes) => {
        const cleaned = classes
          .split(/\s+/)
          .filter((c: string) => c !== className)
          .join(' ')
          .trim();
        return cleaned ? `class=${quote}${cleaned}${quote}` : '';
      }
    );
  };

  let out = html;
  out = stripClass(out, 'contrato-var-auto');
  out = stripClass(out, 'contrato-campo-editavel');
  // Limpa atributos data-campo (não fazem falta no PDF)
  out = out.replace(/\s*data-campo\s*=\s*(["'])[^"']*\1/gi, '');
  // Remove eventuais spans vazios que sobraram
  out = out.replace(/<span\s*>\s*<\/span>/gi, '');
  return out;
}

/**
 * Extrai apenas texto puro do HTML para checagem de "está vazio?".
 */
function htmlToPlainText(html: string): string {
  return (html || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').trim();
}

/**
 * Estima escala a usar com base no tamanho do conteúdo.
 * Contratos muito longos podem estourar o limite de canvas do browser
 * (~16.384px de altura no Chrome) e gerar PDF em branco.
 */
function getSafeScale(plainTextLength: number): number {
  if (plainTextLength > 12000) return 1;     // muito longo → escala mínima
  if (plainTextLength > 6000) return 1.5;    // longo → escala média
  return 2;                                   // padrão de boa qualidade
}

const buildHtmlDocument = (opts: GenerateContratoPdfOptions): string => {
  const { titulo, conteudoHtml, fotografoNome, fotografoEmail } = opts;
  const dataGeracao = new Date().toLocaleDateString('pt-BR');
  const conteudoLimpo = neutralizarEstilosEditor(conteudoHtml || '');

  // CSS inline — todas as cores em hex/rgb literais, nada de CSS variables.
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
      .pdf-root h4, .pdf-root h5, .pdf-root h6 { font-size: 13px; font-weight: 700; margin: 12px 0 4px 0; color: #111827; }
      .pdf-root p  { margin: 8px 0; color: #1f2937; text-align: justify; }
      .pdf-root span { color: inherit; }
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
      .pdf-root br { line-height: inherit; }
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
      /* Garante que blocos não fiquem cortados desnecessariamente entre páginas */
      .pdf-root h1, .pdf-root h2, .pdf-root h3 { page-break-after: avoid; }
      .pdf-root li, .pdf-root p { page-break-inside: avoid; }
    </style>
    <div class="pdf-root">
      <header class="pdf-header">
        <div>
          <div class="pdf-eyebrow">Contrato</div>
          <h1>${titulo || 'Contrato'}</h1>
        </div>
        <div class="pdf-meta">
          ${fotografoNome ? `<div class="pdf-meta-strong">${fotografoNome}</div>` : ''}
          ${fotografoEmail ? `<div>${fotografoEmail}</div>` : ''}
          <div>Emitido em ${dataGeracao}</div>
        </div>
      </header>
      <main>${conteudoLimpo || '<p><em>Contrato sem conteúdo.</em></p>'}</main>
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

/** Aguarda o próximo paint do browser. */
function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export async function generateContratoPdf(opts: GenerateContratoPdfOptions): Promise<Blob> {
  // Validação prévia: conteúdo está realmente vazio?
  const plain = htmlToPlainText(opts.conteudoHtml);
  if (!plain) {
    throw new Error('O contrato está vazio. Adicione conteúdo antes de gerar o PDF.');
  }

  const html2pdf = (await import('html2pdf.js')).default;

  // Container REAL no DOM — visível para o motor de captura, mas posicionado
  // FORA da viewport. SEM opacity/visibility/display:none (que zeram a captura).
  const container = document.createElement('div');
  container.innerHTML = buildHtmlDocument(opts);
  container.setAttribute('data-pdf-render', 'true');
  // Estilo aplicado de forma que NÃO esconde o conteúdo do html2canvas:
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '794px';
  container.style.maxWidth = '794px';
  container.style.minHeight = '100px';
  container.style.background = '#ffffff';
  container.style.color = '#111827';
  container.style.zIndex = '2147483647';   // por cima de tudo (mas fora da viewport)
  container.style.transform = 'translateY(-200vh)'; // joga para fora da tela visível
  container.style.pointerEvents = 'none';
  container.style.contain = 'layout paint'; // isolamento visual

  document.body.appendChild(container);

  // Aguarda fontes carregarem e o navegador realizar layout/paint
  await waitForFonts();
  await nextPaint();
  // Pequeno delay extra para imagens/fontes em conexões lentas
  await new Promise((r) => setTimeout(r, 80));

  // Escala adaptativa para evitar limite de canvas em contratos longos
  const scale = getSafeScale(plain.length);

  try {
    const blob: Blob = await html2pdf()
      .set({
        margin: [12, 12, 14, 12] as [number, number, number, number],
        filename: opts.filename || `${opts.titulo}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
          scale,
          useCORS: true,
          letterRendering: true,
          backgroundColor: '#ffffff',
          windowWidth: 794,
          logging: false,
          // Ignora o próprio wrapper invisível durante o clone
          ignoreElements: (el: Element) =>
            el !== container && (el as HTMLElement).getAttribute?.('data-pdf-render') === 'true',
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
        pagebreak: { mode: ['css', 'legacy'] },
      } as any)
      .from(container)
      .outputPdf('blob');

    // Validação: PDF "vazio" geralmente tem ~1.5–2.5 KB (só fontes embutidas).
    if (!blob || blob.size < 3000) {
      throw new Error('Falha ao gerar o PDF: arquivo gerado parece vazio.');
    }
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
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
