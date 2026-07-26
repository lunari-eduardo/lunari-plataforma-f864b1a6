// Onda 6 — Knowledge Engine v1
// Embeds text via Lovable AI Gateway and upserts into knowledge_documents.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod";

const BodySchema = z.object({
  source: z.string().min(1).max(64),
  external_id: z.string().max(128).optional().nullable(),
  title: z.string().max(500).optional().nullable(),
  content: z.string().min(1).max(20000),
  metadata: z.record(z.unknown()).optional(),
});

const MODEL = "openai/text-embedding-3-small"; // 1536 dims

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
    const body = parsed.data;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "missing_llm_key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const embRes = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({ model: MODEL, input: body.content }),
    });

    if (!embRes.ok) {
      const errBody = await embRes.text();
      return new Response(
        JSON.stringify({ error: "embedding_failed", status: embRes.status, detail: errBody }),
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
    const vectorLiteral = `[${vector.join(",")}]`;

    // Upsert by (user_id, source, external_id) when external_id provided; else insert.
    let record;
    if (body.external_id) {
      const { data, error } = await admin
        .from("knowledge_documents")
        .upsert(
          {
            user_id: userId,
            source: body.source,
            external_id: body.external_id,
            title: body.title ?? null,
            content: body.content,
            metadata: body.metadata ?? {},
            embedding: vectorLiteral,
            model_version: MODEL,
          },
          { onConflict: "user_id,source,external_id" },
        )
        .select("id, source, external_id, title, updated_at")
        .single();
      if (error) throw error;
      record = data;
    } else {
      const { data, error } = await admin
        .from("knowledge_documents")
        .insert({
          user_id: userId,
          source: body.source,
          title: body.title ?? null,
          content: body.content,
          metadata: body.metadata ?? {},
          embedding: vectorLiteral,
          model_version: MODEL,
        })
        .select("id, source, external_id, title, updated_at")
        .single();
      if (error) throw error;
      record = data;
    }

    return new Response(JSON.stringify({ ok: true, document: record }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[knowledge-embed] error", e);
    return new Response(JSON.stringify({ error: "internal", message: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
