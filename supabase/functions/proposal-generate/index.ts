/**
 * proposal-generate — Geração de propostas comerciais por IA.
 *
 * POST (JWT obrigatório) body:
 *  {
 *    mode?: "full" | "outline",           // default "full"
 *    briefing: {
 *      session_type: string,              // ex.: "Gestante", "Casamento"
 *      client_name?: string,
 *      tone?: string,                     // ex.: "Acolhedor", "Sofisticado"
 *      highlights?: string,               // observações livres
 *      photographer_name?: string,
 *      packages?: { name: string; price: string; features: string[] }[]
 *    }
 *  }
 *
 * Response:
 *  - full:    { blocks: BlockData[] (V2), design_tokens?: {...} }
 *  - outline: { outline: { type: string; reason: string }[] }
 *
 * A saída "full" é validada contra a lista canônica de tipos/campos do
 * construtor (espelha src/pages/comercial/blocks/registry.ts); campos
 * desconhecidos são descartados. Tudo 100% editável no editor depois.
 */

import {
  jsonResponse,
  handleCors,
  requireUser,
  completeJson,
  logGeneration,
} from "../_shared/proposal-ai.ts";

// ---- Espelho do registry V2 do frontend (tipos + campos permitidos) ----
const BLOCK_TYPES = ["CoverBlock", "EditorialBlock", "PricingTable", "Gallery", "TestimonialBlock", "CTABlock", "FooterTerms", "text"] as const;

const STRING_FIELDS: Record<string, string[]> = {
  CoverBlock: ["eyebrow", "title", "title_italic", "subtitle", "photographer_name", "btnText", "btnLink", "image_url"],
  EditorialBlock: ["eyebrow", "title", "title_italic", "body", "vertical_label"],
  PricingTable: ["eyebrow", "title"],
  Gallery: ["eyebrow", "title", "caption"],
  TestimonialBlock: ["eyebrow", "title"],
  CTABlock: ["cta_text"],
  FooterTerms: ["copyright"],
  text: ["title", "body"],
};

type Block = { id?: string; type: string; content: Record<string, any>; props?: Record<string, any> };

/** Mantém apenas campos string conhecidos + estruturas de lista conhecidas. */
function sanitizeBlock(raw: any, index: number): Block | null {
  if (!raw || typeof raw !== "object") return null;
  const type = BLOCK_TYPES.find((t) => t === raw.type);
  if (!type) return null;

  const content: Record<string, any> = {};
  const allowed = STRING_FIELDS[type] ?? [];
  for (const f of allowed) {
    if (typeof raw.content?.[f] === "string") content[f] = raw.content[f];
  }

  if (type === "EditorialBlock" && Array.isArray(raw.content?.details)) {
    content.details = raw.content.details
      .filter((d: any) => d && typeof d === "object")
      .map((d: any, i: number) => ({
        id: typeof d.id === "string" ? d.id : `d-${index}-${i}`,
        label: String(d.label ?? ""),
        value: String(d.value ?? ""),
      }));
  }

  if (type === "PricingTable" && Array.isArray(raw.content?.packages)) {
    content.packages = raw.content.packages
      .filter((p: any) => p && typeof p === "object")
      .map((p: any, i: number) => ({
        id: typeof p.id === "string" ? p.id : `pkg-${index}-${i}`,
        name: String(p.name ?? `Pacote ${i + 1}`),
        price: String(p.price ?? ""),
        price_unit: String(p.price_unit ?? "sessão"),
        badge: String(p.badge ?? ""),
        features: Array.isArray(p.features) ? p.features.map((f: any) => String(f)).slice(0, 12) : [],
      }));
  }

  if (type === "TestimonialBlock" && Array.isArray(raw.content?.items)) {
    content.items = raw.content.items
      .filter((t: any) => t && typeof t === "object")
      .map((t: any, i: number) => ({
        id: typeof t.id === "string" ? t.id : `t-${index}-${i}`,
        quote: String(t.quote ?? ""),
        author: String(t.author ?? ""),
        service: String(t.service ?? ""),
      }));
  }

  if (type === "CTABlock" && Array.isArray(raw.content?.links)) {
    content.links = raw.content.links
      .filter((l: any) => l && typeof l === "object" && typeof l.href === "string")
      .map((l: any, i: number) => ({
        id: typeof l.id === "string" ? l.id : `l-${index}-${i}`,
        label: String(l.label ?? ""),
        href: String(l.href ?? ""),
      }));
  }

  if (type === "Gallery" && Array.isArray(raw.content?.images)) {
    content.images = raw.content.images.map((g: any, i: number) => ({
      id: typeof g?.id === "string" ? g.id : `gi-${index}-${i}`,
      image_ref: typeof g?.image_ref === "string" ? g.image_ref : "",
      span: ["normal", "tall_2rows", "wide_2cols"].includes(g?.span) ? g.span : "normal",
    }));
  }

  const block: Block = { type, content };
  if (typeof raw.id === "string" && raw.id) block.id = raw.id;
  if (raw.props && typeof raw.props === "object") block.props = raw.props;
  return block;
}

function sanitizeDesignTokens(raw: any) {
  if (!raw || typeof raw !== "object") return undefined;
  const colors: Record<string, string> = {};
  for (const k of ["cream", "linen", "stone", "taupe", "accent", "ink", "white"]) {
    if (typeof raw.colors?.[k] === "string" && /^#[0-9a-f]{3,8}$/i.test(raw.colors[k])) {
      colors[k] = raw.colors[k];
    }
  }
  const typography: Record<string, string> = {};
  for (const k of ["display", "body"]) {
    if (typeof raw.typography?.[k] === "string") typography[k] = raw.typography[k].slice(0, 60);
  }
  if (Object.keys(colors).length === 0 && Object.keys(typography).length === 0) return undefined;
  const tokens: Record<string, any> = {};
  if (Object.keys(colors).length) tokens.colors = colors;
  if (Object.keys(typography).length) tokens.typography = typography;
  return tokens;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const userId = await requireUser(req);
    if (!userId) return jsonResponse({ error: "Não autenticado" }, 401);

    const body = await req.json();
    const briefing = body?.briefing ?? {};
    const mode: "full" | "outline" = body?.mode === "outline" ? "outline" : "full";

    if (!briefing.session_type) {
      return jsonResponse({ error: "briefing.session_type é obrigatório" }, 400);
    }

    const pkgSummary = Array.isArray(briefing.packages) && briefing.packages.length > 0
      ? briefing.packages.map((p: any) => `- ${p.name}: ${p.price} (${(p.features ?? []).join("; ")})`).join("\n")
      : "Nenhum pacote informado; crie 2 a 3 pacotes coerentes com o tipo de sessão e preços realistas para o mercado brasileiro.";

    const system = `Você é um redator comercial sênior especializado em propostas para fotógrafos profissionais brasileiros.
Escreve em português do Brasil, com copy emocional e persuasiva porém elegante, sem exageros.
Conhece a estrutura do construtor de propostas Lunari (blocos V2).`;

    if (mode === "outline") {
      const user = `Briefing:
- Tipo de sessão: ${briefing.session_type}
- Cliente: ${briefing.client_name || "não informado"}
- Tom: ${briefing.tone || "acolhedor"}
- Observações: ${briefing.highlights || "nenhuma"}

Proponha a estrutura ideal de seções para esta proposta.
Tipos disponíveis: ${BLOCK_TYPES.join(", ")}.
Devolva JSON: { "outline": [ { "type": "<um dos tipos>", "reason": "<por que esta seção, 1 frase>" } ] }
Máximo 7 seções, ordem lógica de persuasão (comece por CoverBlock, termine por CTABlock ou FooterTerms).`;

      const { data, supabaseService } = await completeJson(system, user);
      const outline = (data?.outline ?? [])
        .filter((o: any) => BLOCK_TYPES.includes(o?.type))
        .slice(0, 8)
        .map((o: any) => ({ type: String(o.type), reason: String(o.reason ?? "") }));
      await logGeneration(supabaseService, userId, "outline", briefing, outline, "success");
      return jsonResponse({ outline });
    }

    const user = `Briefing:
- Tipo de sessão: ${briefing.session_type}
- Cliente: ${briefing.client_name || "não informado"}
- Fotógrafo: ${briefing.photographer_name || "não informado"}
- Tom desejado: ${briefing.tone || "acolhedor"}
- Observações: ${briefing.highlights || "nenhuma"}

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

    const { data, supabaseService } = await completeJson(system, user);

    const blocks = (Array.isArray(data?.blocks) ? data.blocks : [])
      .map((b: any, i: number) => sanitizeBlock(b, i))
      .filter((b: Block | null): b is Block => b !== null);

    if (blocks.length === 0) {
      await logGeneration(supabaseService, userId, "generate", briefing, data, "validation_failed");
      return jsonResponse({ error: "A IA não retornou blocos válidos. Tente novamente." }, 502);
    }

    const design_tokens = sanitizeDesignTokens(data?.design_tokens);
    await logGeneration(supabaseService, userId, "generate", briefing, { blocks, design_tokens }, "success");
    return jsonResponse({ blocks, design_tokens });
  } catch (err) {
    console.error("[proposal-generate]", err);
    const msg = (err as Error)?.message ?? "Erro inesperado";
    return jsonResponse({ error: `Falha na geração: ${msg}` }, 500);
  }
});
