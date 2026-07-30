/**
 * A6 — Guarda de regressão do gate de rollout da Lu.
 *
 * Falha se:
 *  1. alguma edge function `assistant-*` (exceto as utilitárias listadas)
 *     não importar/chamar o assistant-guard;
 *  2. a execução in-app (`runCapabilityAsAssistant`) perder a checagem;
 *  3. as rotas do assistente ficarem sem `RequireAssistantAccess`.
 *
 * Uso: npx tsx scripts/check-assistant-gate.ts
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const errors: string[] = [];

// 1) Edge functions do assistente
const FN_DIR = "supabase/functions";
// assistant-mcp faz o gate inline (PAT + OAuth), não usa o guard HTTP.
const EXEMPT = new Set(["assistant-mcp"]);

if (existsSync(FN_DIR)) {
  for (const dir of readdirSync(FN_DIR)) {
    if (!dir.startsWith("assistant-") || EXEMPT.has(dir)) continue;
    const file = join(FN_DIR, dir, "index.ts");
    if (!existsSync(file)) continue;
    const src = readFileSync(file, "utf8");
    if (!src.includes("assistant-guard") || !/assertAssistantAccess|isAssistantAllowed/.test(src)) {
      errors.push(`edge function "${dir}" não aplica o gate de rollout (assistant-guard).`);
    }
  }

  const mcp = join(FN_DIR, "assistant-mcp", "index.ts");
  if (existsSync(mcp) && !readFileSync(mcp, "utf8").includes("assistant_access_allowed")) {
    errors.push("assistant-mcp não chama assistant_access_allowed.");
  }
}

// 2) Execução in-app
const RUNNER = "src/shared/ai/runCapabilityAsAssistant.ts";
if (existsSync(RUNNER) && !readFileSync(RUNNER, "utf8").includes("assistant_access_allowed")) {
  errors.push("runCapabilityAsAssistant não checa o gate de rollout.");
}

// 3) Rotas do assistente
const ROUTER = "src/app-photographer/PhotographerApp.tsx";
if (existsSync(ROUTER)) {
  const src = readFileSync(ROUTER, "utf8");
  for (const line of src.split("\n")) {
    if (/<Route path="(configuracoes\/)?assistente/.test(line) && !line.includes("RequireAssistantAccess")) {
      errors.push(`rota do assistente sem guard: ${line.trim()}`);
    }
  }
}

if (errors.length) {
  console.error("❌ check-assistant-gate falhou:\n" + errors.map((e) => " - " + e).join("\n"));
  process.exit(1);
}
console.log("✅ check-assistant-gate: gate de rollout aplicado em todas as superfícies.");
