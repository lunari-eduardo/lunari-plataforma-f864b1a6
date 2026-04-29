/**
 * Geração de PDF para contratos (refatorado).
 *
 * Estratégia definitiva — espelha o padrão usado pelo PDF financeiro,
 * que funciona consistentemente:
 *
 *  1. Motor PRINCIPAL: monta um HTML COMPLETO ESCOPADO (com <!doctype>,
 *     CSS embutido, fundo branco e texto preto) e entrega como STRING para
 *     `html2pdf().from(html).save()`. Sem container oculto no DOM.
 *  2. Fallback REAL: se o motor principal falhar, gera um PDF SIMPLIFICADO
 *     diretamente via jsPDF puro (texto via `splitTextToSize`), garantindo
 *     que o usuário NUNCA receba um PDF em branco.
 *  3. Sanitização cirúrgica: remove style/class/data-* do HTML do editor
 *     para o documento não herdar o tema dark do app.
 *
 * Diagnóstico: habilitado em preview/dev ou via
 *   localStorage.setItem('debugContratoPdf','1').
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
/* Sanitização do HTML do editor                                       */
/* ------------------------------------------------------------------ */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'div', 'span',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u',
  'ul', 'ol', 'li',
  'blockquote',
]);

function sanitizeBodyHtml(html: string): string {
  if (!html) return '';
  if (typeof window === 'undefined' || typeof document === 'undefined') {
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

function readVar(snapshot: Record<string, unknown> | null | undefined, key: string): string {
  if (!snapshot) return '';
  const v = (snapshot as any)[key];
  return typeof v === 'string' ? v.trim() : '';
}

/* ------------------------------------------------------------------ */
/* Montagem do HTML completo (string isolada do tema do app)           */
/* ------------------------------------------------------------------ */

function buildFullHtml(opts: GenerateContratoPdfOptions, sanitizedBody: string): string {
  const titulo = escapeHtml(opts.titulo || 'Contrato');
  const dataGeracao = new Date().toLocaleDateString('pt-BR');

  const clienteNome = escapeHtml(
    opts.clienteNome || readVar(opts.variaveisSnapshot, 'nome_cliente') || '—'
  );
  const clienteEmail = escapeHtml(
    opts.clienteEmail || readVar(opts.variaveisSnapshot, 'email_cliente') || ''
  );
  const clienteDoc = escapeHtml(
    opts.clienteDocumento ||
      readVar(opts.variaveisSnapshot, 'documento_cliente') ||
      readVar(opts.variaveisSnapshot, 'cpf_cliente') || ''
  );

  const fotografoNome = escapeHtml(
    opts.fotografoNome || readVar(opts.variaveisSnapshot, 'nome_fotografo') || '—'
  );
  const fotografoEmail = escapeHtml(
    opts.fotografoEmail || readVar(opts.variaveisSnapshot, 'email_fotografo') || ''
  );
  const fotografoDoc = escapeHtml(
    opts.fotografoDocumento || readVar(opts.variaveisSnapshot, 'documento_fotografo') || ''
  );

  const cidade = escapeHtml(
    opts.cidadeLocal ||
      readVar(opts.variaveisSnapshot, 'cidade_atual') ||
      readVar(opts.variaveisSnapshot, 'cidade_fotografo') ||
      readVar(opts.variaveisSnapshot, 'cidade_cliente') ||
      '__________________'
  );

  const body = sanitizedBody || '<p><em>Contrato sem conteúdo.</em></p>';

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${titulo}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #ffffff; color: #000000; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12.5px;
    line-height: 1.6;
    padding: 32px 36px;
  }
  h1, h2, h3, h4, h5, h6, p, span, div, li, strong, em, u, b, i {
    color: #000000;
    background: transparent;
  }
  .pdf-header { border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 18px; }
  .pdf-eyebrow { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px; color: #000; }
  .pdf-title { font-size: 20px; font-weight: 700; margin: 0; }
  .pdf-meta { margin-top: 10px; font-size: 11px; line-height: 1.55; }
  .pdf-meta span + span::before { content: ' · '; }
  .pdf-partes { width: 100%; margin: 14px 0 22px 0; border-collapse: separate; border-spacing: 12px 0; }
  .pdf-parte { border: 1px solid #ccc; padding: 10px 12px; font-size: 11px; line-height: 1.55; vertical-align: top; width: 50%; }
  .pdf-parte-label { font-size: 9.5px; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 4px; color: #000; }
  .pdf-parte-nome { font-weight: 700; font-size: 12px; }
  .pdf-body h1 { font-size: 18px; font-weight: 700; margin: 14px 0 6px 0; }
  .pdf-body h2 { font-size: 15px; font-weight: 700; margin: 16px 0 8px 0; }
  .pdf-body h3 { font-size: 13px; font-weight: 700; margin: 14px 0 6px 0; }
  .pdf-body h4, .pdf-body h5, .pdf-body h6 { font-size: 12.5px; font-weight: 700; margin: 12px 0 4px 0; }
  .pdf-body p { margin: 8px 0; text-align: justify; }
  .pdf-body strong, .pdf-body b { font-weight: 700; }
  .pdf-body em, .pdf-body i { font-style: italic; }
  .pdf-body u { text-decoration: underline; }
  .pdf-body ul { list-style: disc; padding-left: 22px; margin: 8px 0; }
  .pdf-body ol { list-style: decimal; padding-left: 22px; margin: 8px 0; }
  .pdf-body li { margin: 4px 0; }
  .pdf-body blockquote { border-left: 3px solid #ccc; padding-left: 12px; margin: 12px 0; font-style: italic; }
  .pdf-fechamento { margin-top: 28px; font-size: 11.5px; }
  .pdf-assinaturas { width: 100%; margin-top: 50px; border-collapse: separate; border-spacing: 24px 0; page-break-inside: avoid; }
  .pdf-assinatura { text-align: center; font-size: 11px; vertical-align: top; width: 50%; }
  .pdf-assinatura-linha { border-top: 1px solid #000; margin-bottom: 6px; height: 1px; }
  .pdf-assinatura-nome { font-weight: 700; }
  .pdf-assinatura-papel { font-size: 9.5px; letter-spacing: 1.2px; text-transform: uppercase; margin-top: 2px; }
  .pdf-footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 9.5px; text-align: center; }
  /* Neutraliza destaques do editor */
  .contrato-var-auto, .contrato-campo-editavel {
    background: transparent !important;
    border: none !important;
    color: inherit !important;
    padding: 0 !important;
  }
</style>
</head>
<body>
  <div class="pdf-header">
    <div class="pdf-eyebrow">Contrato</div>
    <h1 class="pdf-title">${titulo}</h1>
    <div class="pdf-meta">
      <span><strong>Cliente:</strong> ${clienteNome}</span>
      <span><strong>Fotógrafo:</strong> ${fotografoNome}</span>
      <span><strong>Emissão:</strong> ${dataGeracao}</span>
    </div>
  </div>

  <table class="pdf-partes"><tr>
    <td class="pdf-parte">
      <div class="pdf-parte-label">CONTRATANTE</div>
      <div class="pdf-parte-nome">${clienteNome}</div>
      ${clienteDoc ? `<div>Documento: ${clienteDoc}</div>` : ''}
      ${clienteEmail ? `<div>${clienteEmail}</div>` : ''}
    </td>
    <td class="pdf-parte">
      <div class="pdf-parte-label">CONTRATADA(O)</div>
      <div class="pdf-parte-nome">${fotografoNome}</div>
      ${fotografoDoc ? `<div>Documento: ${fotografoDoc}</div>` : ''}
      ${fotografoEmail ? `<div>${fotografoEmail}</div>` : ''}
    </td>
  </tr></table>

  <div class="pdf-body">${body}</div>

  <div class="pdf-fechamento">${cidade}, ${dataGeracao}.</div>

  <table class="pdf-assinaturas"><tr>
    <td class="pdf-assinatura">
      <div class="pdf-assinatura-linha"></div>
      <div class="pdf-assinatura-nome">${clienteNome}</div>
      <div class="pdf-assinatura-papel">Contratante</div>
    </td>
    <td class="pdf-assinatura">
      <div class="pdf-assinatura-linha"></div>
      <div class="pdf-assinatura-nome">${fotografoNome}</div>
      <div class="pdf-assinatura-papel">Contratada(o)</div>
    </td>
  </tr></table>

  <div class="pdf-footer">Gerado por Lunari · ${dataGeracao}</div>
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/* Validação                                                           */
/* ------------------------------------------------------------------ */

async function isLikelyValidPdf(blob: Blob): Promise<boolean> {
  if (!blob || blob.size < 1500) return false;
  try {
    const head = await blob.slice(0, 5).text();
    if (!head.startsWith('%PDF-')) return false;
  } catch {
    return false;
  }
  return blob.size >= 3500;
}

/* ------------------------------------------------------------------ */
/* Motor PRINCIPAL: html2pdf via STRING                                */
/* ------------------------------------------------------------------ */

async function generateViaHtml2Pdf(opts: GenerateContratoPdfOptions, fullHtml: string): Promise<Blob> {
  const html2pdf = (await import('html2pdf.js')).default;

  const opt = {
    margin: [10, 10, 12, 10] as [number, number, number, number], // mm
    filename: opts.filename || `${opts.titulo || 'contrato'}.pdf`,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      letterRendering: true,
      backgroundColor: '#ffffff',
      logging: false,
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
  diag('html2pdf blob', { size: blob?.size });
  if (!(await isLikelyValidPdf(blob))) {
    throw new Error(`html2pdf gerou PDF inválido ou vazio (size=${blob?.size || 0})`);
  }
  return blob;
}

/* ------------------------------------------------------------------ */
/* Fallback REAL: jsPDF puro com texto                                 */
/* ------------------------------------------------------------------ */

function generateViaJsPdfText(opts: GenerateContratoPdfOptions, plainBody: string): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 15;
  const marginTop = 18;
  const marginBottom = 18;
  const contentWidth = pageWidth - marginX * 2;

  let y = marginTop;
  const ensureSpace = (h: number) => {
    if (y + h > pageHeight - marginBottom) {
      doc.addPage();
      y = marginTop;
    }
  };

  const writeBlock = (text: string, fontSize: number, bold = false) => {
    if (!text) return;
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, contentWidth) as string[];
    const lineHeight = fontSize * 0.45;
    for (const line of lines) {
      ensureSpace(lineHeight);
      doc.text(line, marginX, y);
      y += lineHeight;
    }
  };

  // Cabeçalho
  writeBlock(opts.titulo || 'Contrato', 16, true);
  y += 2;
  doc.setDrawColor(0);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 5;

  const clienteNome = opts.clienteNome || readVar(opts.variaveisSnapshot, 'nome_cliente') || '—';
  const fotografoNome = opts.fotografoNome || readVar(opts.variaveisSnapshot, 'nome_fotografo') || '—';
  const dataGeracao = new Date().toLocaleDateString('pt-BR');
  writeBlock(`Cliente: ${clienteNome}    Fotógrafo: ${fotografoNome}    Emissão: ${dataGeracao}`, 9);
  y += 4;

  // Corpo
  const paragraphs = plainBody.split(/\n{2,}/);
  for (const p of paragraphs) {
    if (!p.trim()) continue;
    writeBlock(p.trim(), 11);
    y += 2;
  }

  // Assinaturas
  y += 12;
  ensureSpace(30);
  const halfWidth = (contentWidth - 10) / 2;
  doc.line(marginX, y, marginX + halfWidth, y);
  doc.line(marginX + halfWidth + 10, y, marginX + contentWidth, y);
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(clienteNome, marginX + halfWidth / 2, y, { align: 'center' });
  doc.text(fotografoNome, marginX + halfWidth + 10 + halfWidth / 2, y, { align: 'center' });
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('CONTRATANTE', marginX + halfWidth / 2, y, { align: 'center' });
  doc.text('CONTRATADA(O)', marginX + halfWidth + 10 + halfWidth / 2, y, { align: 'center' });

  // Rodapé
  const footer = `Gerado por Lunari · ${dataGeracao}`;
  doc.setFontSize(8);
  doc.text(footer, pageWidth / 2, pageHeight - 8, { align: 'center' });

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
    placeholdersRestantes: (rawHtml.match(/\{\{[^}]+\}\}/g) || []),
    cliente: opts.clienteNome,
    fotografo: opts.fotografoNome,
    temSnapshot: !!opts.variaveisSnapshot,
  });

  if (!plain) {
    throw new Error('O contrato está vazio. Adicione conteúdo antes de gerar o PDF.');
  }

  const structured = ensureStructuredHtml(rawHtml);
  const sanitized = sanitizeBodyHtml(structured);
  const fullHtml = buildFullHtml(opts, sanitized);
  diag('HTML completo montado', { tamanho: fullHtml.length });

  // 1) Motor principal: html2pdf via STRING (não cria nó oculto no DOM).
  try {
    const blob = await generateViaHtml2Pdf(opts, fullHtml);
    diag('OK via html2pdf-string');
    return blob;
  } catch (err) {
    warn('html2pdf falhou — usando fallback texto via jsPDF puro:', err);
  }

  // 2) Fallback real: jsPDF puro (texto). Garante que NUNCA sai PDF branco.
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
