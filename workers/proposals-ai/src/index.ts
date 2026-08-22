// lunari-proposals-ai — Cloudflare Worker
//
// IA do Construtor de Propostas (módulo Comercial). Substitui as Edge
// Functions proposal-generate / proposal-ai-field (o projeto atingiu o
// teto de 100 functions do plano gratuito do Supabase).
//
// Rotas:
//   GET  /health                    → liveness (sem auth)
//   POST /proposal-generate         → geração completa ou outline (JWT)
//   POST /proposal-ai-field         → reescrita de campo (JWT)
//
// Auth: o app envia o token do usuário logado (Authorization: Bearer ...),
// validado contra o Supabase antes de qualquer processamento.

import { Env, requireUserId, restInsert } from './supabase';
import { completeJson } from './ai';
import { BLOCK_TYPES, sanitizeBlock, sanitizeDesignTokens } from './sanitize';

// ---------- CORS (apenas origens do Lunari) ----------

const ALLOWED_ORIGINS = new Set([
  'https://app.lunarihub.com',
  'https://admin.lunarihub.com',
  'https://www.lunarihub.com',
  'https://lunarihub.com',
  'http://localhost:8080',
  'http://localhost:3000',
]);

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : '';
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Max-Age': '86400',
  };
  if (allow) headers['Access-Control-Allow-Origin'] = allow;
  return headers;
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

// ---------- Log de geração (best-effort) ----------

async function logGeneration(
  env: Env,
  userId: string,
  kind: 'generate' | 'outline' | 'field',
  input: unknown,
  output: unknown,
  status: string
) {
  await restInsert(env, 'proposal_ai_logs', {
    user_id: userId,
    kind,
    input: JSON.parse(JSON.stringify(input ?? {})),
    output: JSON.parse(JSON.stringify(output ?? {})),
    status,
  });
}

// ---------- POST /proposal-generate ----------

async function handleGenerate(env: Env, userId: string, body: any, origin: string | null): Promise<Response> {
  const briefing = body?.briefing ?? {};
  const mode: 'full' | 'outline' = body?.mode === 'outline' ? 'outline' : 'full';

  if (!briefing.session_type) {
    return json({ error: 'briefing.session_type é obrigatório' }, 400, origin);
  }

  const pkgSummary =
    Array.isArray(briefing.packages) && briefing.packages.length > 0
      ? briefing.packages.map((p: any) => `- ${p.name}: ${p.price} (${(p.features ?? []).join('; ')})`).join('\n')
      : 'Nenhum pacote informado; crie 2 a 3 pacotes coerentes com o tipo de sessão e preços realistas para o mercado brasileiro.';

  const system = `Você é um redator comercial sênior especializado em propostas para fotógrafos profissionais brasileiros.
Escreve em português do Brasil, com copy emocional e persuasiva porém elegante, sem exageros.
Conhece a estrutura do construtor de propostas Lunari (blocos V2).`;

  if (mode === 'outline') {
    const user = `Briefing:
- Tipo de sessão: ${briefing.session_type}
- Cliente: ${briefing.client_name || 'não informado'}
- Tom: ${briefing.tone || 'acolhedor'}
- Observações: ${briefing.highlights || 'nenhuma'}

Proponha a estrutura ideal de seções para esta proposta.
Tipos disponíveis: ${BLOCK_TYPES.join(', ')}.
Devolva JSON: { "outline": [ { "type": "<um dos tipos>", "reason": "<por que esta seção, 1 frase>" } ] }
Máximo 7 seções, ordem lógica de persuasão (comece por CoverBlock, termine por CTABlock ou FooterTerms).`;

    const data = (await completeJson(env, system, user)) as any;
    const outline = (data?.outline ?? [])
      .filter((o: any) => (BLOCK_TYPES as readonly string[]).includes(o?.type))
      .slice(0, 8)
      .map((o: any) => ({ type: String(o.type), reason: String(o.reason ?? '') }));
    await logGeneration(env, userId, 'outline', briefing, outline, 'success');
    return json({ outline }, 200, origin);
  }

  const user = `Briefing:
- Tipo de sessão: ${briefing.session_type}
- Cliente: ${briefing.client_name || 'não informado'}
- Fotógrafo: ${briefing.photographer_name || 'não informado'}
- Tom desejado: ${briefing.tone || 'acolhedor'}
- Observações: ${briefing.highlights || 'nenhuma'}

Pacotes:
${pkgSummary}

Gere uma proposta completa com os blocos V2 do Lunari.
Formato JSON exato:
{
  "blocks": [
    { "type": "CoverBlock", "content": { "eyebrow", "title", "title_italic", "subtitle", "photographer_name", "btnText", "image_url": "" } },
    { "type": "EditorialBlock", "content": { "eyebrow", "title", "title_italic", "body", "vertical_label", "details": [{ "label", "value" }] } },
    { "type": "Gallery", "content": { "eyebrow", "title", "caption", "images": [ { "span": "normal|tall_2rows|wide_2cols" } ] } },
    { "type": "PricingTable", "content": { "eyebrow", "title", "packages": [{ "name", "price", "price_unit", "badge", "features": [] }] } },
    { "type": "TestimonialBlock", "content": { "eyebrow", "title", "items": [{ "quote", "author", "service" }] } },
    { "type": "CTABlock", "content": { "cta_text", "links": [] } },
    { "type": "FooterTerms", "content": { "copyright" } }
  ],
  "design_tokens": { "colors": { "cream", "linen", "stone", "taupe", "accent", "ink" }, "typography": { "display": "Cormorant Garamond", "body": "Jost" } }
}

Regras:
- Sempre inclua CoverBlock, EditorialBlock, PricingTable e CTABlock; Gallery/TestimonialBlock/FooterTerms opcionais mas recomendados.
- Gallery: 6 a 8 imagens com "span" variado (image_ref vazio — o fotógrafo envia depois).
- TestimonialBlock: 3 a 4 depoimentos plausíveis e genéricos (o fotógrafo substitui pelos reais).
- CTABlock.links: array vazio (preenchido pelo fotógrafo).
- Textos: específicos ao tipo de sessão, sem placeholders tipo "lorem ipsum".
- design_tokens: paleta coerente com o tom (hex válidos).`;

  const data = (await completeJson(env, system, user)) as any;

  const blocks = (Array.isArray(data?.blocks) ? data.blocks : [])
    .map((b: any, i: number) => sanitizeBlock(b, i))
    .filter((b: any): b is NonNullable<typeof b> => b !== null);

  if (blocks.length === 0) {
    await logGeneration(env, userId, 'generate', briefing, data, 'validation_failed');
    return json({ error: 'A IA não retornou blocos válidos. Tente novamente.' }, 502, origin);
  }

  const design_tokens = sanitizeDesignTokens(data?.design_tokens);
  await logGeneration(env, userId, 'generate', briefing, { blocks, design_tokens }, 'success');
  return json({ blocks, design_tokens }, 200, origin);
}

// ---------- POST /proposal-ai-field ----------

const ACTIONS: Record<string, string> = {
  improve: 'Melhore o texto: mais fluidez, persuasão e clareza, mantendo o significado e o tamanho aproximado.',
  rewrite: 'Reescreva o texto com outra abordagem criativa, mantendo o objetivo e o público.',
  shorten: 'Encurte o texto drasticamente (metade do tamanho no máximo) sem perder a essência.',
  expand: 'Expanda o texto com detalhes sensoriais e benefícios concretos, sem repetições.',
};

async function handleField(env: Env, userId: string, body: any, origin: string | null): Promise<Response> {
  const action = ACTIONS[body?.action];
  const currentText = typeof body?.current_text === 'string' ? body.current_text : '';

  if (!action) return json({ error: 'action inválida (use improve|rewrite|shorten|expand)' }, 400, origin);
  if (!currentText.trim()) return json({ error: 'current_text vazio' }, 400, origin);

  const ctx = body?.context ?? {};
  const system = `Você é um redator comercial sênior especializado em propostas para fotógrafos profissionais brasileiros.
Português do Brasil, copy elegante e emocional, sem exageros nem clichês de marketing agressivo.`;

  const user = `Campo de uma proposta comercial:
- Bloco: ${body?.block_type ?? 'seção'}
- Campo: ${body?.field_label ?? 'texto'}
- Proposta: ${ctx.material_title ?? 'não informada'}
- Tipo de sessão: ${ctx.session_type ?? 'não informado'}
- Tom: ${ctx.tone ?? 'acolhedor'}

Texto atual:
"""
${currentText}
"""

Tarefa: ${action}
Devolva JSON: { "text": "<texto final>" } com APENAS o texto final pronto para substituir o atual (sem aspas extras, sem comentários).`;

  const data = (await completeJson(env, system, user)) as any;
  const text = typeof data?.text === 'string' ? data.text.trim() : '';
  if (!text) {
    await logGeneration(env, userId, 'field', body, data, 'validation_failed');
    return json({ error: 'A IA não retornou um texto válido. Tente novamente.' }, 502, origin);
  }

  await logGeneration(env, userId, 'field', body, { text }, 'success');
  return json({ text }, 200, origin);
}

// ---------- Router ----------

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === '/health') {
      return json({ ok: true, worker: 'lunari-proposals-ai' }, 200, origin);
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, origin);
    }

    try {
      const userId = await requireUserId(env, request.headers.get('Authorization'));
      if (!userId) return json({ error: 'Não autenticado' }, 401, origin);

      const body = await request.json();

      if (url.pathname === '/proposal-generate') {
        return await handleGenerate(env, userId, body, origin);
      }
      if (url.pathname === '/proposal-ai-field') {
        return await handleField(env, userId, body, origin);
      }

      return json({ error: 'Rota não encontrada' }, 404, origin);
    } catch (err) {
      console.error('[proposals-ai]', err);
      const msg = (err as Error)?.message ?? 'Erro inesperado';
      return json({ error: `Falha na IA: ${msg}` }, 500, origin);
    }
  },
};
