/**
 * assistant-mcp — Onda F.2
 *
 * Servidor MCP (Model Context Protocol) público do Lunari via Streamable HTTP.
 * Gate de rollout verificado via RPC "assistant_access_allowed" em mcpAuth.ts.
 */
// deno-lint-ignore-file no-explicit-any
import catalog from "./catalog.json" with { type: "json" };
import { BRIDGED_TOOLS } from "./executor.ts";
import { EXPOSED_TOOLS, META_TOOL_DEFS, META_SEARCH, META_DESCRIBE, META_INVOKE, CATALOG_SIZE, DOMAIN_LABELS } from "./exposed.ts";
import { toPublicName } from "./compat.ts";
import type { CatalogTool } from "../_shared/capability-dispatch.ts";
import {
  resolveAuth,
  recordHandshake,
  fingerprint,
  flog,
  decodeJwtPayload,
  OAUTH_AS_ISSUER,
  MCP_RESOURCE_URL,
} from "./mcpAuth.ts";
import {
  mcpHeaders,
  jsonResponse,
  WWW_AUTH_HEADER,
  handleOAuthAuthorize,
  handleProtectedResourceDiscovery,
  handleAuthorizationServerDiscovery,
  handleHealthCheck,
  handleSseStream,
} from "./mcpDiscovery.ts";
import {
  handleMethod,
  rpcError,
  type JsonRpcRequest,
} from "./mcpCallHandler.ts";

/** A2 — índice do catálogo por nome de tool. */
const CATALOG_BY_NAME: Map<string, CatalogTool> = new Map(
  ((catalog as any).tools ?? []).map((t: CatalogTool) => [t.name, t]),
);

/** Alias público → nome interno. */
const PUBLIC_TO_INTERNAL: Map<string, string> = new Map(
  [...CATALOG_BY_NAME.keys(), META_SEARCH, META_DESCRIBE, META_INVOKE].map((n) => [toPublicName(n), n]),
);
function resolveToolName(name: string): string {
  if (CATALOG_BY_NAME.has(name) || name === META_SEARCH || name === META_DESCRIBE || name === META_INVOKE) return name;
  return PUBLIC_TO_INTERNAL.get(name) ?? name;
}

/** A3 — idade do catálogo em dias. */
const CATALOG_STALE_DAYS = 30;
function catalogAgeDays(): number {
  const t = Date.parse((catalog as any).generatedAt ?? "");
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return (Date.now() - t) / 86_400_000;
}
if (catalogAgeDays() > CATALOG_STALE_DAYS) {
  console.warn(
    `[assistant-mcp] catálogo gerado há ${Math.round(catalogAgeDays())} dias — ` +
      "o pipeline de regeneração pode ter parado (bun run mcp:catalog).",
  );
}

const SERVER_INFO = {
  name: catalog.manifest.name,
  title: catalog.manifest.title,
  version: "0.19.0",
};

const DOMAIN_COUNTS: Map<string, number> = new Map();
for (const t of (catalog as any).tools ?? []) {
  const d = String((t as any).capabilityId ?? "").split(".")[0];
  if (d) DOMAIN_COUNTS.set(d, (DOMAIN_COUNTS.get(d) ?? 0) + 1);
}
const DOMAIN_INDEX: string = [...DOMAIN_COUNTS.entries()]
  .sort((a, b) => b[1] - a[1])
  .map(([d, n]) => `${DOMAIN_LABELS[d] ?? d} (${n})`)
  .join(" · ");

const INSTRUCTIONS =
  `${catalog.manifest.instructions}\n\n` +
  `As ferramentas visíveis cobrem a rotina diária (agenda, workflow, clientes, tarefas, financeiro, leads, resumo de vendas). ` +
  `O Lunari tem ${CATALOG_SIZE} ferramentas no total — as demais (precificação, configurações, contratos, ` +
  `formulários, galeria, relatórios de vendas detalhados, metas, diagnósticos) NÃO são listadas aqui para manter a conexão leve, ` +
  `mas TODAS estão disponíveis. Antes de dizer que algo não é possível, use: ` +
  `lunari.tools.search (achar) → lunari.tools.describe (ver parâmetros) → lunari.tools.invoke (executar).` +
  (DOMAIN_INDEX ? `\nDomínios disponíveis: ${DOMAIN_INDEX}.` : "") +
  `\n\nCONTRATO needs_input: quando uma resposta trouxer structuredContent.status = "needs_input", ela NÃO é erro nem falha. ` +
  `Significa que falta um dado obrigatório (campos em "missing"). Faça a pergunta em "question" ao usuário, ` +
  `mostrando as alternativas de "options" (use o campo value ao reenviar), e só então repita a chamada com o campo preenchido. ` +
  `Nunca escolha uma opção por conta própria, nunca invente valores e nunca crie registros novos (cliente, categoria) ` +
  `sem confirmação explícita do usuário.`;

const PROTOCOL_VERSION = "2025-06-18";
const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

Deno.serve(async (req: Request) => {
  const flowId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  if (req.method === "OPTIONS") return new Response("ok", { headers: mcpHeaders });

  const url = new URL(req.url);
  const path = url.pathname;
  const httpStarted = Date.now();

  flog(flowId, "http-in", {
    method: req.method,
    path,
    content_type: req.headers.get("content-type"),
    accept: req.headers.get("accept"),
    protocol_version: req.headers.get("mcp-protocol-version"),
    has_session: !!req.headers.get("mcp-session-id"),
    has_authorization: (req.headers.get("authorization") ?? "").length > 0,
    content_length: req.headers.get("content-length"),
    user_agent: req.headers.get("user-agent"),
    origin: req.headers.get("origin"),
  });

  if (req.method === "GET" && path.endsWith("/oauth/authorize")) {
    return handleOAuthAuthorize(req, url, flowId, httpStarted);
  }

  if (req.method === "GET" && path.endsWith("/.well-known/oauth-protected-resource")) {
    return handleProtectedResourceDiscovery(flowId, httpStarted);
  }

  if (req.method === "GET" && path.endsWith("/.well-known/oauth-authorization-server")) {
    return handleAuthorizationServerDiscovery(flowId, httpStarted);
  }

  if (req.method === "GET" && path.endsWith("/health")) {
    return handleHealthCheck(SERVER_INFO, PROTOCOL_VERSION, SUPPORTED_PROTOCOL_VERSIONS, catalogAgeDays);
  }

  if (req.method === "GET") {
    const accept = (req.headers.get("accept") ?? "").toLowerCase();
    if (accept.includes("text/event-stream")) {
      return handleSseStream(req);
    }
    if (!accept.includes("application/json") && accept !== "" && !accept.includes("*/*")) {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { ...mcpHeaders, Allow: "POST, GET, OPTIONS" },
      });
    }
    const bridged = Object.entries(BRIDGED_TOOLS).map(([name, t]) => ({
      name, scope: t.scope, requiresApproval: t.requiresApproval,
    }));
    return jsonResponse({
      server: SERVER_INFO,
      protocolVersion: PROTOCOL_VERSION,
      tools: catalog.tools.length,
      exposedTools: EXPOSED_TOOLS.length + META_TOOL_DEFS.length,
      bridgedTools: bridged,
      generatedAt: catalog.generatedAt,
      auth: {
        oauth2: {
          issuer: OAUTH_AS_ISSUER,
          protectedResourceMetadata: `${MCP_RESOURCE_URL}/.well-known/oauth-protected-resource`,
          authorizationServerMetadata: `${OAUTH_AS_ISSUER}/.well-known/oauth-authorization-server`,
          note: "Clientes MCP (ChatGPT, Claude) descobrem o fluxo automaticamente.",
        },
        pat: {
          type: "bearer",
          header: "Authorization: Bearer lmcp_...",
          scopes: ["read", "write"],
          issue: "https://app.lunarihub.com/app/assistente/mcp",
        },
        approvalsUrl: "https://app.lunarihub.com/app/assistente/aprovacoes",
      },
      docs: "https://modelcontextprotocol.io/specification/2025-06-18/basic/transports",
    });
  }

  if (req.method === "DELETE") {
    return new Response(null, { status: 204, headers: mcpHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { ...mcpHeaders, Allow: "POST, GET, OPTIONS" },
    });
  }

  const rawBody = await req.text();
  const trimmed = rawBody.trim();

  if (trimmed.length === 0) {
    flog(flowId, "post-empty", { status: 202, bytes: 0, latency_ms: Date.now() - httpStarted });
    return new Response(null, {
      status: 202,
      headers: { ...mcpHeaders, "Mcp-Session-Id": req.headers.get("mcp-session-id") ?? crypto.randomUUID() },
    });
  }

  let body: unknown;
  try {
    body = JSON.parse(trimmed);
  } catch (err) {
    flog(flowId, "post-parse-error", {
      status: 400,
      bytes: rawBody.length,
      content_type: req.headers.get("content-type"),
      shape: trimmed.slice(0, 24),
      error: String(err),
    });
    return new Response(JSON.stringify(rpcError(null, -32700, "Parse error")), {
      status: 400,
      headers: { ...mcpHeaders, "Content-Type": "application/json" },
    });
  }

  const startedAt = Date.now();
  const auth = await resolveAuth(req);

  const rawAuth = req.headers.get("authorization") ?? "";
  const hasAuthHeader = rawAuth.toLowerCase().startsWith("bearer ");
  const bearer = hasAuthHeader ? rawAuth.slice(7).trim() : "";
  if (hasAuthHeader) {
    const claims = bearer.startsWith("eyJ") ? decodeJwtPayload(bearer) : null;
    flog(flowId, "auth", {
      token_kind: bearer.startsWith("lmcp_") ? "pat" : bearer.startsWith("eyJ") ? "jwt" : "unknown",
      token_fp: await fingerprint(bearer),
      iss: claims?.iss ?? null,
      aud: claims?.aud ?? null,
      has_client_id: !!(claims?.client_id ?? claims?.azp),
      exp: claims?.exp ?? null,
      expired: typeof claims?.exp === "number" ? claims.exp * 1000 < Date.now() : null,
      accepted: !!auth.userId,
      auth_source: auth.authSource,
      rollout_allowed: auth.rolloutAllowed,
      scopes: auth.scopes,
    });
  }
  const responseHeaders: Record<string, string> = { ...mcpHeaders, "Content-Type": "application/json" };
  if (hasAuthHeader && !auth.userId) {
    responseHeaders["WWW-Authenticate"] = WWW_AUTH_HEADER;
  }
  const incomingSession = req.headers.get("mcp-session-id");
  const sessionId = incomingSession ?? crypto.randomUUID();
  responseHeaders["Mcp-Session-Id"] = sessionId;
  const protoHeader = req.headers.get("mcp-protocol-version");
  if (protoHeader) responseHeaders["Mcp-Protocol-Version"] = protoHeader;

  const requests = Array.isArray(body) ? body : [body];
  const responses: unknown[] = [];
  for (const r of requests) {
    if (!r || typeof r !== "object" || (r as JsonRpcRequest).jsonrpc !== "2.0") {
      flog(flowId, "invalid-request", {
        reason: !r || typeof r !== "object" ? "not_object" : "missing_jsonrpc_2_0",
        keys: r && typeof r === "object" ? Object.keys(r as object).slice(0, 8) : [],
      });
      responses.push(rpcError(null, -32600, "Invalid Request"));
      continue;
    }
    const rpc = r as JsonRpcRequest;
    const mStarted = Date.now();
    const res = await handleMethod(rpc, auth, {
      serverInfo: SERVER_INFO,
      instructions: INSTRUCTIONS,
      protocolVersion: PROTOCOL_VERSION,
      supportedProtocolVersions: SUPPORTED_PROTOCOL_VERSIONS,
      catalogByName: CATALOG_BY_NAME,
      resolveToolName,
    });
    flog(flowId, "rpc", {
      method: rpc.method,
      is_notification: rpc.id === undefined || rpc.id === null,
      responded: !!res,
      latency_ms: Date.now() - mStarted,
    });
    if (res) responses.push(res);
  }

  if ((auth as any).__challenge) {
    responseHeaders["WWW-Authenticate"] = WWW_AUTH_HEADER;
  }

  const logHandshake = (status: number, bytes: number) => {
    void recordHandshake({
      flowId,
      methods: requests.map((r: any) => r?.method).filter(Boolean),
      userAgent: req.headers.get("user-agent"),
      hasAuth: hasAuthHeader,
      authSource: auth.authSource,
      clientId: auth.clientId,
      userId: auth.userId,
      authReason: auth.userId ? null : auth.reason ?? null,
      protocolVersion: req.headers.get("mcp-protocol-version"),
      status,
      bytes,
      latencyMs: Date.now() - httpStarted,
    });
    return flog(flowId, "http-out", {
      methods: requests.map((r: any) => r?.method).filter(Boolean),
      status,
      bytes,
      session_id: sessionId,
      auth_source: auth.authSource,
      client_id: auth.clientId,
      has_user: !!auth.userId,
      challenge: !!responseHeaders["WWW-Authenticate"],
      auth_reason: auth.userId ? null : auth.reason ?? null,
      rpc_latency_ms: Date.now() - startedAt,
      total_latency_ms: Date.now() - httpStarted,
    });
  };

  if (responses.length === 0) {
    logHandshake(202, 0);
    return new Response(null, { status: 202, headers: { ...mcpHeaders, "Mcp-Session-Id": sessionId } });
  }

  const payload = Array.isArray(body) ? responses : responses[0];
  const serialized = JSON.stringify(payload);
  logHandshake(200, serialized.length);
  return new Response(serialized, {
    status: 200,
    headers: responseHeaders,
  });
});
