/**
 * proposal-ai-field — Ajuda de texto por campo no editor de propostas.
 *
 * POST (JWT obrigatório) body:
 *  {
 *    action: "improve" | "rewrite" | "shorten" | "expand",
 *    block_type: string,          // ex.: "EditorialBlock"
 *    field_label: string,         // ex.: "Título Principal"
 *    current_text: string,
 *    context?: {
 *      material_title?: string,
 *      session_type?: string,
 *      tone?: string
 *    }
 *  }
 *
 * Response: { text: string }
 */

import {
  jsonResponse,
  handleCors,
  requireUser,
  completeJson,
  logGeneration,
} from "../_shared/proposal-ai.ts";

const ACTIONS: Record<string, string> = {
  improve: "Melhore o texto: mais fluidez, persuasão e clareza, mantendo o significado e o tamanho aproximado.",
  rewrite: "Reescreva o texto com outra abordagem criativa, mantendo o objetivo e o público.",
  shorten: "Encurte o texto drasticamente (metade do tamanho no máximo) sem perder a essência.",
  expand: "Expanda o texto com detalhes sensoriais e benefícios concretos, sem repetições.",
};

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const userId = await requireUser(req);
    if (!userId) return jsonResponse({ error: "Não autenticado" }, 401);

    const body = await req.json();
    const action = ACTIONS[body?.action];
    const currentText = typeof body?.current_text === "string" ? body.current_text : "";

    if (!action) return jsonResponse({ error: "action inválida (use improve|rewrite|shorten|expand)" }, 400);
    if (!currentText.trim()) return jsonResponse({ error: "current_text vazio" }, 400);

    const ctx = body?.context ?? {};
    const system = `Você é um redator comercial sênior especializado em propostas para fotógrafos profissionais brasileiros.
Português do Brasil, copy elegante e emocional, sem exageros nem clichês de marketing agressivo.`;

    const user = `Campo de uma proposta comercial:
- Bloco: ${body?.block_type ?? "seção"}
- Campo: ${body?.field_label ?? "texto"}
- Proposta: ${ctx.material_title ?? "não informada"}
- Tipo de sessão: ${ctx.session_type ?? "não informado"}
- Tom: ${ctx.tone ?? "acolhedor"}

Texto atual:
"""
${currentText}
"""

Tarefa: ${action}
Devolva JSON: { "text": "<texto final>" } com APENAS o texto final pronto para substituir o atual (sem aspas extras, sem comentários).`;

    const { data, supabaseService } = await completeJson(system, user);
    const text = typeof data?.text === "string" ? data.text.trim() : "";
    if (!text) {
      await logGeneration(supabaseService, userId, "field", body, data, "validation_failed");
      return jsonResponse({ error: "A IA não retornou um texto válido. Tente novamente." }, 502);
    }

    await logGeneration(supabaseService, userId, "field", body, { text }, "success");
    return jsonResponse({ text });
  } catch (err) {
    console.error("[proposal-ai-field]", err);
    const msg = (err as Error)?.message ?? "Erro inesperado";
    return jsonResponse({ error: `Falha na assistência: ${msg}` }, 500);
  }
});
