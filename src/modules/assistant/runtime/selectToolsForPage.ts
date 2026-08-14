/**
 * Seleção de tools por relevância de página.
 *
 * Providers de LLM (Gemini/OpenAI) degradam — e no caso do Gemini rejeitam —
 * catálogos grandes de function declarations. O Lunari expõe 200+ capabilities;
 * enviar tudo em todo turno estoura o limite e piora a escolha do modelo.
 *
 * Estratégia determinística (sem IA):
 *  1. módulos da página atual;
 *  2. módulos sempre úteis (workflow, clientes, agenda, tasks);
 *  3. o restante, para completar a cota.
 * Dentro de cada faixa, queries vêm antes de commands (leitura é mais usada).
 */

export type PageKey = string;

const PAGE_MODULES: Record<string, string[]> = {
  workflow: ["workflow", "sessions", "finance", "clientes"],
  tasks: ["tasks", "workflow"],
  agenda: ["agenda", "clientes", "workflow"],
  finance: ["finance", "billing", "workflow"],
  billing: ["billing", "finance"],
  gallery: ["gallery", "workflow"],
  clientes: ["clientes", "leads", "workflow"],
  leads: ["leads", "clientes", "commerce"],
  precificacao: ["precificacao", "pricing", "finance"],
  formularios: ["formularios", "clientes"],
  contratos: ["contratos", "clientes"],
  configuracoes: ["configuracoes", "billing"],
};

/** Módulos que a Lu deve enxergar em qualquer página. */
const ALWAYS_ON = ["workflow", "clientes", "agenda", "tasks"];

export const MAX_TOOLS_PER_TURN = 60;

function moduleOf(id: string): string {
  return id.split(".")[0] ?? "";
}

export function selectToolsForPage<T extends { id: string; kind: "command" | "query" }>(
  tools: T[],
  page: PageKey,
  max: number = MAX_TOOLS_PER_TURN,
): T[] {
  if (tools.length <= max) return tools;

  const pageMods = new Set(PAGE_MODULES[page] ?? []);
  const alwaysMods = new Set(ALWAYS_ON);

  const rank = (t: T) => {
    const m = moduleOf(t.id);
    const tier = pageMods.has(m) ? 0 : alwaysMods.has(m) ? 1 : 2;
    return tier * 2 + (t.kind === "query" ? 0 : 1);
  };

  return [...tools]
    .map((t, i) => ({ t, i, r: rank(t) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .slice(0, max)
    .map((x) => x.t);
}
