/**
 * Geração de PDF para contratos.
 *
 * Estratégia definitiva (após sucessivos casos de PDF em branco ou com texto
 * invisível em modo dark):
 *
 *  1. Motor principal: `jsPDF.html()` com autoPaging, renderizando um container
 *     DOM real (visível, sem opacity/transform), construído com CSS próprio
 *     de impressão — totalmente isolado do tema do app.
 *  2. Fallback: `html2pdf().from(htmlString)` caso o motor principal falhe.
 *  3. Normalização agressiva: remove TODO atributo `style`, `class`,
 *     `data-*`, `contenteditable`, handlers `on*` do HTML do editor —
 *     mantendo apenas tags estruturais e texto. Isso elimina o vazamento
 *     de cores claras/tema dark herdadas do editor.
 *  4. Layout contratual completo: cabeçalho, partes, corpo, local/data,
 *     linhas de assinatura, rodapé. Fundo branco, texto preto.
 *  5. Diagnóstico no console habilitado em preview/dev ou via
 *     `localStorage.setItem('debugContratoPdf','1')`.
 */

import jsPDF from 'jspdf';

export interface GenerateContratoPdfOptions {
  titulo: string;
  conteudoHtml: string;
  /* Metadados opcionais — quanto mais, melhor */
  fotografoNome?: string;
  fotografoEmail?: string;
  fotografoDocumento?: string;
  clienteNome?: string;
  clienteEmail?: string;
  clienteDocumento?: string;
  cidadeLocal?: string;
  /** Snapshot com variáveis usadas na geração do contrato. */
  variaveisSnapshot?: Record<string, unknown> | null;
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
  const host = window.location?.hostname || '';
  return /localhost|127\.0\.0\.1|lovable\.app|preview/.test(host);
}

function diag(...args: unknown[]) {
  if (isDebugEnabled()) {
    // eslint-disable-next-line no-console
    console.log('[ContratoPDF]', ...args);
  }
}

function warn(...args: unknown[]) {
  // eslint-disable-next-line no-console
  console.warn('[ContratoPDF]', ...args);
}

/* ------------------------------------------------------------------ */
/* Normalização de conteúdo                                            */
/* ------------------------------------------------------------------ */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'div', 'span',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u',
  'ul', 'ol', 'li',
  'blockquote',
]);

/**
 * Remove TUDO que pode vazar estilos do app (style, class, data-*, on*,
 * contenteditable, spellcheck, etc.) — deixando apenas tags estruturais
 * e o texto. Também descarta tags não permitidas, preservando seu texto.
 */
function sanitizeContratoHtml(html: string): string {
  if (!html) return '';
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    // Fallback por regex no SSR
    return html
      .replace(/\s(style|class|data-[\w-]+|on[a-z]+|contenteditable|spellcheck)\s*=\s*(["'])[^"']*\2/gi, '')
      .replace(/<(?!\/?(?:p|br|div|span|h[1-6]|strong|b|em|i|u|ul|ol|li|blockquote)\b)[^>]*>/gi, '');
  }

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;

  const walk = (node: Element) => {
    // Remove atributos em TODOS os elementos
    [...node.attributes].forEach((attr) => node.removeAttribute(attr.name));

    // Substitui tags desconhecidas por <span> preservando filhos
    const tag = node.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      const replacement = document.createElement('span');
      while (node.firstChild) replacement.appendChild(node.firstChild);
      node.parentNode?.replaceChild(replacement, node);
      walkChildren(replacement);
      return;
    }
    walkChildren(node);
  };

  const walkChildren = (el: Element) => {
    [...el.children].forEach(walk);
  };

  walkChildren(wrapper);
  return wrapper.innerHTML;
}

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

function ensureStructuredHtml(html: string): string {
  const trimmed = (html || '').trim();
  if (!trimmed) return '';
  if (/<\s*(p|div|h[1-6]|ul|ol|li|blockquote)\b/i.test(trimmed)) return trimmed;
  return trimmed
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

function escapeHtml(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ------------------------------------------------------------------ */
/* Layout do PDF                                                       */
/* ------------------------------------------------------------------ */

/** CSS isolado do tema do app — reset cirúrgico (não global agressivo). */
const PRINT_CSS = `
  /* Container raiz: define base visual */
  .lunari-pdf {
    background: #ffffff;
    color: #000000;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12.5px;
    line-height: 1.6;
    width: 794px;
    padding: 56px;
    box-sizing: border-box;
  }
  /* Reset cirúrgico nos descendentes — sem !important global, sem border-color forçado */
  .lunari-pdf * {
    box-sizing: border-box;
    color: #000000;
    text-shadow: none;
    filter: none;
    font-family: Arial, Helvetica, sans-serif;
  }
  /* Garante fundo transparente e sem borda em elementos textuais (evita herança do editor) */
  .lunari-pdf p,
  .lunari-pdf span,
  .lunari-pdf div,
  .lunari-pdf li,
  .lunari-pdf strong,
  .lunari-pdf em,
  .lunari-pdf u,
  .lunari-pdf b,
  .lunari-pdf i,
  .lunari-pdf h1,
  .lunari-pdf h2,
  .lunari-pdf h3,
  .lunari-pdf h4,
  .lunari-pdf h5,
  .lunari-pdf h6 {
    background: transparent;
    border: none;
  }
  .lunari-pdf h1 { font-size: 20px; font-weight: 700; margin: 0 0 4px 0; }
  .lunari-pdf h2 { font-size: 15px; font-weight: 700; margin: 16px 0 8px 0; }
  .lunari-pdf h3 { font-size: 13px; font-weight: 700; margin: 14px 0 6px 0; }
  .lunari-pdf h4, .lunari-pdf h5, .lunari-pdf h6 {
    font-size: 12.5px; font-weight: 700; margin: 12px 0 4px 0;
  }
  .lunari-pdf p { margin: 8px 0; text-align: justify; }
  .lunari-pdf strong, .lunari-pdf b { font-weight: 700; }
  .lunari-pdf em, .lunari-pdf i { font-style: italic; }
  .lunari-pdf u { text-decoration: underline; }
  .lunari-pdf ul { list-style: disc; padding-left: 22px; margin: 8px 0; }
  .lunari-pdf ol { list-style: decimal; padding-left: 22px; margin: 8px 0; }
  .lunari-pdf li { margin: 4px 0; }
  .lunari-pdf blockquote {
    border-left: 3px solid #cccccc;
    padding-left: 12px;
    margin: 12px 0;
    font-style: italic;
  }

  /* Cabeçalho */
  .lunari-pdf .pdf-header {
    border-bottom: 2px solid #000000;
    padding-bottom: 12px;
    margin-bottom: 18px;
  }
  .lunari-pdf .pdf-eyebrow {
    font-size: 10px;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .lunari-pdf .pdf-title { font-size: 20px; font-weight: 700; margin: 0; }
  .lunari-pdf .pdf-header-meta {
    margin-top: 10px;
    font-size: 11px;
    line-height: 1.55;
  }
  .lunari-pdf .pdf-header-meta span + span::before {
    content: ' · ';
  }

  /* Partes (cards) */
  .lunari-pdf .pdf-partes {
    display: flex;
    gap: 14px;
    margin: 14px 0 22px 0;
  }
  .lunari-pdf .pdf-parte {
    flex: 1;
    border: 1px solid #cccccc;
    padding: 10px 12px;
    font-size: 11px;
    line-height: 1.55;
  }
  .lunari-pdf .pdf-parte-label {
    font-size: 9.5px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .lunari-pdf .pdf-parte-nome { font-weight: 700; font-size: 12px; }

  /* Corpo */
  .lunari-pdf .pdf-body { margin-top: 4px; }

  /* Fechamento e assinaturas */
  .lunari-pdf .pdf-fechamento {
    margin-top: 28px;
    font-size: 11.5px;
  }
  .lunari-pdf .pdf-assinaturas {
    margin-top: 46px;
    display: flex;
    gap: 32px;
    page-break-inside: avoid;
  }
  .lunari-pdf .pdf-assinatura { flex: 1; text-align: center; font-size: 11px; }
  .lunari-pdf .pdf-assinatura-linha {
    border-top: 1px solid #000000;
    margin-bottom: 6px;
    height: 1px;
  }
  .lunari-pdf .pdf-assinatura-nome { font-weight: 700; }
  .lunari-pdf .pdf-assinatura-papel {
    font-size: 9.5px;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    margin-top: 2px;
  }

  /* Rodapé */
  .lunari-pdf .pdf-footer {
    margin-top: 30px;
    padding-top: 10px;
    border-top: 1px solid #dddddd;
    font-size: 9.5px;
    text-align: center;
  }

  /* Paginação: só evitar cortar títulos e assinatura */
  .lunari-pdf h1, .lunari-pdf h2, .lunari-pdf h3 { page-break-after: avoid; }
  .lunari-pdf .pdf-assinaturas { page-break-inside: avoid; }
`;

function readVar(snapshot: Record<string, unknown> | null | undefined, key: string): string {
  if (!snapshot) return '';
  const v = (snapshot as any)[key];
  return typeof v === 'string' ? v.trim() : '';
}

function buildMetaHeader(opts: GenerateContratoPdfOptions): string {
  const clienteNome = opts.clienteNome || readVar(opts.variaveisSnapshot, 'nome_cliente');
  const fotografoNome = opts.fotografoNome || readVar(opts.variaveisSnapshot, 'nome_fotografo');
  const dataGeracao = new Date().toLocaleDateString('pt-BR');

  const parts: string[] = [];
  if (clienteNome) parts.push(`<span><strong>Cliente:</strong> ${escapeHtml(clienteNome)}</span>`);
  if (fotografoNome) parts.push(`<span><strong>Fotógrafo:</strong> ${escapeHtml(fotografoNome)}</span>`);
  parts.push(`<span><strong>Emissão:</strong> ${dataGeracao}</span>`);

  return `<div class="pdf-header-meta">${parts.join('')}</div>`;
}

function buildPartesBlock(opts: GenerateContratoPdfOptions): string {
  const clienteNome =
    opts.clienteNome || readVar(opts.variaveisSnapshot, 'nome_cliente') || '—';
  const clienteEmail =
    opts.clienteEmail || readVar(opts.variaveisSnapshot, 'email_cliente');
  const clienteDoc =
    opts.clienteDocumento ||
    readVar(opts.variaveisSnapshot, 'documento_cliente') ||
    readVar(opts.variaveisSnapshot, 'cpf_cliente');

  const fotografoNome =
    opts.fotografoNome || readVar(opts.variaveisSnapshot, 'nome_fotografo') || '—';
  const fotografoEmail =
    opts.fotografoEmail || readVar(opts.variaveisSnapshot, 'email_fotografo');
  const fotografoDoc =
    opts.fotografoDocumento ||
    readVar(opts.variaveisSnapshot, 'documento_fotografo');

  const partes = [
    {
      label: 'CONTRATANTE',
      nome: clienteNome,
      email: clienteEmail,
      doc: clienteDoc,
    },
    {
      label: 'CONTRATADA(O)',
      nome: fotografoNome,
      email: fotografoEmail,
      doc: fotografoDoc,
    },
  ];

  const cards = partes
    .map(
      (p) => `
    <div class="pdf-parte">
      <div class="pdf-parte-label">${p.label}</div>
      <div class="pdf-parte-nome">${escapeHtml(p.nome)}</div>
      ${p.doc ? `<div>Documento: ${escapeHtml(p.doc)}</div>` : ''}
      ${p.email ? `<div>${escapeHtml(p.email)}</div>` : ''}
    </div>`
    )
    .join('');

  return `<div class="pdf-partes">${cards}</div>`;
}

function buildFechamentoBlock(opts: GenerateContratoPdfOptions): string {
  const cidade =
    opts.cidadeLocal ||
    readVar(opts.variaveisSnapshot, 'cidade_atual') ||
    readVar(opts.variaveisSnapshot, 'cidade_fotografo') ||
    readVar(opts.variaveisSnapshot, 'cidade_cliente') ||
    '__________________';
  const dataHoje = new Date().toLocaleDateString('pt-BR');
  return `<div class="pdf-fechamento">${escapeHtml(cidade)}, ${dataHoje}.</div>`;
}

function buildAssinaturasBlock(opts: GenerateContratoPdfOptions): string {
  const clienteNome =
    opts.clienteNome || readVar(opts.variaveisSnapshot, 'nome_cliente') || '';
  const fotografoNome =
    opts.fotografoNome || readVar(opts.variaveisSnapshot, 'nome_fotografo') || '';
  return `
    <div class="pdf-assinaturas">
      <div class="pdf-assinatura">
        <div class="pdf-assinatura-linha"></div>
        <div class="pdf-assinatura-nome">${escapeHtml(clienteNome || '\u00A0')}</div>
        <div class="pdf-assinatura-papel">Contratante</div>
      </div>
      <div class="pdf-assinatura">
        <div class="pdf-assinatura-linha"></div>
        <div class="pdf-assinatura-nome">${escapeHtml(fotografoNome || '\u00A0')}</div>
        <div class="pdf-assinatura-papel">Contratada(o)</div>
      </div>
    </div>`;
}

function buildInnerHtml(opts: GenerateContratoPdfOptions, sanitizedBody: string): string {
  const titulo = escapeHtml(opts.titulo || 'Contrato');
  const dataGeracao = new Date().toLocaleDateString('pt-BR');
  return `
    <div class="pdf-header">
      <div class="pdf-eyebrow">Contrato</div>
      <h1 class="pdf-title">${titulo}</h1>
      ${buildMetaHeader(opts)}
    </div>
    ${buildPartesBlock(opts)}
    <div class="pdf-body">${sanitizedBody || '<p><em>Contrato sem conteúdo.</em></p>'}</div>
    ${buildFechamentoBlock(opts)}
    ${buildAssinaturasBlock(opts)}
    <div class="pdf-footer">Gerado por Lunari · ${dataGeracao}</div>
  `;
}

/* ------------------------------------------------------------------ */
/* Container DOM real (visível off-screen, sem opacity/transform)      */
/* ------------------------------------------------------------------ */

function createRenderContainer(innerHtml: string): { root: HTMLDivElement; styleEl: HTMLStyleElement } {
  // Style injetado no <head> para ter prioridade máxima, só durante a geração.
  const styleEl = document.createElement('style');
  styleEl.setAttribute('data-lunari-pdf', 'true');
  styleEl.textContent = PRINT_CSS;
  document.head.appendChild(styleEl);

  const root = document.createElement('div');
  root.className = 'lunari-pdf';
  root.setAttribute('data-lunari-pdf', 'true');
  root.innerHTML = innerHtml;

  // Render dentro do viewport (html2canvas captura corretamente em todos navegadores).
  // Invisível ao usuário via opacity:0 — sem transform, sem display:none, sem off-screen.
  root.style.position = 'fixed';
  root.style.left = '0';
  root.style.top = '0';
  root.style.width = '794px';
  root.style.opacity = '0';
  root.style.pointerEvents = 'none';
  root.style.zIndex = '-1';
  document.body.appendChild(root);

  return { root, styleEl };
}

function destroyRenderContainer(root: HTMLDivElement, styleEl: HTMLStyleElement) {
  root.parentNode?.removeChild(root);
  styleEl.parentNode?.removeChild(styleEl);
}

async function waitForLayout(): Promise<void> {
  if (typeof document === 'undefined') return;
  const anyDoc = document as any;
  if (anyDoc.fonts?.ready) {
    try { await anyDoc.fonts.ready; } catch { /* noop */ }
  }
  await new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r()))
  );
}

/* ------------------------------------------------------------------ */
/* Motor primário: jsPDF.html() com autoPaging                          */
/* ------------------------------------------------------------------ */

async function generateViaJsPDF(opts: GenerateContratoPdfOptions, innerHtml: string): Promise<Blob> {
  const { root, styleEl } = createRenderContainer(innerHtml);
  try {
    await waitForLayout();

    const rect = root.getBoundingClientRect();
    const firstP = root.querySelector('.pdf-body p, .pdf-body h2, .pdf-body h3');
    const computedColor = firstP ? getComputedStyle(firstP).color : '';
    diag('Container', {
      width: rect.width,
      height: rect.height,
      scrollHeight: root.scrollHeight,
      scrollWidth: root.scrollWidth,
      firstBodyColor: computedColor,
    });

    if (rect.width < 100 || rect.height < 100) {
      throw new Error('Container inválido (dimensões < 100px)');
    }

    const doc = new jsPDF({
      unit: 'px',
      format: 'a4',
      orientation: 'portrait',
      hotfixes: ['px_scaling'],
      compress: true,
    });

    // Largura interna do A4 em px no sistema do jsPDF (~595.28 pt ≈ 794 px a 96dpi)
    // Usamos width do próprio container (794) como referência e deixamos o
    // jsPDF escalar para A4 via hotfix 'px_scaling'.
    await doc.html(root, {
      autoPaging: 'text',
      width: 794,
      windowWidth: 794,
      margin: [24, 24, 28, 24],
      html2canvas: {
        backgroundColor: '#ffffff',
        useCORS: true,
        scale: 2,
        letterRendering: true,
        logging: false,
      },
    });

    const blob = doc.output('blob');
    diag('Blob jsPDF', { size: blob.size });
    if (!blob || blob.size < 2000) {
      throw new Error('jsPDF gerou blob suspeito de vazio');
    }
    return blob;
  } finally {
    destroyRenderContainer(root, styleEl);
  }
}

/* ------------------------------------------------------------------ */
/* Fallback: html2pdf via string (sem DOM real)                         */
/* ------------------------------------------------------------------ */

async function generateViaHtml2Pdf(opts: GenerateContratoPdfOptions, innerHtml: string): Promise<Blob> {
  const html2pdf = (await import('html2pdf.js')).default;
  const filename = opts.filename || `${opts.titulo || 'contrato'}.pdf`;

  const fullHtml = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${escapeHtml(
    opts.titulo || 'Contrato'
  )}</title><style>${PRINT_CSS}</style></head><body style="margin:0;background:#ffffff;">
  <div class="lunari-pdf">${innerHtml}</div>
  </body></html>`;

  const opt = {
    margin: [8, 8, 10, 8] as [number, number, number, number],
    filename,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      letterRendering: true,
      backgroundColor: '#ffffff',
      logging: false,
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

  const blob: Blob = await html2pdf().set(opt as any).from(fullHtml).outputPdf('blob');
  diag('Blob html2pdf fallback', { size: blob?.size });
  if (!blob || blob.size < 2000) {
    throw new Error('html2pdf fallback também falhou (blob pequeno)');
  }
  return blob;
}

/* ------------------------------------------------------------------ */
/* API pública                                                         */
/* ------------------------------------------------------------------ */

export async function generateContratoPdf(opts: GenerateContratoPdfOptions): Promise<Blob> {
  const rawHtml = opts.conteudoHtml || '';
  const plain = htmlToPlainText(rawHtml);

  diag('Entrada', {
    titulo: opts.titulo,
    tamanhoHtml: rawHtml.length,
    tamanhoTextoPuro: plain.length,
    placeholdersRestantes: (rawHtml.match(/\{\{[^}]+\}\}/g) || []),
    cliente: opts.clienteNome,
    fotografo: opts.fotografoNome,
    temSnapshot: !!opts.variaveisSnapshot,
  });

  if (!plain) {
    throw new Error('O contrato está vazio. Adicione conteúdo antes de gerar o PDF.');
  }

  const structured = ensureStructuredHtml(rawHtml);
  const sanitized = sanitizeContratoHtml(structured);
  diag('HTML sanitizado', { tamanho: sanitized.length, amostra: sanitized.slice(0, 240) });

  const innerHtml = buildInnerHtml(opts, sanitized);

  // 1) Motor principal: jsPDF.html com DOM real.
  try {
    return await generateViaJsPDF(opts, innerHtml);
  } catch (err) {
    warn('Motor principal (jsPDF.html) falhou, tentando fallback html2pdf:', err);
  }

  // 2) Fallback: html2pdf via string.
  return await generateViaHtml2Pdf(opts, innerHtml);
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
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/* ------------------------------------------------------------------ */
/* Testes expostos no window para diagnóstico manual                   */
/* ------------------------------------------------------------------ */

export async function __testMinimalPdf(): Promise<Blob> {
  return generateContratoPdf({
    titulo: 'Teste de PDF',
    conteudoHtml: '<h2>Teste</h2><p>Se você lê esta linha no PDF, o motor está funcionando.</p>',
    clienteNome: 'Cliente Teste',
    fotografoNome: 'Fotógrafo Teste',
  });
}

export async function __testLayoutPdf(): Promise<Blob> {
  return generateContratoPdf({
    titulo: 'Contrato de Teste de Layout',
    conteudoHtml: `
      <h2>1. Teste</h2>
      <p>Primeiro parágrafo de teste. <strong>Negrito</strong>, <em>itálico</em>, <u>sublinhado</u>.</p>
      <h3>1.1 Subseção</h3>
      <ul><li>Item A</li><li>Item B</li><li>Item C</li></ul>
      <p>Parágrafo longo para validar justificação e quebras automáticas. ${'Teste '.repeat(80)}</p>
    `,
    clienteNome: 'Cliente Exemplo',
    clienteEmail: 'cliente@exemplo.com',
    fotografoNome: 'Fotógrafo Exemplo',
    fotografoEmail: 'foto@exemplo.com',
    cidadeLocal: 'Cachoeira do Sul - RS',
  });
}

if (typeof window !== 'undefined') {
  (window as any).__testContratoPdf = __testMinimalPdf;
  (window as any).__testContratoPdfLayout = __testLayoutPdf;
}
