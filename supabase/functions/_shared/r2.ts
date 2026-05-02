/**
 * Cloudflare R2 helpers (AWS Sig V4) — shared by all r2-* edge functions.
 */

export const R2_BUCKET = "lunari-previews";
export const R2_CDN_BASE = "https://media.lunarihub.com";

export interface R2Creds {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export function getR2Creds(): R2Creds {
  const accountId = Deno.env.get("R2_ACCOUNT_ID");
  const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
  const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 credentials not configured");
  }
  return { accountId, accessKeyId, secretAccessKey };
}

async function sha256Hex(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  const buffer = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
}

async function hmacHex(key: ArrayBuffer, data: string): Promise<string> {
  const sig = await hmac(key, data);
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getSignatureKey(
  key: string,
  dateStamp: string,
  region: string,
  service: string
): Promise<ArrayBuffer> {
  const kDate = await hmac(new TextEncoder().encode("AWS4" + key), dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

/** PUT object */
export async function r2Put(
  creds: R2Creds,
  key: string,
  body: ArrayBuffer,
  contentType: string,
  bucket = R2_BUCKET
): Promise<void> {
  const host = `${creds.accountId}.r2.cloudflarestorage.com`;
  const url = `https://${host}/${bucket}/${key}`;
  const date = new Date();
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const region = "auto";
  const service = "s3";
  const canonicalUri = `/${bucket}/${key}`;
  const payloadHash = await sha256Hex(body);
  const canonicalHeaders =
    [
      `content-type:${contentType}`,
      `host:${host}`,
      `x-amz-content-sha256:${payloadHash}`,
      `x-amz-date:${amzDate}`,
    ].join("\n") + "\n";
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = ["PUT", canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [algorithm, amzDate, credentialScope, await sha256Hex(canonicalRequest)].join("\n");
  const signingKey = await getSignatureKey(creds.secretAccessKey, dateStamp, region, service);
  const signature = await hmacHex(signingKey, stringToSign);
  const authorization = `${algorithm} Credential=${creds.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: authorization,
    },
    body,
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`R2 PUT failed: ${response.status} - ${error}`);
  }
}

/** DELETE object */
export async function r2Delete(creds: R2Creds, key: string, bucket = R2_BUCKET): Promise<void> {
  const host = `${creds.accountId}.r2.cloudflarestorage.com`;
  const url = `https://${host}/${bucket}/${key}`;
  const date = new Date();
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const region = "auto";
  const service = "s3";
  const canonicalUri = `/${bucket}/${key}`;
  const payloadHash = await sha256Hex("");
  const canonicalHeaders =
    [`host:${host}`, `x-amz-content-sha256:${payloadHash}`, `x-amz-date:${amzDate}`].join("\n") + "\n";
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = ["DELETE", canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [algorithm, amzDate, credentialScope, await sha256Hex(canonicalRequest)].join("\n");
  const signingKey = await getSignatureKey(creds.secretAccessKey, dateStamp, region, service);
  const signature = await hmacHex(signingKey, stringToSign);
  const authorization = `${algorithm} Credential=${creds.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: authorization,
    },
  });
  if (!response.ok && response.status !== 404) {
    const error = await response.text();
    throw new Error(`R2 DELETE failed: ${response.status} - ${error}`);
  }
}

/** Generate a presigned GET URL (S3 Sig V4 query-string auth). */
export async function r2PresignedGetUrl(
  creds: R2Creds,
  key: string,
  expiresInSec = 300,
  bucket = R2_BUCKET
): Promise<string> {
  const host = `${creds.accountId}.r2.cloudflarestorage.com`;
  const date = new Date();
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const region = "auto";
  const service = "s3";
  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const canonicalUri = `/${bucket}/${encodeURIComponent(key).replace(/%2F/g, "/")}`;
  const params = new URLSearchParams();
  params.set("X-Amz-Algorithm", algorithm);
  params.set("X-Amz-Credential", `${creds.accessKeyId}/${credentialScope}`);
  params.set("X-Amz-Date", amzDate);
  params.set("X-Amz-Expires", String(expiresInSec));
  params.set("X-Amz-SignedHeaders", "host");
  // Sort keys
  const canonicalQuery = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = "host";
  const payloadHash = "UNSIGNED-PAYLOAD";
  const canonicalRequest = ["GET", canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const stringToSign = [algorithm, amzDate, credentialScope, await sha256Hex(canonicalRequest)].join("\n");
  const signingKey = await getSignatureKey(creds.secretAccessKey, dateStamp, region, service);
  const signature = await hmacHex(signingKey, stringToSign);

  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
