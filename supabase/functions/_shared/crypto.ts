/**
 * Helper compartilhado para criptografia/descriptografia de chaves de API em repouso.
 * 
 * Padrão: AES-256-GCM com IV de 96 bits (12 bytes) e autenticação de integridade.
 * Formato do payload cifrado: `enc:v1:<base64_iv>:<base64_ciphertext_and_tag>`
 * 
 * Retrocompatibilidade:
 * Se um token não contiver o prefixo `enc:v1:`, `decryptToken` o retorna como texto plano,
 * permitindo convívio seguro com registros legados.
 */

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

let cachedCryptoKey: CryptoKey | null = null;

async function getMasterKey(): Promise<CryptoKey> {
  if (cachedCryptoKey) {
    return cachedCryptoKey;
  }

  // 1. Chave dedicada de criptografia definida nos secrets do Supabase
  const dedicatedKey = Deno.env.get("GATEWAY_ENCRYPTION_KEY");

  // 2. Fallback determinístico caso o segredo específico ainda não tenha sido definido
  const fallbackSource =
    dedicatedKey ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    "lunari-studio-fallback-gateway-key-2026";

  if (!dedicatedKey) {
    console.warn(
      "[crypto] AVISO: 'GATEWAY_ENCRYPTION_KEY' não configurada. Utilizando derivação automática a partir do service_role."
    );
  }

  // Deriva exatamente 256 bits (32 bytes) usando SHA-256
  const keyMaterial = new TextEncoder().encode(fallbackSource);
  const hashBuffer = await crypto.subtle.digest("SHA-256", keyMaterial);

  cachedCryptoKey = await crypto.subtle.importKey(
    "raw",
    hashBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );

  return cachedCryptoKey;
}

/**
 * Criptografa um token ou chave em texto plano usando AES-256-GCM.
 * Retorna string no formato `enc:v1:<iv_b64>:<cipher_b64>`.
 */
export async function encryptToken(plainText: string): Promise<string> {
  if (!plainText || typeof plainText !== "string") {
    return "";
  }

  // Se já estiver criptografado, não criptografa novamente
  if (plainText.startsWith("enc:v1:")) {
    return plainText;
  }

  const key = await getMasterKey();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96 bits recomendado para GCM
  const encoded = new TextEncoder().encode(plainText.trim());

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );

  const ivB64 = uint8ArrayToBase64(iv);
  const cipherB64 = uint8ArrayToBase64(new Uint8Array(cipherBuffer));

  return `enc:v1:${ivB64}:${cipherB64}`;
}

/**
 * Descriptografa um token cifrado.
 * Se o token não começar com `enc:v1:`, retorna o valor original (fallback texto plano legado).
 */
export async function decryptToken(cipherOrPlain: string | null | undefined): Promise<string> {
  if (!cipherOrPlain || typeof cipherOrPlain !== "string") {
    return "";
  }

  const trimmed = cipherOrPlain.trim();

  // Retrocompatibilidade: chave legada em texto puro
  if (!trimmed.startsWith("enc:v1:")) {
    return trimmed;
  }

  const parts = trimmed.split(":");
  if (parts.length !== 4) {
    throw new Error("[crypto] Formato inválido de token cifrado (esperado enc:v1:iv:cipher)");
  }

  const [, , ivB64, cipherB64] = parts;
  const iv = base64ToUint8Array(ivB64);
  const cipherBytes = base64ToUint8Array(cipherB64);
  const key = await getMasterKey();

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      cipherBytes
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (err) {
    console.error("[crypto] Falha ao descriptografar token:", err);
    throw new Error("Falha na autenticação/descriptografia do token de integração.");
  }
}
