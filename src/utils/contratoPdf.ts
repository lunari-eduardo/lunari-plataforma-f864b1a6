/**
 * Geração de PDF para contratos — versão isolada do tema do app.
 *
 * Estratégia:
 *  1. Cria um CONTAINER REAL no DOM (.contrato-pdf-root) com fundo branco,
 *     texto preto e variáveis CSS locais que neutralizam o tema (.dark) do app.
 *     html2pdf precisa de um nó real para o html2canvas capturar fielmente.
 *  2. Monta dentro desse container: cabeçalho institucional, identificação das
 *     partes, corpo do contrato (com cláusulas/parágrafos formatados) e bloco
 *     de assinaturas.
 *  3. Sanitiza o HTML do editor (remove style/class/data-*) e converte texto
 *     puro em parágrafos antes de inserir.
 *  4. Fallback REAL via jsPDF puro com texto, garantindo que o usuário NUNCA
 *     receba PDF em branco.
 */

import jsPDF from 'jspdf';

export interface GenerateContratoPdfOptions {
  titulo: string;
  conteudoHtml: string;
  fotografoNome?: string;
  fotografoEmail?: string;
  fotografoDocumento?: string;
  clienteNome?: string;
  clienteEmail?: string;
  clienteDocumento?: string;
  cidadeLocal?: string;
  variaveisSnapshot?: Record<string, unknown> | null;
  filename?: string;
}

const PDF_TITLE_FIXO = 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS FOTOGRÁFICOS';

/* ------------------------------------------------------------------ */
/* Diagnóstico                                                         */
/* ------------------------------------------------------------------ */

function isDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try { if (window.localStorage?.getItem('debugContratoPdf') === '1') return true; } catch { /* noop */ }
  const host = window.location?.hostname || '';
  return /localhost|127\.0\.0\.1|lovable\.app|preview/.test(host);
}
function diag(...args: unknown[]) { if (isDebugEnabled()) console.log('[ContratoPDF]', ...args); }
function warn(...args: unknown[]) { console.warn('[ContratoPDF]', ...args); }

/* ------------------------------------------------------------------ */
/* Sanitização e normalização do conteúdo                              */
/* ------------------------------------------------------------------ */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'div', 'span',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u',
  'ul', 'ol', 'li',
  'blockquote',
]);

function escapeHtml(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeBodyHtml(html: string): string {
  if (!html) return '';
  if (typeof document === 'undefined') {
    return html
      .replace(/\s(style|class|data-[\w-]+|on[a-z]+|contenteditable|spellcheck)\s*=\s*(["'])[^"']*\2/gi, '')
      .replace(/<(?!\/?(?:p|br|div|span|h[1-6]|strong|b|em|i|u|ul|ol|li|blockquote)\b)[^>]*>/gi, '');
  }
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  const walk = (node: Element) => {
    [...node.attributes].forEach((attr) => node.removeAttribute(attr.name));
    const tag = node.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      const replacement = document.createElement('span');
      while (node.firstChild) replacement.appendChild(node.firstChild);
      node.parentNode?.replaceChild(replacement, node);
      [...replacement.children].forEach(walk);
      return;
    }
    [...node.children].forEach(walk);
  };
  [...wrapper.children].forEach(walk);
  return wrapper.innerHTML;
}

function htmlToPlainText(html: string): string {
  return (html || '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Quando o conteúdo vier sem tags (texto puro do banco), monta parágrafos
 * reais e detecta cláusulas numeradas (1., 2., 1.1, etc.) virando títulos.
 */
function ensureStructuredHtml(html: string): string {
  const trimmed = (html || '').trim();
  if (!trimmed) return '';
  if (/<\s*(p|div|h[1-6]|ul|ol|li|blockquote)\b/i.test(trimmed)) return trimmed;

  return trimmed
    .split(/\n{2,}/)
    .map((block) => {
      const linhas = block.split('\n').map((l) => l.trim()).filter(Boolean);
      return linhas
        .map((linha) => {
          if (/^\d+(\.\d+)*\.\s+/.test(linha) || /^cl[áa]usula\b/i.test(linha)) {
            return `<h3>${escapeHtml(linha)}</h3>`;
          }
          return `<p>${escapeHtml(linha)}</p>`;
        })
        .join('');
    })
    .join('');
}

function readVar(snapshot: Record<string, unknown> | null | undefined, key: string): string {
  if (!snapshot) return '';
  const v = (snapshot as any)[key];
  return typeof v === 'string' ? v.trim() : '';
}

/* ------------------------------------------------------------------ */
/* CSS isolado do tema do app                                          */
/* ------------------------------------------------------------------ */

const PDF_SCOPED_CSS = `
.contrato-pdf-root, .contrato-pdf-root * {
  color: #000 !important;
  background-color: transparent !important;
  border-color: #000 !important;
  opacity: 1 !important;
  text-shadow: none !important;
  filter: none !important;
  font-family: Arial, Helvetica, sans-serif !important;
  box-shadow: none !important;
}
.contrato-pdf-root {
  color-scheme: light only;
  background: #ffffff !important;
  width: 794px;
  min-height: 1123px;
  padding: 48px 56px 56px 56px;
  font-size: 12.5px;
  line-height: 1.6;
  --foreground: 0 0% 0%;
  --background: 0 0% 100%;
  --muted-foreground: 0 0% 30%;
  --border: 0 0% 0%;
  --primary: 0 0% 0%;
  --card: 0 0% 100%;
  --card-foreground: 0 0% 0%;
}
.contrato-pdf-header { text-align: center; padding-bottom: 14px; border-bottom: 2px solid #000 !important; margin-bottom: 18px; }
.contrato-pdf-header .titulo-fixo { font-size: 16px; font-weight: 700; letter-spacing: 0.5px; margin: 0 0 4px 0; }
.contrato-pdf-header .titulo-especifico { font-size: 12px; font-weight: 600; margin: 4px 0 0 0; }
.contrato-pdf-header .data { font-size: 10.5px; margin-top: 6px; }
.contrato-pdf-partes { width: 100%; border-collapse: separate; border-spacing: 12px 0; margin: 0 0 18px 0; }
.contrato-pdf-parte { width: 50%; vertical-align: top; border: 1px solid #000 !important; padding: 10px 12px; font-size: 11px; line-height: 1.5; }
.contrato-pdf-parte .label { font-size: 9.5px; letter-spacing: 1.4px; text-transform: uppercase; font-weight: 700; margin-bottom: 4px; }
.contrato-pdf-parte .nome { font-weight: 700; font-size: 12px; }
.contrato-pdf-body { font-size: 12.5px; line-height: 1.65; }
.contrato-pdf-body h1 { font-size: 17px; font-weight: 700; margin: 16px 0 8px 0; }
.contrato-pdf-body h2 { font-size: 15px; font-weight: 700; margin: 16px 0 8px 0; }
.contrato-pdf-body h3 { font-size: 13px; font-weight: 700; margin: 14px 0 6px 0; }
.contrato-pdf-body h4, .contrato-pdf-body h5, .contrato-pdf-body h6 { font-size: 12.5px; font-weight: 700; margin: 12px 0 4px 0; }
.contrato-pdf-body p { margin: 8px 0; text-align: justify; }
.contrato-pdf-body strong, .contrato-pdf-body b { font-weight: 700; }
.contrato-pdf-body em, .contrato-pdf-body i { font-style: italic; }
.contrato-pdf-body u { text-decoration: underline; }
.contrato-pdf-body ul { list-style: disc; padding-left: 22px; margin: 8px 0; }
.contrato-pdf-body ol { list-style: decimal; padding-left: 22px; margin: 8px 0; }
.contrato-pdf-body li { margin: 4px 0; }
.contrato-pdf-body blockquote { border-left: 3px solid #000 !important; padding-left: 12px; margin: 12px 0; font-style: italic; }
.contrato-pdf-fechamento { margin-top: 28px; font-size: 11.5px; }
.contrato-pdf-assinaturas { width: 100%; border-collapse: separate; border-spacing: 32px 0; margin-top: 60px; page-break-inside: avoid; }
.contrato-pdf-assinatura { width: 50%; vertical-align: top; text-align: center; font-size: 11px; }
.contrato-pdf-assinatura .linha { border-top: 1px solid #000 !important; height: 1px; margin-bottom: 6px; }
.contrato-pdf-assinatura .nome { font-weight: 700; font-size: 11.5px; }
.contrato-pdf-assinatura .papel { font-size: 9.5px; letter-spacing: 1.2px; text-transform: uppercase; margin-top: 2px; }
.contrato-pdf-footer { margin-top: 28px; padding-top: 8px; border-top: 1px solid #000 !important; text-align: center; font-size: 9.5px; }
`;

/* ------------------------------------------------------------------ */
/* Construção do container DOM                                         */
/* ------------------------------------------------------------------ */

function buildPdfRoot(opts: GenerateContratoPdfOptions): HTMLElement {
  const titulo = opts.titulo || 'Contrato';
  const dataGeracao = new Date().toLocaleDateString('pt-BR');

  const clienteNome = opts.clienteNome || readVar(opts.variaveisSnapshot, 'nome_cliente') || '—';
  const clienteEmail = opts.clienteEmail || readVar(opts.variaveisSnapshot, 'email_cliente') || '';
  const clienteDoc = opts.clienteDocumento
    || readVar(opts.variaveisSnapshot, 'documento_cliente')
    || readVar(opts.variaveisSnapshot, 'cpf_cliente') || '';

  const fotografoNome = opts.fotografoNome || readVar(opts.variaveisSnapshot, 'nome_fotografo') || '—';
  const fotografoEmail = opts.fotografoEmail || readVar(opts.variaveisSnapshot, 'email_fotografo') || '';
  const fotografoDoc = opts.fotografoDocumento || readVar(opts.variaveisSnapshot, 'documento_fotografo') || '';

  const cidade = opts.cidadeLocal
    || readVar(opts.variaveisSnapshot, 'cidade_atual')
    || readVar(opts.variaveisSnapshot, 'cidade_fotografo')
    || readVar(opts.variaveisSnapshot, 'cidade_cliente')
    || '__________________';

  const structured = ensureStructuredHtml(opts.conteudoHtml || '');
  const sanitized = sanitizeBodyHtml(structured) || '<p><em>Contrato sem conteúdo.</em></p>';

  // Estilo embutido como elemento <style> dentro do root para garantir escopo
  const styleEl = document.createElement('style');
  styleEl.textContent = PDF_SCOPED_CSS;

  const root = document.createElement('div');
  root.className = 'contrato-pdf-root';
  // Posicionamento seguro fora da tela mas RENDERIZÁVEL (não usar opacity:0
  // ou display:none — html2canvas captura em branco).
  root.style.cssText = [
    'position:fixed',
    'top:0',
    'left:-10000px',
    'width:794px',
    'background:#ffffff',
    'color:#000000',
    'z-index:-1',
    'pointer-events:none',
  ].join(';');

  root.appendChild(styleEl);

  root.insertAdjacentHTML('beforeend', `
    <div class="contrato-pdf-header">
      <h1 class="titulo-fixo">${escapeHtml(PDF_TITLE_FIXO)}</h1>
      ${titulo && titulo.trim().toUpperCase() !== PDF_TITLE_FIXO
        ? `<div class="titulo-especifico">${escapeHtml(titulo)}</div>` : ''}
      <div class="data">Emitido em ${escapeHtml(dataGeracao)}</div>
    </div>

    <table class="contrato-pdf-partes"><tbody><tr>
      <td class="contrato-pdf-parte">
        <div class="label">Contratante</div>
        <div class="nome">${escapeHtml(clienteNome)}</div>
        ${clienteDoc ? `<div>Documento: ${escapeHtml(clienteDoc)}</div>` : ''}
        ${clienteEmail ? `<div>${escapeHtml(clienteEmail)}</div>` : ''}
      </td>
      <td class="contrato-pdf-parte">
        <div class="label">Contratada(o)</div>
        <div class="nome">${escapeHtml(fotografoNome)}</div>
        ${fotografoDoc ? `<div>Documento: ${escapeHtml(fotografoDoc)}</div>` : ''}
        ${fotografoEmail ? `<div>${escapeHtml(fotografoEmail)}</div>` : ''}
      </td>
    </tr></tbody></table>

    <div class="contrato-pdf-body">${sanitized}</div>

    <div class="contrato-pdf-fechamento">${escapeHtml(cidade)}, ${escapeHtml(dataGeracao)}.</div>

    <table class="contrato-pdf-assinaturas"><tbody><tr>
      <td class="contrato-pdf-assinatura">
        <div class="linha"></div>
        <div class="nome">${escapeHtml(clienteNome)}</div>
        <div class="papel">Contratante</div>
      </td>
      <td class="contrato-pdf-assinatura">
        <div class="linha"></div>
        <div class="nome">${escapeHtml(fotografoNome)}</div>
        <div class="papel">Contratada(o)</div>
      </td>
    </tr></tbody></table>

    <div class="contrato-pdf-footer">Documento gerado por Lunari · ${escapeHtml(dataGeracao)}</div>
  `);

  return root;
}

/* ------------------------------------------------------------------ */
/* Validação                                                           */
/* ------------------------------------------------------------------ */

async function isLikelyValidPdf(blob: Blob): Promise<boolean> {
  if (!blob || blob.size < 1500) return false;
  try {
    const head = await blob.slice(0, 5).text();
    if (!head.startsWith('%PDF-')) return false;
  } catch { return false; }
  return blob.size >= 3500;
}

/* ------------------------------------------------------------------ */
/* Motor PRINCIPAL: html2pdf via NÓ DOM real                           */
/* ------------------------------------------------------------------ */

async function generateViaHtml2Pdf(opts: GenerateContratoPdfOptions): Promise<Blob> {
  const html2pdf = (await import('html2pdf.js')).default;

  const root = buildPdfRoot(opts);
  document.body.appendChild(root);

  // Garante que o navegador faça layout antes da captura
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

  const opt = {
    margin: [10, 10, 12, 10] as [number, number, number, number],
    filename: opts.filename || `${opts.titulo || 'contrato'}.pdf`,
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

  try {
    const blob: Blob = await html2pdf().set(opt as any).from(root).outputPdf('blob');
    diag('html2pdf blob', { size: blob?.size });
    if (!(await isLikelyValidPdf(blob))) {
      throw new Error(`html2pdf gerou PDF inválido (size=${blob?.size || 0})`);
    }
    return blob;
  } finally {
    try { root.remove(); } catch { /* noop */ }
  }
}

/* ------------------------------------------------------------------ */
/* Fallback REAL: jsPDF puro com texto                                 */
/* ------------------------------------------------------------------ */

function generateViaJsPdfText(opts: GenerateContratoPdfOptions, plainBody: string): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 18;
  const marginTop = 20;
  const marginBottom = 20;
  const contentWidth = pageWidth - marginX * 2;

  let y = marginTop;
  const ensureSpace = (h: number) => {
    if (y + h > pageHeight - marginBottom) { doc.addPage(); y = marginTop; }
  };
  const writeBlock = (text: string, fontSize: number, bold = false, align: 'left' | 'center' | 'justify' = 'left') => {
    if (!text) return;
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, contentWidth) as string[];
    const lineHeight = fontSize * 0.45;
    for (const line of lines) {
      ensureSpace(lineHeight);
      if (align === 'center') doc.text(line, pageWidth / 2, y, { align: 'center' });
      else doc.text(line, marginX, y);
      y += lineHeight;
    }
  };

  // Cabeçalho fixo
  writeBlock(PDF_TITLE_FIXO, 13, true, 'center');
  if ((opts.titulo || '').trim() && opts.titulo!.trim().toUpperCase() !== PDF_TITLE_FIXO) {
    y += 1;
    writeBlock(opts.titulo!, 11, true, 'center');
  }
  y += 1;
  writeBlock(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, 9, false, 'center');
  y += 2;
  doc.setDrawColor(0); doc.line(marginX, y, pageWidth - marginX, y); y += 5;

  // Identificação das partes
  const clienteNome = opts.clienteNome || readVar(opts.variaveisSnapshot, 'nome_cliente') || '—';
  const fotografoNome = opts.fotografoNome || readVar(opts.variaveisSnapshot, 'nome_fotografo') || '—';
  writeBlock(`CONTRATANTE: ${clienteNome}`, 10, true);
  if (opts.clienteDocumento) writeBlock(`Documento: ${opts.clienteDocumento}`, 9);
  if (opts.clienteEmail) writeBlock(opts.clienteEmail, 9);
  y += 1;
  writeBlock(`CONTRATADA(O): ${fotografoNome}`, 10, true);
  if (opts.fotografoDocumento) writeBlock(`Documento: ${opts.fotografoDocumento}`, 9);
  if (opts.fotografoEmail) writeBlock(opts.fotografoEmail, 9);
  y += 4;

  // Corpo: parágrafos / cláusulas
  const paragraphs = plainBody.split(/\n{2,}/);
  for (const p of paragraphs) {
    const text = p.trim();
    if (!text) continue;
    const isClausula = /^\d+(\.\d+)*\.\s+/.test(text) || /^cl[áa]usula\b/i.test(text);
    writeBlock(text, isClausula ? 11.5 : 11, isClausula);
    y += 2;
  }

  // Assinaturas
  ensureSpace(40);
  y += 18;
  const halfWidth = (contentWidth - 16) / 2;
  doc.line(marginX, y, marginX + halfWidth, y);
  doc.line(marginX + halfWidth + 16, y, marginX + contentWidth, y);
  y += 4;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text(clienteNome, marginX + halfWidth / 2, y, { align: 'center' });
  doc.text(fotografoNome, marginX + halfWidth + 16 + halfWidth / 2, y, { align: 'center' });
  y += 4;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.text('CONTRATANTE', marginX + halfWidth / 2, y, { align: 'center' });
  doc.text('CONTRATADA(O)', marginX + halfWidth + 16 + halfWidth / 2, y, { align: 'center' });

  // Rodapé
  doc.setFontSize(8);
  doc.text(`Documento gerado por Lunari · ${new Date().toLocaleDateString('pt-BR')}`, pageWidth / 2, pageHeight - 8, { align: 'center' });

  return doc.output('blob');
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
    cliente: opts.clienteNome,
    fotografo: opts.fotografoNome,
  });

  if (!plain) throw new Error('O contrato está vazio. Adicione conteúdo antes de gerar o PDF.');

  // 1) Motor principal: html2pdf via NÓ DOM real (isolado do tema)
  try {
    const blob = await generateViaHtml2Pdf(opts);
    diag('OK via html2pdf-dom');
    return blob;
  } catch (err) {
    warn('html2pdf falhou — usando fallback texto via jsPDF puro:', err);
  }

  // 2) Fallback real: jsPDF puro
  const blob = generateViaJsPdfText(opts, plain);
  diag('OK via jspdf-text-fallback', { size: blob.size });
  return blob;
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
/* Testes manuais — expostos no window                                 */
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
      <h3>1. Do objeto</h3>
      <p>Primeiro parágrafo de teste com <strong>negrito</strong>, <em>itálico</em> e <u>sublinhado</u>.</p>
      <h3>2. Das obrigações</h3>
      <ul><li>Item A</li><li>Item B</li><li>Item C</li></ul>
      <p>${'Parágrafo longo para validar justificação. '.repeat(20)}</p>
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
