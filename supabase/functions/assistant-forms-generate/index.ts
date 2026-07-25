// =============================================================================
// assistant-forms-generate
// -----------------------------------------------------------------------------
// Propõe título/descrição/campos para um formulário de briefing fotográfico.
// Consome Lovable AI Gateway (LOVABLE_API_KEY) e retorna JSON estrito no
// esquema Lunari de campos. NÃO grava no DB — o cliente aplica após review.
// =============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const MODEL = "google/gemini-2.5-flash";

const CAMPO_TIPOS = [
  "texto_curto",
  "texto_longo",
  "data",
  "selecao_unica",
  "multipla_escolha",
  "upload_imagem",
  "upload_referencia",
  "selecao_cores",
];

interface Body {
  brief: string;
  tipoEnsaio?: string;
  clienteNome?: string;
  idiomaOutput?: "pt-BR" | "en";
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  if (!LOVABLE_API_KEY) return json(500, { error: "missing_lovable_api_key" });

  // Autenticação — exige usuário logado
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json(401, { error: "unauthorized" });
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes } = await client.auth.getUser();
  if (!userRes?.user) return json(401, { error: "unauthorized" });
  const { assertAssistantAccess } = await import("../_shared/assistant-guard.ts");
  const denied = await assertAssistantAccess(client, userRes.user.id, corsHeaders);
  if (denied) return denied;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }
  const brief = String(body?.brief ?? "").trim();
  if (brief.length < 4) return json(400, { error: "brief_required" });

  const idioma = body.idiomaOutput ?? "pt-BR";
  const tipo = body.tipoEnsaio?.trim();
  const cliente = body.clienteNome?.trim();

  const systemPrompt = [
    "Você é a Lu, assistente do Lunari (SaaS para fotógrafos).",
    "Sua tarefa: propor um formulário de BRIEFING para o fotógrafo enviar ao cliente antes do ensaio.",
    "Regras:",
    "- Idioma da saída: " + idioma,
    "- Retorne EXCLUSIVAMENTE JSON válido (sem markdown, sem comentários).",
    "- Esquema exato: { titulo: string, descricao: string, campos: Array<{ id, tipo, pergunta, obrigatorio?, opcoes?, descricao? }> }.",
    "- tipo ∈ [" + CAMPO_TIPOS.join(", ") + "].",
    "- Use 'selecao_unica'/'multipla_escolha' quando fizer sentido oferecer opções (preencha `opcoes`).",
    "- Máximo 10 campos, priorize os essenciais para o tipo de ensaio.",
    "- id deve ser um slug curto (ex: 'nome_evento', 'estilo_preferido').",
    "- Escreva perguntas em tom acolhedor, brasileiro, sem jargão técnico.",
  ].join("\n");

  const userPrompt = [
    "Brief do fotógrafo:",
    brief,
    tipo ? "Tipo de ensaio: " + tipo : "",
    cliente ? "Cliente: " + cliente : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (resp.status === 429) return json(429, { error: "rate_limited" });
    if (resp.status === 402) return json(402, { error: "credits_exhausted" });
    if (!resp.ok) {
      const text = await resp.text();
      return json(502, { error: "ai_upstream_error", detail: text.slice(0, 500) });
    }

    const payload = await resp.json();
    const content = payload?.choices?.[0]?.message?.content ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return json(502, { error: "ai_invalid_json", raw: String(content).slice(0, 500) });
    }

    // Normalização mínima defensiva
    const p = parsed as Record<string, unknown>;
    const titulo = String(p.titulo ?? "Briefing").slice(0, 120);
    const descricao = String(p.descricao ?? "").slice(0, 500);
    const camposRaw = Array.isArray(p.campos) ? p.campos : [];
    const campos = camposRaw
      .slice(0, 10)
      .map((c: Record<string, unknown>, i: number) => {
        const tipo = String(c?.tipo ?? "texto_curto");
        const safeTipo = CAMPO_TIPOS.includes(tipo) ? tipo : "texto_curto";
        return {
          id: String(c?.id ?? "campo_" + (i + 1)).slice(0, 60),
          tipo: safeTipo,
          pergunta: String(c?.pergunta ?? "").slice(0, 250),
          obrigatorio: Boolean(c?.obrigatorio ?? false),
          opcoes: Array.isArray(c?.opcoes)
            ? (c.opcoes as unknown[]).map((o) => String(o).slice(0, 100)).slice(0, 20)
            : undefined,
          descricao: c?.descricao ? String(c.descricao).slice(0, 300) : undefined,
        };
      })
      .filter((c: { pergunta: string }) => c.pergunta.length > 0);

    return json(200, { titulo, descricao, campos });
  } catch (e) {
    return json(500, { error: "internal", detail: (e as Error).message });
  }
});
