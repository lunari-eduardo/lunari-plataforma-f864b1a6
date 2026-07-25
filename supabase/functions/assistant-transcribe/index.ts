/**
 * assistant-transcribe — Onda E.4 (voz).
 *
 * Proxy fino de speech-to-text para o Lovable AI Gateway. Recebe
 * `multipart/form-data` com o campo `file` (áudio WAV/webm/mp3) e devolve
 * o SSE do gateway sem buffering.
 *
 * Regras:
 *  - JWT obrigatório (mesmo pattern do assistant-chat).
 *  - Chave `LOVABLE_API_KEY` fica server-side; jamais volta para o cliente.
 *  - `response_format` padrão (JSON) para preservar `usage` no evento final.
 */

// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_MODEL = "openai/gpt-4o-mini-transcribe";
const GATEWAY_URL =
  "https://ai.gateway.lovable.dev/v1/audio/transcriptions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // ── Auth (JWT) ────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "missing_jwt" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user?.id) {
      return new Response(JSON.stringify({ error: "invalid_jwt" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { assertAssistantAccess } = await import("../_shared/assistant-guard.ts");
    const denied = await assertAssistantAccess(supabase, userRes.user.id, corsHeaders);
    if (denied) return denied;

    // ── Body (multipart) ──────────────────────────────────────────────────
    const contentType = req.headers.get("Content-Type") ?? "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return new Response(
        JSON.stringify({ error: "expected_multipart_form_data" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const inbound = await req.formData();
    const file = inbound.get("file");
    if (!(file instanceof File) || file.size < 512) {
      return new Response(
        JSON.stringify({
          error: "empty_or_missing_file",
          detail: "Grave um áudio um pouco mais longo e tente de novo.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const modelId =
      (inbound.get("model") as string | null)?.trim() || DEFAULT_MODEL;
    const stream = (inbound.get("stream") as string | null) ?? "true";

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "missing_lovable_api_key" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── Forward para o Gateway ───────────────────────────────────────────
    const upstream = new FormData();
    upstream.append("model", modelId);
    // Preserva o filename original (o gateway usa a extensão para inferir formato).
    upstream.append("file", file, file.name || "recording.wav");
    if (stream) upstream.append("stream", stream);

    const gatewayResp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    });

    if (!gatewayResp.ok) {
      const errBody = await gatewayResp.text().catch(() => "");
      return new Response(
        JSON.stringify({
          error: "gateway_error",
          status: gatewayResp.status,
          details: errBody.slice(0, 2000),
        }),
        {
          status: gatewayResp.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Streaming SSE pass-through
    if (stream && gatewayResp.body) {
      return new Response(gatewayResp.body, {
        headers: {
          ...corsHeaders,
          "Content-Type":
            gatewayResp.headers.get("Content-Type") ?? "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });
    }
    // Buffered JSON fallback
    const json = await gatewayResp.json();
    return new Response(JSON.stringify(json), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "unexpected",
        message: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
