/**
 * Geração de PDF para contratos via html2pdf.js
 */

interface GenerateContratoPdfOptions {
  titulo: string;
  conteudoHtml: string;
  fotografoNome?: string;
  fotografoEmail?: string;
  filename?: string;
}

const buildHtmlDocument = (opts: GenerateContratoPdfOptions): string => {
  const { titulo, conteudoHtml, fotografoNome, fotografoEmail } = opts;
  const dataGeracao = new Date().toLocaleDateString('pt-BR');

  return `
    <div style="font-family: 'Helvetica', 'Arial', sans-serif; color: #111827; padding: 40px 48px; max-width: 800px; margin: 0 auto;">
      <header style="border-bottom: 2px solid #111827; padding-bottom: 16px; margin-bottom: 28px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">Contrato</div>
          <h1 style="font-size: 22px; margin: 4px 0 0 0; font-weight: 700;">${titulo}</h1>
        </div>
        <div style="text-align: right; font-size: 11px; color: #6b7280;">
          ${fotografoNome ? `<div style="font-weight:600;color:#111827;">${fotografoNome}</div>` : ''}
          ${fotografoEmail ? `<div>${fotografoEmail}</div>` : ''}
          <div>Emitido em ${dataGeracao}</div>
        </div>
      </header>

      <main style="font-size: 13px; line-height: 1.7; text-align: justify;">
        ${conteudoHtml}
      </main>

      <footer style="margin-top: 64px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; text-align: center;">
        Gerado por Lunari · ${dataGeracao}
      </footer>
    </div>
  `;
};

export async function generateContratoPdf(opts: GenerateContratoPdfOptions): Promise<Blob> {
  const html2pdf = (await import('html2pdf.js')).default;

  const container = document.createElement('div');
  container.innerHTML = buildHtmlDocument(opts);
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  document.body.appendChild(container);

  try {
    const worker = html2pdf()
      .set({
        margin: [10, 0, 12, 0] as [number, number, number, number],
        filename: opts.filename || `${opts.titulo}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      } as any)
      .from(container);

    const blob: Blob = await worker.outputPdf('blob');
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
  URL.revokeObjectURL(url);
}
