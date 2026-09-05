// deno-lint-ignore-file no-explicit-any
import catalog from "./catalog.json" with { type: "json" };
import { BRIDGE_SCHEMAS } from "./executor.ts";
import { EXPOSED_TOOLS, META_TOOL_DEFS, isExposed } from "./exposed.ts";
import { toPublicName, publicInputSchema } from "./compat.ts";
import { trimDescription } from "./mcpMetaTools.ts";
import { fingerprint, flog, SUPABASE_URL } from "./mcpAuth.ts";

export const mcpHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, mcp-session-id, mcp-protocol-version, accept",
  "Access-Control-Expose-Headers": "mcp-session-id, mcp-protocol-version, www-authenticate",
};

export const MCP_RESOURCE_URL = `${SUPABASE_URL}/functions/v1/assistant-mcp`;
export const OAUTH_AS_ISSUER = `${SUPABASE_URL}/auth/v1`;
export const AUTHORIZE_PROXY_URL = `${MCP_RESOURCE_URL}/oauth/authorize`;
export const SUPABASE_SUPPORTED_SCOPES = new Set(["openid", "profile", "email", "phone", "offline_access"]);
export const WWW_AUTH_HEADER =
  `Bearer realm="Lunari MCP", ` +
  `resource_metadata="${MCP_RESOURCE_URL}/.well-known/oauth-protected-resource", ` +
  `authorization_uri="${OAUTH_AS_ISSUER}"`;

export function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers: { ...mcpHeaders, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

export async function handleOAuthAuthorize(req: Request, url: URL, flowId: string, httpStarted: number) {
  const incoming = new URLSearchParams(url.search);
  const rawScope = incoming.get("scope") ?? "";
  const requested = rawScope.split(/\s+/).filter(Boolean);
  const kept = requested.filter((s) => SUPABASE_SUPPORTED_SCOPES.has(s));
  const dropped = requested.filter((s) => !SUPABASE_SUPPORTED_SCOPES.has(s));
  if (kept.length === 0 || !kept.includes("openid")) kept.unshift("openid");
  flog(flowId, "oauth-authorize", {
    client_id: incoming.get("client_id"),
    redirect_uri: incoming.get("redirect_uri"),
    response_type: incoming.get("response_type"),
    state_fp: await fingerprint(incoming.get("state")),
    state_len: (incoming.get("state") ?? "").length,
    code_challenge_method: incoming.get("code_challenge_method"),
    code_challenge_fp: await fingerprint(incoming.get("code_challenge")),
    resource: incoming.get("resource"),
    scope_in: rawScope,
    scope_out: kept.join(" "),
    dropped_scopes: dropped,
  });
  incoming.set("scope", Array.from(new Set(kept)).join(" "));
  const target = `${OAUTH_AS_ISSUER}/oauth/authorize?${incoming.toString()}`;
  flog(flowId, "oauth-authorize-redirect", { status: 302, latency_ms: Date.now() - httpStarted });
  return new Response(null, {
    status: 302,
    headers: { ...mcpHeaders, Location: target },
  });
}

export function handleProtectedResourceDiscovery(flowId: string, httpStarted: number) {
  flog(flowId, "discovery", { doc: "protected-resource", status: 200, latency_ms: Date.now() - httpStarted });
  return jsonResponse({
    resource: MCP_RESOURCE_URL,
    authorization_servers: [MCP_RESOURCE_URL, OAUTH_AS_ISSUER],
    bearer_methods_supported: ["header"],
    scopes_supported: ["openid", "email", "profile"],
    resource_documentation:
      "https://modelcontextprotocol.io/specification/2025-06-18/basic/transports",
  });
}

export async function handleAuthorizationServerDiscovery(flowId: string, httpStarted: number) {
  const base = {
    issuer: MCP_RESOURCE_URL,
    authorization_endpoint: AUTHORIZE_PROXY_URL,
    token_endpoint: `${OAUTH_AS_ISSUER}/oauth/token`,
    registration_endpoint: `${OAUTH_AS_ISSUER}/oauth/clients/register`,
    jwks_uri: `${OAUTH_AS_ISSUER}/.well-known/jwks.json`,
    userinfo_endpoint: `${OAUTH_AS_ISSUER}/oauth/userinfo`,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post", "none"],
    scopes_supported: ["openid", "email", "profile"],
  };
  try {
    const upstream = await fetch(`${OAUTH_AS_ISSUER}/.well-known/oauth-authorization-server`);
    const meta = await upstream.json();
    const merged = { ...meta, ...base };
    flog(flowId, "discovery", { doc: "authorization-server", upstream: upstream.status, status: 200, latency_ms: Date.now() - httpStarted });
    return jsonResponse(merged);
  } catch (err) {
    flog(flowId, "discovery", { doc: "authorization-server", upstream: "fetch_failed", error: String(err), status: 200 });
    return jsonResponse(base);
  }
}

export function handleHealthCheck(
  serverInfo: unknown,
  protocolVersion: string,
  supportedVersions: string[],
  catalogAgeDays: () => number,
) {
  const listBytes = JSON.stringify({
    tools: [
      ...catalog.tools.filter((t: any) => isExposed(t.name)).map((t: any) => ({
        name: toPublicName(t.name),
        title: t.title,
        description: trimDescription(t.description),
        inputSchema: publicInputSchema(BRIDGE_SCHEMAS[t.name] ?? t.inputSchema),
        annotations: t.annotations,
      })),
      ...META_TOOL_DEFS.map((t) => ({ ...t, name: toPublicName(t.name), inputSchema: publicInputSchema(t.inputSchema) })),
    ],
  }).length;
  return jsonResponse({
    status: "ok",
    server: serverInfo,
    protocolVersion,
    supportedProtocolVersions: supportedVersions,
    catalog: {
      total: catalog.tools.length,
      core: EXPOSED_TOOLS.length,
      metaTools: META_TOOL_DEFS.length,
      hash: (catalog as any).catalogHash ?? null,
      generatedAt: catalog.generatedAt,
      ageDays: Math.round(catalogAgeDays()),
    },
    toolsList: { tools: EXPOSED_TOOLS.length + META_TOOL_DEFS.length, bytes: listBytes, kb: +(listBytes / 1024).toFixed(1) },
    oauth: {
      issuer: OAUTH_AS_ISSUER,
      protectedResourceMetadata: `${MCP_RESOURCE_URL}/.well-known/oauth-protected-resource`,
    },
  });
}

export function handleSseStream(req: Request) {
  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      controller.enqueue(enc.encode(": lunari-mcp ready\n\n"));
      const iv = setInterval(() => {
        try { controller.enqueue(enc.encode(": ping\n\n")); } catch { clearInterval(iv); }
      }, 25_000);
      (req.signal as AbortSignal | undefined)?.addEventListener("abort", () => {
        clearInterval(iv);
        try { controller.close(); } catch { /* já fechado */ }
      });
    },
  });
  return new Response(stream, {
    headers: {
      ...mcpHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
