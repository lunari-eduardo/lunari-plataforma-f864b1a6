// deno-lint-ignore-file no-explicit-any
import catalog from "./catalog.json" with { type: "json" };
import { isBridged, BRIDGE_SCHEMAS } from "./executor.ts";
import { aliasesFor } from "./exposed.ts";
import { toPublicName, publicInputSchema } from "./compat.ts";

export type JsonRpcId = string | number | null;

export const CORE_DESCRIPTION_MAX = 160;

/** Normaliza para busca: minúsculas e sem acentos ("análise" ≡ "analise"). */
export function fold(text: string): string {
  return String(text ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function trimDescription(text: string | undefined): string {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  return t.length <= CORE_DESCRIPTION_MAX ? t : t.slice(0, CORE_DESCRIPTION_MAX - 1).trimEnd() + "…";
}

export function handleMetaSearch(id: JsonRpcId, args: Record<string, any>) {
  const q = fold(String(args.query ?? ""));
  const domain = fold(String(args.domain ?? ""));
  const limit = Math.min(Number(args.limit ?? 15) || 15, 40);
  const STOP = new Set(["de", "do", "da", "dos", "das", "e", "em", "no", "na", "por", "para", "com", "a", "o", "os", "as", "um", "uma"]);
  const terms = q.split(/\s+/).filter((t) => t && !STOP.has(t));
  const scored = (catalog.tools as any[])
    .filter((t) => !domain || fold(String(t.capabilityId ?? "")).startsWith(domain + ".") || fold(String(t.capabilityId ?? "")).includes("." + domain + "."))
    .map((t) => {
      const name = fold(t.name);
      const hay = fold(`${t.name} ${t.title ?? ""} ${t.description ?? ""} ${aliasesFor(t.name)}`);
      let score = terms.length === 0 ? 1 : 0;
      for (const term of terms) {
        if (name.includes(term)) score += 3;
        else if (hay.includes(term)) score += 1;
      }
      return { t, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const hits = scored.map(({ t }) => ({
    name: toPublicName(t.name),
    title: t.title,
    summary: trimDescription(t.description),
    executable: isBridged(t.name) || !!t.transport?.name,
    needsApproval: t.needsApproval ?? null,
  }));

  return {
    jsonrpc: "2.0" as const,
    id,
    result: {
      content: [{
        type: "text",
        text: hits.length
          ? `${hits.length} ferramenta(s). Veja parâmetros com lunari.tools.describe e execute com lunari.tools.invoke.\n` +
            hits.map((h) => `- ${h.name}: ${h.title}`).join("\n")
          : "Nenhuma ferramenta encontrada. Tente outro termo ou informe o domínio.",
      }],
      structuredContent: { tools: hits, total: catalog.tools.length },
    },
  };
}

export function handleMetaDescribe(id: JsonRpcId, args: Record<string, any>, resolveToolName: (name: string) => string) {
  const target = resolveToolName(String(args.name ?? "").trim());
  const tool = (catalog.tools as any[]).find((t) => t.name === target);
  if (!tool) {
    return {
      jsonrpc: "2.0" as const,
      id,
      result: {
        isError: true,
        content: [{ type: "text", text: `Ferramenta "${args.name}" não encontrada. Use lunari.tools.search.` }],
      },
    };
  }
  const schema = publicInputSchema(BRIDGE_SCHEMAS[tool.name] ?? tool.inputSchema);
  return {
    jsonrpc: "2.0" as const,
    id,
    result: {
      content: [{
        type: "text",
        text: `${toPublicName(tool.name)} — ${tool.title}\n${tool.description ?? ""}\n` +
          `Parâmetros: ${JSON.stringify(schema)}`,
      }],
      structuredContent: {
        name: toPublicName(tool.name),
        internalName: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: schema,
        scopeTier: tool.scopeTier ?? null,
        needsApproval: tool.needsApproval ?? null,
        executable: isBridged(tool.name) || !!tool.transport?.name,
      },
    },
  };
}
