// Onda 6 — Knowledge Engine v1
// Embeds the query and calls knowledge_match to return owner-scoped results.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod";

const BodySchema = z.object({
  query: z.string().min(1).max(4000),
  source: z.string().max(64).optional().nullable(),
  limit: z.number().int().min(1).max(50).optional(),
});

const MODEL = "openai/text-embedding-3-small";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "missing_auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "invalid_token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "invalid_body", issues: parsed.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { query, source, limit } = parsed.data;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "missing_llm_key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const embRes = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({ model: MODEL, input: query }),
    });
    if (!embRes.ok) {
      const detail = await embRes.text();
      return new Response(
        JSON.stringify({ error: "embedding_failed", status: embRes.status, detail }),
        { status: embRes.status === 429 || embRes.status >= 500 ? 503 : 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const embJson = await embRes.json();
    const vector = embJson?.data?.[0]?.embedding;
    if (!Array.isArray(vector) || vector.length !== 1536) {
      return new Response(JSON.stringify({ error: "bad_embedding_shape" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(url, serviceKey);
    const { data, error } = await admin.rpc("knowledge_match", {
      p_user_id: userId,
      p_query: `[${vector.join(",")}]`,
      p_source: source ?? null,
      p_limit: limit ?? 8,
    });
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, results: data ?? [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[knowledge-search] error", e);
    return new Response(JSON.stringify({ error: "internal", message: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
