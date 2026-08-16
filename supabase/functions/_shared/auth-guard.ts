// supabase/functions/_shared/auth-guard.ts
// Utilitário compartilhado de autenticação e autorização para Edge Functions do Lunari

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-lunari-internal-caller, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function errorResponse(error: string, status = 400, code?: string, details?: unknown) {
  return jsonResponse(
    {
      success: false,
      error,
      code: code || (status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : "BAD_REQUEST"),
      ...(details ? { details } : {}),
    },
    status
  );
}

/**
 * Valida se a requisição possui JWT válido de usuário fotógrafo (Studio / Workflow).
 * Extrai o userId diretamente do token criptografado.
 */
export async function requireUserAuth(
  req: Request,
  supabase: SupabaseClient
): Promise<{ userId: string; email?: string; errorResponse?: null } | { userId?: null; email?: null; errorResponse: Response }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { errorResponse: errorResponse("Cabeçalho de autorização ausente ou inválido", 401, "MISSING_AUTH") };
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return { errorResponse: errorResponse("Token de autenticação não fornecido", 401, "EMPTY_TOKEN") };
  }

  try {
    // 1. Tentar validação rápida via getClaims se disponível
    const { data: claimsData, error: claimsError } = await (supabase.auth as any).getClaims(token);
    if (!claimsError && claimsData?.claims?.sub) {
      return {
        userId: claimsData.claims.sub as string,
        email: claimsData.claims.email as string | undefined,
        errorResponse: null,
      };
    }

    // 2. Fallback via getUser
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) {
      return { errorResponse: errorResponse("Sessão expirada ou token inválido. Faça login novamente.", 401, "INVALID_SESSION") };
    }

    return {
      userId: userData.user.id,
      email: userData.user.email,
      errorResponse: null,
    };
  } catch (err: any) {
    console.error("[auth-guard] Erro inesperado na validação de usuário:", err);
    return { errorResponse: errorResponse("Falha ao validar autenticação do usuário", 401, "AUTH_VALIDATION_ERROR") };
  }
}

/**
 * Valida se a requisição é estritamente Server-to-Server com Service Role Key.
 * Usado para proteger adaptadores de gateway contra chamadas de browsers/clientes anônimos.
 */
export function requireServiceRole(
  req: Request
): { isServiceRole: true; errorResponse?: null } | { isServiceRole: false; errorResponse: Response } {
  const authHeader = req.headers.get("Authorization");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!authHeader?.startsWith("Bearer ") || !serviceKey) {
    return {
      isServiceRole: false,
      errorResponse: errorResponse("Acesso não autorizado: chave de serviço obrigatória", 403, "SERVICE_ROLE_REQUIRED"),
    };
  }

  const token = authHeader.replace("Bearer ", "").trim();

  // 1. Comparação direta com a chave do ambiente
  if (token === serviceKey) {
    return { isServiceRole: true, errorResponse: null };
  }

  // 2. Decodificação do payload do JWT para checar claim `role: 'service_role'`
  try {
    const parts = token.split(".");
    if (parts.length === 3) {
      const payloadBase64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const decodedPayload = JSON.parse(atob(payloadBase64));
      if (decodedPayload.role === "service_role") {
        return { isServiceRole: true, errorResponse: null };
      }
    }
  } catch {
    // Ignora erro de parse e rejeita abaixo
  }

  return {
    isServiceRole: false,
    errorResponse: errorResponse("Acesso proibido: somente chamadas internas autenticadas são permitidas", 403, "FORBIDDEN"),
  };
}

/**
 * Resolve a autenticação do chamador de forma híbrida:
 * - Se for Service Role: retorna authType = 'service_role'
 * - Se for JWT de Usuário: retorna authType = 'user' com o userId verificado
 * - Se for inválido: retorna errorResponse com HTTP 401/403
 */
export async function resolveCallerAuth(
  req: Request,
  supabase: SupabaseClient
): Promise<
  | { authType: "service_role"; userId?: string; errorResponse: null }
  | { authType: "user"; userId: string; email?: string; errorResponse: null }
  | { authType: null; userId: null; errorResponse: Response }
> {
  const serviceCheck = requireServiceRole(req);
  if (serviceCheck.isServiceRole) {
    return { authType: "service_role", errorResponse: null };
  }

  const userCheck = await requireUserAuth(req, supabase);
  if (!userCheck.errorResponse && userCheck.userId) {
    return { authType: "user", userId: userCheck.userId, email: userCheck.email, errorResponse: null };
  }

  return { authType: null, userId: null, errorResponse: userCheck.errorResponse };
}
