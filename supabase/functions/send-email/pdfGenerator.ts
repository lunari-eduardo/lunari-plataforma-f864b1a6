import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';
import { formatCurrency, formatDate } from './helpers.ts';

export function uint8ToBase64(u8Arr: Uint8Array): string {
  const CHUNK_SIZE = 0x8000;
  const length = u8Arr.length;
  let result = '';
  let slice;
  for (let i = 0; i < length; i += CHUNK_SIZE) {
    slice = u8Arr.subarray(i, i + CHUNK_SIZE);
    result += String.fromCharCode.apply(null, slice as unknown as number[]);
  }
  return btoa(result);
}

export async function fetchAndEmbedImage(pdfDoc: any, url: string): Promise<any | null> {
  if (!url) return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    try {
      return await pdfDoc.embedJpg(bytes);
    } catch {
      try {
        return await pdfDoc.embedPng(bytes);
      } catch {
        return null;
      }
    }
  } catch {
    return null;
  }
}

export async function fetchAndEmbedBatch(pdfDoc: any, photos: any[], batchSize = 5): Promise<(any | null)[]> {
  const results: (any | null)[] = [];
  for (let i = 0; i < photos.length; i += batchSize) {
    const batch = photos.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((photo) => {
        const thumbKey = photo.thumb_path || photo.preview_path || photo.storage_key;
        if (!thumbKey) return Promise.resolve(null);
        const url = thumbKey.startsWith('http') ? thumbKey : `https://media.lunarihub.com/${thumbKey}`;
        return fetchAndEmbedImage(pdfDoc, url);
      })
    );
    results.push(...batchResults);
  }
  return results;
}

export function drawPlaceholderBox(page: any, x: number, y: number, size: number, font: any) {
  page.drawRectangle({
    x,
    y,
    width: size,
    height: size,
    color: rgb(0.96, 0.95, 0.94),
    borderColor: rgb(0.88, 0.86, 0.83),
    borderWidth: 1,
  });
  page.drawText('Foto', {
    x: x + size / 2 - 8,
    y: y + size / 2 - 3,
    size: 7,
    font,
    color: rgb(0.55, 0.55, 0.55),
  });
}

export function drawPhotoListItem(
  page: any,
  photo: any,
  img: any,
  x: number,
  y: number,
  width: number,
  height: number,
  thumbSize: number,
  index: number,
  font: any,
  boldFont: any
) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.92, 0.90, 0.87),
    borderWidth: 1,
  });

  const thumbX = x + 4;
  const thumbY = y + (height - thumbSize) / 2;

  if (img) {
    try {
      const scale = Math.min(thumbSize / img.width, thumbSize / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const offX = (thumbSize - drawW) / 2;
      const offY = (thumbSize - drawH) / 2;
      page.drawImage(img, {
        x: thumbX + offX,
        y: thumbY + offY,
        width: drawW,
        height: drawH,
      });
    } catch {
      drawPlaceholderBox(page, thumbX, thumbY, thumbSize, font);
    }
  } else {
    drawPlaceholderBox(page, thumbX, thumbY, thumbSize, font);
  }

  const textX = thumbX + thumbSize + 10;
  const filename = photo.original_filename || photo.filename || `Foto ${index}`;
  const truncatedFilename = filename.length > 26 ? filename.slice(0, 24) + '...' : filename;

  page.drawText(`#${index}`, {
    x: textX,
    y: y + height - 16,
    size: 8,
    font: boldFont,
    color: rgb(0.77, 0.64, 0.41),
  });

  page.drawText(truncatedFilename, {
    x: textX,
    y: y + height - 32,
    size: 9,
    font: boldFont,
    color: rgb(0.15, 0.14, 0.13),
  });
}

export async function generateSummaryPdf(
  supabase: any,
  gallery: any,
  selectedPhotos: any[],
  studioName: string,
  studioLogoUrl?: string | null
): Promise<string> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595.28, 841.89]);
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let currentY = pageHeight - margin;

  // 1. Header (Estúdio & Título)
  page.drawText(studioName, {
    x: margin,
    y: currentY - 14,
    size: 11,
    font: boldFont,
    color: rgb(0.77, 0.64, 0.41),
  });

  const dateStr = formatDate(gallery.finalized_at || new Date());
  page.drawText(`Confirmação em: ${dateStr}`, {
    x: pageWidth - margin - 170,
    y: currentY - 14,
    size: 9,
    font,
    color: rgb(0.45, 0.43, 0.40),
  });

  currentY -= 30;

  page.drawText('Resumo da Seleção de Fotos', {
    x: margin,
    y: currentY - 18,
    size: 20,
    font: boldFont,
    color: rgb(0.11, 0.10, 0.09),
  });

  currentY -= 32;

  page.drawLine({
    start: { x: margin, y: currentY },
    end: { x: pageWidth - margin, y: currentY },
    thickness: 1,
    color: rgb(0.90, 0.88, 0.85),
  });

  currentY -= 15;

  // 2. Quadro de Métricas da Seleção (Sem status de pagamento)
  const cardHeight = 78;
  page.drawRectangle({
    x: margin,
    y: currentY - cardHeight,
    width: contentWidth,
    height: cardHeight,
    color: rgb(0.97, 0.97, 0.96),
    borderColor: rgb(0.91, 0.89, 0.86),
    borderWidth: 1,
  });

  const cardY = currentY - 18;
  page.drawText('Galeria:', { x: margin + 14, y: cardY, size: 9, font: boldFont, color: rgb(0.45, 0.43, 0.40) });
  page.drawText(gallery.nome_sessao || 'Sem nome', { x: margin + 60, y: cardY, size: 9, font: boldFont, color: rgb(0.11, 0.10, 0.09) });

  page.drawText('Cliente:', { x: margin + 14, y: cardY - 16, size: 9, font: boldFont, color: rgb(0.45, 0.43, 0.40) });
  const clientInfoStr = `${gallery.cliente_nome || 'Não informado'}${gallery.cliente_email ? ` (${gallery.cliente_email})` : ''}`;
  page.drawText(clientInfoStr.length > 45 ? clientInfoStr.slice(0, 45) + '...' : clientInfoStr, { x: margin + 60, y: cardY - 16, size: 9, font, color: rgb(0.11, 0.10, 0.09) });

  const metricsY = cardY - 44;
  const colW = contentWidth / 4;

  const metrics = [
    { label: 'FOTOS INCLUÍDAS', val: String(gallery.fotos_incluidas || 0) },
    { label: 'SELECIONADAS', val: String(gallery.fotos_selecionadas || 0) },
    { label: 'FOTOS EXTRAS', val: String(gallery.total_fotos_extras_vendidas || 0) },
    { label: 'VALOR EXTRA', val: formatCurrency(gallery.valor_extras || 0) },
  ];

  metrics.forEach((m, idx) => {
    const mx = margin + idx * colW + 14;
    page.drawText(m.label, { x: mx, y: metricsY + 12, size: 7.5, font: boldFont, color: rgb(0.55, 0.52, 0.48) });
    page.drawText(m.val, { x: mx, y: metricsY, size: 11, font: boldFont, color: rgb(0.11, 0.10, 0.09) });
  });

  currentY -= (cardHeight + 20);

  // 3. Lista de Fotos Selecionadas com Previews
  page.drawText(`Fotos Selecionadas (${selectedPhotos.length})`, {
    x: margin,
    y: currentY - 14,
    size: 13,
    font: boldFont,
    color: rgb(0.11, 0.10, 0.09),
  });

  currentY -= 26;

  const colWidth = (contentWidth - 16) / 2;
  const itemHeight = 56;
  const thumbSize = 48;

  const embeddedImages = await fetchAndEmbedBatch(pdfDoc, selectedPhotos, 5);

  for (let i = 0; i < selectedPhotos.length; i += 2) {
    if (currentY - itemHeight < 50) {
      page = pdfDoc.addPage([595.28, 841.89]);
      currentY = pageHeight - margin - 20;

      page.drawText(`Resumo da Seleção - ${gallery.nome_sessao || ''} (Continuação)`, {
        x: margin,
        y: currentY,
        size: 9,
        font: boldFont,
        color: rgb(0.55, 0.52, 0.48),
      });
      page.drawLine({
        start: { x: margin, y: currentY - 8 },
        end: { x: pageWidth - margin, y: currentY - 8 },
        thickness: 0.5,
        color: rgb(0.90, 0.88, 0.85),
      });
      currentY -= 28;
    }

    const itemY = currentY - itemHeight;

    const photo1 = selectedPhotos[i];
    const img1 = embeddedImages[i];
    drawPhotoListItem(page, photo1, img1, margin, itemY, colWidth, itemHeight, thumbSize, i + 1, font, boldFont);

    if (i + 1 < selectedPhotos.length) {
      const photo2 = selectedPhotos[i + 1];
      const img2 = embeddedImages[i + 1];
      drawPhotoListItem(page, photo2, img2, margin + colWidth + 16, itemY, colWidth, itemHeight, thumbSize, i + 2, font, boldFont);
    }

    currentY -= (itemHeight + 10);
  }

  // 4. Rodapé e numeração de páginas
  const totalPages = pdfDoc.getPageCount();
  const pages = pdfDoc.getPages();
  for (let i = 0; i < totalPages; i++) {
    const p = pages[i];
    p.drawText(`Página ${i + 1} de ${totalPages}  •  Lunari Studio`, {
      x: pageWidth / 2 - 50,
      y: 20,
      size: 8,
      font,
      color: rgb(0.6, 0.6, 0.6),
    });
  }

  const pdfBytes = await pdfDoc.save();
  return uint8ToBase64(pdfBytes);
}
