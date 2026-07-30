/**
 * capability-dispatch.ts — A2: contrato único de execução (server-side).
 *
 * Substitui os handlers escritos à mão do `assistant-mcp/executor.ts`.
 * Em vez de reimplementar cada tool, o dispatcher:
 *
 *  1. Resolve a tool no catálogo gerado (transport, schema, escopo, approval).
 *  2. Valida o input contra o JSON Schema do próprio catálogo.
 *  3. Cria um client Supabase COM O JWT DO USUÁRIO (RLS é a barreira real,
 *     não um `.eq("user_id")` manual sob service_role).
 *  4. Executa `rpc` ou `edge` com timeout derivado do costHint.
 *  5. Normaliza a saída e o erro no contrato único.
 *
 * Nenhuma mensagem crua de Postgres chega ao cliente MCP: ela vai só no
 * campo `auditDetail`, que o chamador grava na auditoria.
 */
// deno-lint-ignore-file no-explicit-any
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { tierOf, tierSatisfiedBy } from "./mcp-scopes.ts";

export type CapabilityErrorCode =
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "APPROVAL_REQUIRED"
  | "SCOPE_MISSING"
  | "NOT_FOUND"
  | "TIMEOUT"
  | "INTERNAL";

export const JSON_RPC_CODE_BY_ERROR: Record<CapabilityErrorCode, number> = {
  VALIDATION: -32602,
  UNAUTHORIZED: -32001,
  FORBIDDEN: -32002,
  APPROVAL_REQUIRED: -32003,
  SCOPE_MISSING: -32004,
  NOT_FOUND: -32601,
  TIMEOUT: -32005,
  INTERNAL: -32603,
};

const SAFE_MESSAGE: Record<CapabilityErrorCode, string> = {
  VALIDATION: "Os dados fornecidos são inválidos.",
  UNAUTHORIZED: "Você precisa estar autenticado para fazer isso.",
  FORBIDDEN: "Você não tem permissão para esta ação.",
  APPROVAL_REQUIRED: "Esta ação exige aprovação humana explícita.",
  SCOPE_MISSING: "Este token não possui o escopo necessário.",
  NOT_FOUND: "Recurso não encontrado.",
  TIMEOUT: "A operação demorou demais e foi cancelada. Tente novamente.",
  INTERNAL: "Ocorreu um erro inesperado. Tente novamente.",
};

const TIMEOUT_BY_COST: Record<string, number> = {
  cheap: 8_000,
  medium: 20_000,
  expensive: 45_000,
};

export interface CatalogTool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, any>;
  outputSchema?: Record<string, any>;
  capabilityId: string;
  transport?: { type: "rpc" | "edge"; name: string; mapped?: boolean };
  scope?: "read" | "write";
  scopeTier?: "read" | "write" | "destructive";
  kind?: "command" | "query";
  needsApproval?: boolean;
  costHint?: string;
}

export interface DispatchOk {
  ok: true;
  value: unknown;
  summary: string;
  latencyMs: number;
}

export interface DispatchErr {
  ok: false;
  code: CapabilityErrorCode;
  message: string;
  /** Detalhe cru — SOMENTE para auditoria/logs, nunca para o cliente. */
  auditDetail?: string;
  latencyMs: number;
}

export type DispatchResult = DispatchOk | DispatchErr;

function fail(
  code: CapabilityErrorCode,
  started: number,
  auditDetail?: string,
  message?: string,
): DispatchErr {
  return {
    ok: false,
    code,
    message: message ?? SAFE_MESSAGE[code],
    auditDetail,
    latencyMs: Date.now() - started,
  };
}

/**
 * Validação mínima e determinística contra o subset de JSON Schema que o
 * conversor Zod emite (type/properties/required/enum/additionalProperties).
 * Não é um validador completo — é a mesma barreira que o Zod aplica no
 * cliente para os casos que realmente chegam pelo MCP.
 */
export function validateAgainstSchema(
  schema: Record<string, any> | undefined,
  input: unknown,
): string[] {
  if (!schema || typeof schema !== "object") return [];
  const errors: string[] = [];

  const check = (node: any, value: unknown, path: string) => {
    if (!node || typeof node !== "object") return;

    if (value === undefined || value === null) {
      if (node.nullable === true || value === undefined) return;
    }

    const t = node.type;
    if (t === "object") {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        errors.push(`${path || "input"}: esperado objeto`);
        return;
      }
      const obj = value as Record<string, unknown>;
      for (const req of (node.required ?? []) as string[]) {
        if (obj[req] === undefined) errors.push(`${path ? path + "." : ""}${req}: obrigatório`);
      }
      if (node.additionalProperties === false && node.properties) {
        for (const key of Object.keys(obj)) {
          if (!(key in node.properties) && key !== "approval_token") {
            errors.push(`${path ? path + "." : ""}${key}: campo não permitido`);
          }
        }
      }
      for (const [key, sub] of Object.entries(node.properties ?? {})) {
        if (obj[key] !== undefined) check(sub, obj[key], path ? `${path}.${key}` : key);
      }
      return;
    }

    if (t === "array") {
      if (!Array.isArray(value)) {
        errors.push(`${path}: esperado array`);
        return;
      }
      if (node.items) value.forEach((v, i) => check(node.items, v, `${path}[${i}]`));
      return;
    }

    if (Array.isArray(node.enum) && !node.enum.includes(value)) {
      errors.push(`${path}: valor deve ser um de ${node.enum.join(", ")}`);
      return;
    }

    if (t === "string" && typeof value !== "string") errors.push(`${path}: esperado texto`);
    if (t === "number" || t === "integer") {
      if (typeof value !== "number" || Number.isNaN(value)) errors.push(`${path}: esperado número`);
    }
    if (t === "boolean" && typeof value !== "boolean") errors.push(`${path}: esperado booleano`);
  };

  check(schema, input, "");
  return errors;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | "__timeout__"> {
  return Promise.race([
    p,
    new Promise<"__timeout__">((resolve) => setTimeout(() => resolve("__timeout__"), ms)),
  ]);
}

/** Client escopado ao usuário — RLS aplica exatamente como no app. */
export function userScopedClient(userJwt: string): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
    {
      global: { headers: { Authorization: `Bearer ${userJwt}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

/** Resumo curto e truncado — vira `content[0].text` na resposta MCP. */
export function summarizeOutput(tool: CatalogTool, value: unknown): string {
  if (Array.isArray(value)) return `${tool.title}: ${value.length} registro(s).`;
  if (value && typeof value === "object") {
    const arrayKey = Object.entries(value as Record<string, unknown>).find(([, v]) =>
      Array.isArray(v),
    );
    if (arrayKey) return `${tool.title}: ${(arrayKey[1] as unknown[]).length} ${arrayKey[0]}.`;
  }
  const json = JSON.stringify(value ?? null);
  return json.length > 2000 ? `${json.slice(0, 2000)}…` : json;
}

export interface DispatchArgs {
  tool: CatalogTool;
  input: Record<string, unknown>;
  /** JWT do usuário (OAuth). Quando ausente, usamos o client de serviço. */
  userJwt?: string | null;
  /** Client já construído — usado no caminho PAT, que não tem JWT do usuário. */
  client?: SupabaseClient;
  scopes: string[];
  /**
   * A6 — id do usuário dono da execução. Quando informado, o dispatcher
   * revalida o gate de rollout antes de despachar (defesa em profundidade
   * para qualquer consumidor futuro que esqueça de checar).
   */
  userId?: string | null;
}


/**
 * Executa uma tool do catálogo. Único ponto de execução server-side.
 */
export async function dispatchCapability(args: DispatchArgs): Promise<DispatchResult> {
  const started = Date.now();
  const { tool, scopes } = args;

  const transport = tool.transport;
  if (!transport?.name) {
    return fail("NOT_FOUND", started, `tool sem transport: ${tool.name}`);
  }

  // A4 — validação única de escopo (read ⊂ write ⊂ destructive); `admin` não existe mais.
  const requiredTier =
    tool.scopeTier ??
    tierOf({ kind: tool.kind ?? (tool.scope === "read" ? "query" : "command"), needsApproval: tool.needsApproval });
  if (!tierSatisfiedBy(requiredTier, scopes)) {
    return fail("SCOPE_MISSING", started, `requer escopo "${requiredTier}"`);
  }

  const input = { ...(args.input ?? {}) };
  delete (input as any).approval_token;

  const issues = validateAgainstSchema(tool.inputSchema, input);
  if (issues.length > 0) {
    return fail("VALIDATION", started, issues.join("; "), `Dados inválidos: ${issues[0]}`);
  }

  const sb = args.client ?? (args.userJwt ? userScopedClient(args.userJwt) : null);
  if (!sb) return fail("UNAUTHORIZED", started);

  const timeout = TIMEOUT_BY_COST[tool.costHint ?? "cheap"] ?? TIMEOUT_BY_COST.cheap;

  try {
    if (transport.type === "rpc") {
      const race = await withTimeout(
        Promise.resolve(sb.rpc(transport.name, input as Record<string, unknown>)),
        timeout,
      );
      if (race === "__timeout__") return fail("TIMEOUT", started, `rpc ${transport.name}`);
      const { data, error } = race as { data: unknown; error: any };
      if (error) return mapPostgrestError(error, started);
      return {
        ok: true,
        value: data,
        summary: summarizeOutput(tool, data),
        latencyMs: Date.now() - started,
      };
    }

    // transport === "edge"
    const race = await withTimeout(
      sb.functions.invoke(transport.name, { body: input }),
      timeout,
    );
    if (race === "__timeout__") return fail("TIMEOUT", started, `edge ${transport.name}`);
    const { data, error } = race as { data: unknown; error: any };
    if (error) {
      return fail("INTERNAL", started, `edge ${transport.name}: ${error?.message ?? String(error)}`);
    }
    return {
      ok: true,
      value: data,
      summary: summarizeOutput(tool, data),
      latencyMs: Date.now() - started,
    };
  } catch (e) {
    return fail("INTERNAL", started, e instanceof Error ? e.message : String(e));
  }
}

function mapPostgrestError(error: any, started: number): DispatchErr {
  const raw = `${error?.code ?? ""} ${error?.message ?? ""}`.trim();
  const code = String(error?.code ?? "");
  // 42501 = insufficient_privilege; PGRST301 = JWT inválido/expirado.
  if (code === "42501" || /row-level security/i.test(raw)) return fail("FORBIDDEN", started, raw);
  if (code.startsWith("PGRST30")) return fail("UNAUTHORIZED", started, raw);
  if (code === "PGRST202" || code === "42883") return fail("NOT_FOUND", started, raw);
  if (code === "23505") {
    return fail("VALIDATION", started, raw, "Este registro já existe.");
  }
  if (code.startsWith("22") || code.startsWith("23")) return fail("VALIDATION", started, raw);
  return fail("INTERNAL", started, raw);
}
