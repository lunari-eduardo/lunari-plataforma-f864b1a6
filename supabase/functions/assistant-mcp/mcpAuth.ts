// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import catalog from "./catalog.json" with { type: "json" };
import { normalizeScopes, type ScopeTier } from "../_shared/mcp-scopes.ts";
import { BRIDGED_TOOLS } from "./executor.ts";

export const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
export const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export function admin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface AuthContext {
  userId: string | null;
  tokenId: string | null;
  scopes: string[];
  rolloutAllowed: boolean;
  authSource: "pat" | "oauth" | null;
  clientId: string | null;
  userJwt: string | null;
  reason?: string | null;
}

export const EMPTY_AUTH: AuthContext = {
  userId: null,
  tokenId: null,
  scopes: [],
  rolloutAllowed: false,
  authSource: null,
  clientId: null,
  userJwt: null,
  reason: null,
};

/** Forense: fingerprint irreversível sem jamais logar o segredo. */
export async function fingerprint(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf).slice(0, 6))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Log estruturado único do fluxo — sempre com flow_id para correlação. */
export function flog(flowId: string, stage: string, data: Record<string, unknown>) {
  console.log(`[mcp:${stage}]`, JSON.stringify({ flow_id: flowId, ...data }));
}

export function decodeJwtPayload(jwt: string): Record<string, any> | null {
  try {
    const parts = jwt.split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const json = atob(b64 + pad);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function resolveAuth(req: Request): Promise<AuthContext> {
  const raw = req.headers.get("authorization") ?? "";
  const token = raw.toLowerCase().startsWith("bearer ") ? raw.slice(7).trim() : "";
  if (!token) return { ...EMPTY_AUTH, reason: "no_bearer" };
  const deny = (reason: string): AuthContext => ({ ...EMPTY_AUTH, reason });

  const sb = admin();

  // === Caminho 1: Personal Access Token (PAT) ===
  if (token.startsWith("lmcp_")) {
    const { data, error } = await sb.rpc("assistant_mcp_token_validate", { _token: token });
    if (error || !data || (Array.isArray(data) && data.length === 0)) return deny("pat_invalid_or_revoked");
    const row = Array.isArray(data) ? data[0] : (data as any);
    const userId = row.user_id as string;
    const { data: allowed } = await sb.rpc("assistant_access_allowed", { _uid: userId });
    return {
      userId,
      tokenId: row.token_id as string,
      scopes: normalizeScopes(row.scopes as unknown[]),
      rolloutAllowed: allowed === true,
      authSource: "pat",
      clientId: null,
      userJwt: null,
    };
  }

  // === Caminho 2: JWT do Supabase OAuth Server ===
  if (token.startsWith("eyJ")) {
    const claims = decodeJwtPayload(token);
    if (!claims) return deny("jwt_undecodable");
    if (typeof claims.exp === "number" && claims.exp * 1000 < Date.now()) {
      return deny("jwt_expired");
    }
    const clientId = (claims.client_id as string | undefined) ?? (claims.azp as string | undefined) ?? null;
    if (!clientId) return deny("jwt_missing_client_id");

    const { data: userRes, error: userErr } = await sb.auth.getUser(token);
    if (userErr || !userRes?.user?.id) return deny(`jwt_rejected_by_auth:${userErr?.message ?? "no_user"}`);
    const userId = userRes.user.id;

    const { data: granted } = await sb.rpc("assistant_mcp_grant_resolve", {
      _user_id: userId,
      _client_id: clientId,
      _client_name: (claims.client_name as string | undefined) ?? null,
    });
    const scopes: ScopeTier[] = normalizeScopes(granted as unknown[]);

    const { data: allowed } = await sb.rpc("assistant_access_allowed", { _uid: userId });
    return {
      userId,
      tokenId: null,
      scopes,
      rolloutAllowed: allowed === true,
      authSource: "oauth",
      clientId,
      userJwt: token,
      reason: null,
    };
  }

  return deny("token_format_unrecognized");
}

export interface AuditEntry {
  userId: string | null;
  toolName: string;
  status: string;
  latencyMs: number;
  errorMessage?: string | null;
  authSource?: "pat" | "oauth" | null;
  clientId?: string | null;
  requiredTier?: string | null;
  grantedTiers?: string[] | null;
  requestId?: string | null;
  approvalId?: string | null;
  needsApproval?: boolean;
  approvedBy?: string | null;
}

const CATALOG_BY_NAME: Map<string, any> = new Map(
  ((catalog as any).tools ?? []).map((t: any) => [t.name, t]),
);

export async function audit(entry: AuditEntry) {
  const tool = CATALOG_BY_NAME.get(entry.toolName);
  const capabilityId = tool?.capabilityId ?? entry.toolName;
  const moduleName = capabilityId.includes(".") ? capabilityId.split(".")[0] : "mcp";
  const kind = tool?.kind ?? (tool?.scope === "read" ? "query" : "command");
  try {
    const sb = admin();
    const { error } = await sb.from("assistant_invocations").insert({
      user_id: entry.userId,
      capability_id: capabilityId,
      module: moduleName,
      kind,
      actor: "assistant",
      surface: "mcp",
      tool_name: entry.toolName,
      output_status: entry.status,
      latency_ms: entry.latencyMs,
      error_message: entry.errorMessage ?? null,
      auth_source: entry.authSource ?? null,
      client_id: entry.clientId ?? null,
      required_tier: entry.requiredTier ?? null,
      granted_tiers: entry.grantedTiers ?? null,
      request_id: entry.requestId ?? null,
      approval_id: entry.approvalId ?? null,
      needs_approval: entry.needsApproval ?? false,
      approved_by: entry.approvedBy ?? null,
      approved_at: entry.approvedBy ? new Date().toISOString() : null,
    });
    if (error) console.error("[assistant-mcp] auditoria falhou:", error.message, entry.status, entry.toolName);
  } catch (err) {
    console.error("[assistant-mcp] auditoria exception:", String(err));
  }
}

export async function recordHandshake(entry: {
  flowId: string;
  methods: string[];
  userAgent: string | null;
  hasAuth: boolean;
  authSource: string | null;
  clientId: string | null;
  userId: string | null;
  authReason: string | null;
  protocolVersion: string | null;
  status: number;
  bytes: number;
  latencyMs: number;
}) {
  try {
    const sb = admin();
    const { error } = await sb.from("assistant_mcp_handshakes").insert({
      flow_id: entry.flowId,
      methods: entry.methods,
      user_agent: entry.userAgent,
      has_authorization: entry.hasAuth,
      auth_source: entry.authSource,
      client_id: entry.clientId,
      user_id: entry.userId,
      auth_reason: entry.authReason,
      protocol_version: entry.protocolVersion,
      status: entry.status,
      response_bytes: entry.bytes,
      latency_ms: entry.latencyMs,
    });
    if (error) console.error("[assistant-mcp] handshake log falhou:", error.message);
  } catch (err) {
    console.error("[assistant-mcp] handshake log exception:", String(err));
  }
}

export function inAppFallback(name: string) {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text:
          `A tool "${name}" ainda não roda remotamente. ` +
          `Use lunari_tools_search para achar uma equivalente executável ` +
          `(${Object.keys(BRIDGED_TOOLS).length} disponíveis hoje: agenda, tarefas, clientes, workflow e financeiro) ` +
          `ou execute essa ação na Lu dentro do app (https://app.lunarihub.com).`,
      },
    ],
  };
}

export function needsAuthResponse(name: string) {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text:
          `Autenticação necessária para executar "${name}". ` +
          `Recomendado: conecte via OAuth ("Sign in with Lunari") — clientes como ChatGPT/Claude descobrem o fluxo ` +
          `automaticamente pelo endpoint MCP. Alternativa avançada: gere um Personal Access Token em ` +
          `https://app.lunarihub.com/app/assistente/mcp e envie no header Authorization: Bearer lmcp_...`,
      },
    ],
  };
}

export function rolloutBlockedResponse() {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text:
          `Seu acesso à Lu ainda não está liberado neste estágio de rollout. ` +
          `Peça acesso beta ao administrador.`,
      },
    ],
  };
}
