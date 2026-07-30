/**
 * automation-scheduler — Onda 4 (D2).
 *
 * Worker invocado pelo pg_cron a cada 5 minutos. Ciclo:
 *
 *   1. kill-switch global (`app_settings.automation_enabled`) — off = sai.
 *   2. seleciona apenas usuários com pelo menos UMA regra habilitada
 *      (nunca varre a base inteira) e com rollout da Lu liberado.
 *   3. roda os detectores por tempo das regras ativas daquele usuário.
 *   4. enfileira candidatos novos em `automation_queue` (idempotente por
 *      user + rule + entity + window).
 *   5. drena a fila executando SOMENTE capabilities da allowlist não
 *      destrutiva. Qualquer outra coisa vira `approval_required`.
 *   6. registra toda tentativa em `automation_runs` e atualiza
 *      `automation_schedule_state`.
 *
 * Constituição: nada destrutivo é executado sem aprovação humana; nenhum
 * dado cruza entre usuários; toda tentativa é auditável.
 */
// deno-lint-ignore-file no-explicit-any
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { detect, TRIGGER_KINDS, type TriggerKind } from "./triggers.ts";

const CYCLE_MINUTES = 5;
const MAX_USERS_PER_CYCLE = 40;
const MAX_QUEUE_DRAIN = 60;
const MAX_ATTEMPTS = 4;

/** Capabilities que Automation pode executar sozinha — nunca destrutivas. */
const SAFE_CAPABILITIES = new Set(["tasks.create"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function service(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function killSwitchOn(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "automation_enabled")
    .maybeSingle();
  return (data?.value as unknown) === true;
}

async function rolloutAllows(supabase: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("assistant_access_allowed", { _uid: userId });
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

interface Rule {
  id: string;
  user_id: string;
  capability_id: string;
  source_kind: string | null;
  enabled: boolean;
  config: Record<string, unknown> | null;
}

async function recordRun(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
): Promise<boolean> {
  const { error } = await supabase.from("automation_runs").insert(row);
  if (error) {
    // 23505 = já registrado nesta janela. Idempotência funcionando.
    if ((error as any).code === "23505") return false;
    console.error("[scheduler] recordRun error", error.message);
    return false;
  }
  return true;
}

/** Enfileira candidatos novos. Retorna quantos entraram de fato. */
async function enqueue(supabase: SupabaseClient, rule: Rule): Promise<number> {
  const kind = (rule.source_kind ?? "") as TriggerKind;
  if (!TRIGGER_KINDS.includes(kind)) return 0;

  const candidates = await detect(kind, supabase, rule.user_id, rule.config);
  if (candidates.length === 0) return 0;

  const rows = candidates.map((c) => ({
    user_id: rule.user_id,
    rule_id: rule.id,
    capability_id: rule.capability_id,
    trigger_kind: kind,
    entity_id: c.entityId,
    window_key: c.windowKey,
    payload: c.payload,
  }));

  const { data, error } = await supabase
    .from("automation_queue")
    .upsert(rows, {
      onConflict: "user_id,rule_id,entity_id,window_key",
      ignoreDuplicates: true,
    })
    .select("id");
  if (error) {
    console.error("[scheduler] enqueue error", error.message);
    return 0;
  }
  return (data ?? []).length;
}

interface QueueItem {
  id: string;
  user_id: string;
  rule_id: string;
  capability_id: string;
  trigger_kind: string;
  entity_id: string;
  window_key: string;
  payload: any;
  attempts: number;
}

async function executeItem(
  supabase: SupabaseClient,
  item: QueueItem,
): Promise<"ok" | "failed" | "approval_required"> {
  const base = {
    user_id: item.user_id,
    rule_id: item.rule_id,
    proposal_id: null,
    capability_id: item.capability_id,
    actor: `automation:${item.rule_id}`,
    trigger_kind: item.trigger_kind,
    entity_id: item.entity_id,
    window_key: item.window_key,
  };

  if (!SAFE_CAPABILITIES.has(item.capability_id)) {
    await recordRun(supabase, {
      ...base,
      status: "approval_required",
      error_code: "APPROVAL_REQUIRED",
      error_message:
        "Capability fora da allowlist não destrutiva do scheduler — exige aprovação humana.",
    });
    return "approval_required";
  }

  // tasks.create — escrita escopada ao dono da regra, nunca a outro usuário.
  const p = item.payload ?? {};
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: item.user_id,
      title: String(p.title ?? "Tarefa automática"),
      description: p.description ? String(p.description) : null,
      status: "pending",
      priority: "medium",
      source: "automation",
      related_cliente_id: p.relatedClienteId ?? null,
      related_session_id: p.relatedSessionId ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    await recordRun(supabase, {
      ...base,
      status: "failed",
      error_code: "TASK_CREATE_FAILED",
      error_message: error.message.slice(0, 400),
    });
    return "failed";
  }

  await recordRun(supabase, { ...base, status: "ok", result: { taskId: data?.id ?? null } });
  return "ok";
}

async function runCycle(supabase: SupabaseClient) {
  const summary = {
    users: 0,
    enqueued: 0,
    ok: 0,
    failed: 0,
    approvalRequired: 0,
    skipped: 0,
  };

  const { data: rulesRaw, error: rulesErr } = await supabase
    .from("automation_rules")
    .select("id, user_id, capability_id, source_kind, enabled, config")
    .eq("enabled", true);
  if (rulesErr) throw rulesErr;

  const rules = (rulesRaw ?? []) as Rule[];
  const byUser = new Map<string, Rule[]>();
  for (const r of rules) {
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
    byUser.get(r.user_id)!.push(r);
  }

  const users = Array.from(byUser.keys()).slice(0, MAX_USERS_PER_CYCLE);
  const nextRunAt = new Date(Date.now() + CYCLE_MINUTES * 60_000).toISOString();

  for (const userId of users) {
    const perUser = { enqueued: 0, ok: 0, failed: 0, approvalRequired: 0, skipped: 0 };
    try {
      if (!(await rolloutAllows(supabase, userId))) {
        perUser.skipped++;
        summary.skipped++;
        continue;
      }
      summary.users++;

      // 1) detectar + enfileirar
      for (const rule of byUser.get(userId)!) {
        try {
          const n = await enqueue(supabase, rule);
          perUser.enqueued += n;
          summary.enqueued += n;
        } catch (e) {
          console.error("[scheduler] detect failed", rule.id, (e as Error).message);
        }
      }

      // 2) drenar fila do usuário
      const { data: items } = await supabase
        .from("automation_queue")
        .select("*")
        .eq("user_id", userId)
        .is("processed_at", null)
        .lte("next_attempt_at", new Date().toISOString())
        .lt("attempts", MAX_ATTEMPTS)
        .order("created_at", { ascending: true })
        .limit(MAX_QUEUE_DRAIN);

      for (const item of ((items ?? []) as QueueItem[])) {
        const result = await executeItem(supabase, item);
        if (result === "ok") {
          perUser.ok++;
          summary.ok++;
          await supabase
            .from("automation_queue")
            .update({ processed_at: new Date().toISOString(), attempts: item.attempts + 1 })
            .eq("id", item.id);
        } else if (result === "approval_required") {
          perUser.approvalRequired++;
          summary.approvalRequired++;
          await supabase
            .from("automation_queue")
            .update({
              processed_at: new Date().toISOString(),
              attempts: item.attempts + 1,
              last_error: "approval_required",
            })
            .eq("id", item.id);
        } else {
          perUser.failed++;
          summary.failed++;
          const attempts = item.attempts + 1;
          const backoff = Math.min(60, 5 * 2 ** attempts);
          await supabase
            .from("automation_queue")
            .update({
              attempts,
              next_attempt_at: new Date(Date.now() + backoff * 60_000).toISOString(),
              last_error: "execution_failed",
              ...(attempts >= MAX_ATTEMPTS ? { processed_at: new Date().toISOString() } : {}),
            })
            .eq("id", item.id);
        }
      }

      await supabase.from("automation_schedule_state").upsert(
        {
          user_id: userId,
          last_run_at: new Date().toISOString(),
          next_run_at: nextRunAt,
          last_cycle: perUser,
          consecutive_errors: 0,
        },
        { onConflict: "user_id" },
      );
    } catch (e) {
      console.error("[scheduler] user cycle failed", userId, (e as Error).message);
      await supabase.from("automation_schedule_state").upsert(
        {
          user_id: userId,
          last_run_at: new Date().toISOString(),
          next_run_at: nextRunAt,
          last_cycle: { ...perUser, error: (e as Error).message.slice(0, 200) },
        },
        { onConflict: "user_id" },
      );
    }
  }

  return summary;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = service();

    if (!(await killSwitchOn(supabase))) {
      return json({ ok: true, killSwitchOn: false, skipped: "global_disabled" });
    }

    const summary = await runCycle(supabase);
    console.log("[scheduler] cycle", JSON.stringify(summary));
    return json({ ok: true, killSwitchOn: true, ...summary });
  } catch (e) {
    console.error("[scheduler] fatal", (e as Error).message);
    return json({ ok: false, error: "scheduler_failed" }, 500);
  }
});
