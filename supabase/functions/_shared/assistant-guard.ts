/**
 * assistant-guard — gate de rollout da Lu (Admin → Beta → Geral).
 *
 * Chama a RPC `public.assistant_access_allowed(_uid)` que lê o estágio ativo
 * em `app_settings.assistant_rollout_stage` e valida contra `user_roles` /
 * `assistant_beta_access`. Fail-closed.
 *
 * Uso (dentro de uma edge function do assistente, após obter `userId` do JWT):
 *
 *   import { assertAssistantAccess } from "../_shared/assistant-guard.ts";
 *   const denied = await assertAssistantAccess(supabase, userId, corsHeaders);
 *   if (denied) return denied;
 */
// deno-lint-ignore-file no-explicit-any
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export async function isAssistantAllowed(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("assistant_access_allowed", {
      _uid: userId,
    });
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

export async function assertAssistantAccess(
  supabase: SupabaseClient,
  userId: string,
  corsHeaders: Record<string, string>,
  meta?: { module?: string; capability_id?: string },
): Promise<Response | null> {
  const allowed = await isAssistantAllowed(supabase, userId);
  if (allowed) return null;
  // Best-effort audit — não bloqueia a resposta se falhar.
  try {
    await supabase.from("assistant_invocations").insert({
      user_id: userId,
      capability_id: meta?.capability_id ?? "assistant.access",
      module: meta?.module ?? "assistant",
      kind: "gate",
      actor: "system",
      output_status: "blocked_by_rollout",
    });
  } catch { /* ignore */ }
  return new Response(
    JSON.stringify({
      error: "assistant_locked",
      message:
        "A assistente Lu está em teste fechado. Solicite acesso para participar do beta.",
    }),
    {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
