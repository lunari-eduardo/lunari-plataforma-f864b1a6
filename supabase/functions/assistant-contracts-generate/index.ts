// =============================================================================
// assistant-contracts-generate
// -----------------------------------------------------------------------------
// Propõe conteúdo de contrato (template ou contrato personalizado) usando
// Lovable AI Gateway. Retorna JSON estrito. NÃO grava no DB.
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

const VARIAVEIS_SUPORTADAS = [
  "cliente_nome",
  "cliente_email",
  "cliente_telefone",
  "cliente_documento",
  "session_data",
  "session_local",
  "session_valor",
  "fotografo_nome",
  "fotografo_email",
  "estudio_nome",
];

interface BodyBase {
  mode: "template" | "contrato";
  brief: string;
  idiomaOutput?: "pt-BR" | "en";
}
interface TemplateBody extends BodyBase {
  mode: "template";
  categoria?: string;
  tipoEnsaio?: string;
}
interface ContratoBody extends BodyBase {
  mode: "contrato";
  clienteId: string;
  sessionId?: string;
  templateId?: string;
}
type Body = TemplateBody | ContratoBody;

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

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json(401, { error: "unauthorized" });
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes } = await client.auth.getUser();
  const user = userRes?.user;
  if (!user) return json(401, { error: "unauthorized" });
  const { assertAssistantAccess } = await import("../_shared/assistant-guard.ts");
  const denied = await assertAssistantAccess(client, user.id, corsHeaders);
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

  // Contexto opcional: para modo contrato, hidrata dados do cliente/sessão
  // (apenas para orientar a IA — nenhum dado é persistido).
  let contexto: Record<string, unknown> = {};
  if (body.mode === "contrato") {
    const cid = (body as ContratoBody).clienteId;
    const sid = (body as ContratoBody).sessionId;
    const tid = (body as ContratoBody).templateId;
    const [{ data: cliente }, { data: sessao }, { data: tpl }, { data: perfil }] =
      await Promise.all([
        client
          .from("clientes")
          .select("nome, email, telefone")
          .eq("id", cid)
          .maybeSingle(),
        sid
          ? client
              .from("clientes_sessoes")
              .select("data_sessao, local, valor_total")
              .eq("id", sid)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        tid
          ? client
              .from("contrato_templates")
              .select("nome, conteudo")
              .eq("id", tid)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        client
          .from("profiles")
          .select("nome_completo, estudio_nome")
          .eq("id", user.id)
          .maybeSingle(),
      ]);
    contexto = { cliente, sessao, template: tpl, perfil };
  }

  const systemPrompt = [
    "Você é a Lu, assistente do Lunari (SaaS para fotógrafos brasileiros).",
    body.mode === "template"
      ? "Tarefa: propor um TEMPLATE de contrato profissional reutilizável."
      : "Tarefa: gerar um contrato personalizado para um cliente específico.",
    "Regras:",
    "- Idioma: " + idioma,
    "- Retorne EXCLUSIVAMENTE JSON válido (sem markdown, sem comentários).",
    "- Esquema: { titulo: string, conteudo: string, variaveisUsadas: string[], observacoes?: string }.",
    "- `conteudo` deve usar Markdown simples e placeholders {{variavel}}.",
    "- Variáveis permitidas: " + VARIAVEIS_SUPORTADAS.join(", ") + ".",
    "- NÃO invente novas variáveis; se faltar dado, use texto genérico.",
    "- Inclua cláusulas essenciais: objeto, prazo, pagamento, direitos de imagem, cancelamento, foro.",
    "- Tom formal, claro e enxuto (evite juridiquês excessivo).",
    "- `variaveisUsadas` deve conter apenas variáveis que apareçam em `conteudo`.",
  ].join("\n");

  const userPrompt = [
    "Brief do fotógrafo:",
    brief,
    body.mode === "template" && (body as TemplateBody).categoria
      ? "Categoria: " + (body as TemplateBody).categoria
      : "",
    body.mode === "template" && (body as TemplateBody).tipoEnsaio
      ? "Tipo de ensaio: " + (body as TemplateBody).tipoEnsaio
      : "",
    body.mode === "contrato"
      ? "Contexto (JSON): " + JSON.stringify(contexto).slice(0, 4000)
      : "",
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
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content);
    } catch {
      return json(502, { error: "ai_invalid_json", raw: String(content).slice(0, 500) });
    }

    const titulo = String(parsed.titulo ?? "Contrato").slice(0, 200);
    const conteudo = String(parsed.conteudo ?? "").slice(0, 20000);
    const variaveisUsadasRaw = Array.isArray(parsed.variaveisUsadas)
      ? (parsed.variaveisUsadas as unknown[]).map((v) => String(v))
      : [];
    const variaveisUsadas = variaveisUsadasRaw.filter((v) =>
      VARIAVEIS_SUPORTADAS.includes(v),
    );
    const observacoes = parsed.observacoes
      ? String(parsed.observacoes).slice(0, 1000)
      : undefined;

    if (!conteudo) return json(502, { error: "ai_empty_conteudo" });

    return json(200, { titulo, conteudo, variaveisUsadas, observacoes });
  } catch (e) {
    return json(500, { error: "internal", detail: (e as Error).message });
  }
});
