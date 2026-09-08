import { Context } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { Bindings } from '../index.js';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Sanitiza texto para garantir compatibilidade estrita com a codificação WinAnsi
 * das fontes padrão (StandardFonts.Helvetica) do pdf-lib, prevenindo crashes
 * com caracteres acentuados ou emojis.
 */
function sanitizePdfText(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^\x20-\x7E]/g, ' ')  // mantém apenas caracteres ASCII imprimíveis
    .trim();
}

export async function contractsNativeSignRoute(c: Context<{ Bindings: Bindings }>) {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { token, signature_image, name, cpf, geolocation } = body;

    if (!token || !signature_image || !name || !cpf) {
      return c.json({ error: "Dados incompletos para assinatura" }, 400);
    }

    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'Desconhecido';
    const userAgent = c.req.header('user-agent') || 'Desconhecido';

    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. Validar token e contrato
    const { data: contrato, error: contratoErr } = await supabase
      .from("contratos")
      .select("id, user_id, status, original_file_path, titulo")
      .eq("signature_token", token)
      .single();

    if (contratoErr || !contrato) {
      return c.json({ error: "Contrato não encontrado" }, 404);
    }

    if (contrato.status === 'assinado') {
      return c.json({ error: "Este contrato já foi assinado." }, 400);
    }

    if (contrato.status === 'cancelado') {
      return c.json({ error: "Este contrato foi cancelado pelo emissor." }, 400);
    }

    if (!contrato.original_file_path) {
      return c.json({ error: "Arquivo original não encontrado. Contrato inválido." }, 400);
    }

    // 2. Buscar PDF original no R2
    const originalPdfObject = await c.env.LUNARI_PRIVATE.get(contrato.original_file_path);
    if (!originalPdfObject) {
      return c.json({ error: "PDF original não localizado no armazenamento R2." }, 500);
    }
    
    const originalPdfBytes = await originalPdfObject.arrayBuffer();

    // 3. Processar PDF com pdf-lib
    const pdfDoc = await PDFDocument.load(originalPdfBytes);
    
    // Anexar folha de auditoria
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Faixa superior decorativa
    page.drawRectangle({
      x: 40,
      y: height - 60,
      width: width - 80,
      height: 30,
      color: rgb(0.08, 0.12, 0.2), // Navy blue
    });

    page.drawText('TRILHA DE AUDITORIA E ASSINATURA ELETRONICA', {
      x: 55,
      y: height - 48,
      size: 12,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    const timestamp = new Date().toISOString();
    const formattedDate = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    // Caixa de Informações
    page.drawRectangle({
      x: 40,
      y: height - 240,
      width: width - 80,
      height: 165,
      borderColor: rgb(0.85, 0.88, 0.92),
      borderWidth: 1,
      color: rgb(0.98, 0.99, 1),
    });

    const metadataLines = [
      `ID do Documento: ${contrato.id}`,
      `Data e Hora (Brasilia): ${formattedDate} (UTC: ${timestamp})`,
      `Signatario: ${sanitizePdfText(name)}`,
      `CPF: ${cpf.replace(/[^\d.-]/g, '')}`,
      `Endereco IP: ${ipAddress.substring(0, 45)}`,
      `Dispositivo / Navegador: ${sanitizePdfText(userAgent).substring(0, 80)}`,
      `Geolocalizacao aproximada: ${geolocation ? `${geolocation.latitude}, ${geolocation.longitude}` : 'Nao autorizada pelo usuario'}`,
    ];

    let yOffset = height - 90;
    for (const text of metadataLines) {
      page.drawText(text, {
        x: 55,
        y: yOffset,
        size: 9.5,
        font: font,
        color: rgb(0.2, 0.25, 0.3),
      });
      yOffset -= 20;
    }

    // Texto legal
    page.drawText('Documento assinado em conformidade com a MP 2.200-2/2001 e a Lei 14.063/2020.', {
      x: 55,
      y: height - 230,
      size: 8.5,
      font: fontBold,
      color: rgb(0.3, 0.4, 0.5),
    });

    // Bloco da Assinatura Gráfica
    page.drawRectangle({
      x: 40,
      y: height - 420,
      width: width - 80,
      height: 160,
      borderColor: rgb(0.85, 0.88, 0.92),
      borderWidth: 1,
      color: rgb(1, 1, 1),
    });

    page.drawText('Representacao Grafica da Assinatura:', {
      x: 55,
      y: height - 275,
      size: 11,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });

    // Embutir imagem do desenho
    try {
      const cleanBase64 = signature_image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
      const imageBytes = Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));
      
      let signatureImage;
      if (signature_image.includes('image/jpeg') || signature_image.includes('image/jpg')) {
        signatureImage = await pdfDoc.embedJpg(imageBytes);
      } else {
        signatureImage = await pdfDoc.embedPng(imageBytes);
      }
      
      const sigDims = signatureImage.scale(0.45);
      const targetHeight = Math.min(sigDims.height, 90);
      const targetWidth = (sigDims.width / sigDims.height) * targetHeight;
      
      page.drawImage(signatureImage, {
        x: 55,
        y: height - 390,
        width: Math.min(targetWidth, width - 120),
        height: targetHeight,
      });

      page.drawText(`Assinado digitalmente por ${sanitizePdfText(name)}`, {
        x: 55,
        y: height - 410,
        size: 8,
        font: font,
        color: rgb(0.5, 0.5, 0.5),
      });
    } catch (imgErr) {
      console.warn("Nao foi possivel embutir imagem da assinatura", imgErr);
      page.drawText('[Registro gráfico não disponível]', { x: 55, y: height - 350, size: 10, font: font, color: rgb(0.8, 0.2, 0.2) });
    }

    // Rodapé de integridade
    page.drawText('Plataforma Lunari - Sistema de Gestao para Fotografos e Criadores - www.lunarihub.com', {
      x: 40,
      y: 35,
      size: 8,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });

    const finalPdfBytes = await pdfDoc.save();

    // Calcular Hash SHA-256 do documento final
    const hashBuffer = await crypto.subtle.digest('SHA-256', finalPdfBytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const documentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // 4. Salvar PDF assinado no R2
    const finalStoragePath = `gestao/contratos-assinados/${contrato.user_id}/${contrato.id}/final.pdf`;
    
    await c.env.LUNARI_PRIVATE.put(finalStoragePath, finalPdfBytes, {
      httpMetadata: {
        contentType: "application/pdf",
        contentDisposition: "inline",
      },
    });

    const sanitizedTitle = (contrato.titulo || "contrato")
      .replace(/[^a-zA-Z0-9_\-\.]/g, "_")
      .substring(0, 50);
    const arquivoNome = `${sanitizedTitle}-assinado.pdf`;

    // 5. Atualizar Registro do Contrato no Supabase
    const { error: updateErr } = await supabase
      .from("contratos")
      .update({
        status: "assinado",
        assinado_em: timestamp,
        arquivo_assinado_path: finalStoragePath,
        r2_arquivo_assinado_path: finalStoragePath,
        arquivo_assinado_nome: arquivoNome,
        arquivo_assinado_tamanho: finalPdfBytes.byteLength,
      })
      .eq("id", contrato.id);

    if (updateErr) {
      console.error("Erro ao atualizar contrato:", updateErr);
      return c.json({ error: "Erro ao atualizar registro do contrato" }, 500);
    }

    // 6. Gravar Trilha de Auditoria
    const { error: auditErr } = await supabase
      .from("contrato_audit_logs")
      .insert({
        contrato_id: contrato.id,
        ip_address: ipAddress,
        user_agent: userAgent,
        geolocation: geolocation || null,
        signed_name: name,
        signed_cpf: cpf,
        document_hash: documentHash
      });

    if (auditErr) {
      console.error("Erro ao gravar trilha de auditoria:", auditErr);
    }

    return c.json({
      success: true,
      message: "Contrato assinado com sucesso",
      document_hash: documentHash,
      download_url: `/api/contracts/native/download/${token}`
    });

  } catch (e: any) {
    console.error("[contracts-native-sign] error", e);
    return c.json({ error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
}
