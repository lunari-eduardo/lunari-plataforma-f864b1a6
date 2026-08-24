import { Context } from 'hono';
import { Bindings } from '../index.js';
import { getBucketBinding } from '../utils/r2-helpers.js';
import { verifyMediaToken } from './gestao-r2-signed-url.js';

export async function mediaDownloadRoute(c: Context<{ Bindings: Bindings }>) {
  try {
    const url = new URL(c.req.url);
    const storagePath = url.searchParams.get("path");
    const expStr = url.searchParams.get("exp");
    const sig = url.searchParams.get("sig");

    if (!storagePath || !expStr || !sig) {
      return c.text("Parâmetros inválidos", 400);
    }

    const exp = parseInt(expStr, 10);
    const now = Math.floor(Date.now() / 1000);

    if (isNaN(exp) || now > exp) {
      return c.text("Link expirado", 403);
    }

    const isValid = await verifyMediaToken(c.env.SUPABASE_SERVICE_ROLE_KEY, storagePath, exp, sig);
    if (!isValid) {
      return c.text("Assinatura inválida", 403);
    }

    const { bucket } = getBucketBinding(c.env, storagePath);
    const object = await bucket.get(storagePath);

    if (!object) {
      return c.text("Arquivo não encontrado", 404);
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("Cache-Control", "private, max-age=300");

    return new Response(object.body, {
      headers,
    });
  } catch (e: any) {
    console.error("[media-download] error", e);
    return c.text("Erro ao carregar arquivo", 500);
  }
}
