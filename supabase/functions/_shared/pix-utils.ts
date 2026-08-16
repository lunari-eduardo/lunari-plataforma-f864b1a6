// supabase/functions/_shared/pix-utils.ts
// Gerador de Payload EMV do PIX (BR Code) para cobranças PIX Manual

function crc16(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

function emvField(id: string, value: string): string {
  const length = value.length.toString().padStart(2, "0");
  return `${id}${length}${value}`;
}

function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .toUpperCase()
    .trim();
}

function sanitizeTxId(id: string): string {
  if (!id || id === "***") return "***";
  const sanitized = id.replace(/[^A-Za-z0-9]/g, "");
  if (!sanitized) return "***";
  return sanitized.substring(0, 25);
}

function normalizarChavePix(chave: string): string {
  let chaveLimpa = chave.trim();
  if (/^[0-9]/.test(chaveLimpa)) {
    chaveLimpa = chaveLimpa.replace(/\D/g, "");
    if (chaveLimpa.length === 10 || chaveLimpa.length === 11) {
      chaveLimpa = "+55" + chaveLimpa;
    }
  }
  return chaveLimpa;
}

export interface PixPayloadParams {
  chavePix: string;
  nomeBeneficiario: string;
  valor: number;
  cidade?: string;
  identificador?: string;
}

export function generatePixPayload({
  chavePix,
  nomeBeneficiario,
  valor,
  cidade = "SAO PAULO",
  identificador = "***",
}: PixPayloadParams): string {
  const chaveNormalizada = normalizarChavePix(chavePix);
  const nomeFormatado = normalizeText(nomeBeneficiario).substring(0, 25);
  const cidadeFormatada = normalizeText(cidade).substring(0, 15);
  const valorFormatado = valor.toFixed(2);
  const txId = sanitizeTxId(identificador);

  let payload = "";
  payload += emvField("00", "01");
  const pixAccountInfo = emvField("00", "br.gov.bcb.pix") + emvField("01", chaveNormalizada);
  payload += emvField("26", pixAccountInfo);
  payload += emvField("52", "0000");
  payload += emvField("53", "986");
  if (valor > 0) {
    payload += emvField("54", valorFormatado);
  }
  payload += emvField("58", "BR");
  payload += emvField("59", nomeFormatado);
  payload += emvField("60", cidadeFormatada);
  const additionalData = emvField("05", txId);
  payload += emvField("62", additionalData);
  payload += "6304";
  const checksum = crc16(payload);
  payload += checksum;

  return payload;
}
