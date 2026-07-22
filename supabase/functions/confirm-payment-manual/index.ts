// =============================================================================
// confirm-payment-manual (Studio) — Contrato oficial Gallery↔Studio
// -----------------------------------------------------------------------------
// Registra pagamento manual (dinheiro/PIX externo/transferência/cartão externo)
// vinculado a uma galeria. Espelha o contrato do Gallery documentado em
// docs/handoff (seções 1–6). Regras críticas:
//  2.1 rejeita reuso de cobrança pago/pago_manual/cancelado → cria nova
//  2.2 rejeita sobrescrever cobrança digital pendente com método manual
//  2.3 cancela cobranças pendentes irmãs da mesma galeria (digitais)
//  2.4 dedup 60s por (galeria+valor+método+manual)
//  3.  cria cobrança manual com finalidade='fotos_extras' | 'sessao_e_extras'
//  4.  atualiza valor apenas se cobrança ainda pendente
//  5.  chama finalize_gallery_payment (fonte única de verdade)
//  6.  grava audit_log.action='confirm_payment_manual' com cancelled_pending_ids
// =============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

type MetodoManual =
  | "dinheiro"
  | "pix_externo"
  | "transferencia"
  | "cartao_externo"
  | "outro";

interface Body {
  cobrancaId?: string | null;
  galleryId?: string | null;
  sessionId?: string | null;
  metodoManual: MetodoManual;
  valorManual: number;
  observacao?: string;
  receiptUrl?: string;
  paidAt?: string;
  /** 'fotos_extras' (default) ou 'sessao_e_extras' */
  finalidade?: "fotos_extras" | "sessao_e_extras";
  /** Componentes quando finalidade='sessao_e_extras' */
  valorExtrasComponente?: number;
  valorSessaoComponente?: number;
  /** Metadados opcionais de auditoria */
  source?: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    // Valida JWT do fotógrafo
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user?.id) return json({ error: "unauthorized" }, 401);
    const userId = userData.user.id;

    const body = (await req.json()) as Body;
    const {
      metodoManual,
      valorManual,
      observacao,
      receiptUrl,
      paidAt,
      source = "studio_workflow",
    } = body;
    let { cobrancaId, galleryId, sessionId, finalidade } = body;
    finalidade = finalidade ?? "fotos_extras";

    if (!metodoManual || !(valorManual > 0)) {
      return json({ error: "invalid_input" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date().toISOString();

    // ─────────────────────────────────────────────────────────────
    // Se cobrancaId veio, validar ownership + regras 2.1 e 2.2
    // ─────────────────────────────────────────────────────────────
    if (cobrancaId) {
      const { data: cob } = await admin
        .from("cobrancas")
        .select("id, user_id, status, provedor, galeria_id, session_id, cliente_id")
        .eq("id", cobrancaId)
        .maybeSingle();

      if (!cob || cob.user_id !== userId) {
        return json({ error: "cobranca_not_found_or_forbidden" }, 403);
      }
      // 2.1 — cobrança já quitada/cancelada → descarta e cria nova
      if (["pago", "pago_manual", "cancelado"].includes(cob.status ?? "")) {
        cobrancaId = null;
        galleryId = galleryId ?? cob.galeria_id ?? null;
        sessionId = sessionId ?? cob.session_id ?? null;
      }
      // 2.2 — pendente digital + método manual → descarta e cria nova
      else if (
        cob.status === "pendente" &&
        cob.provedor &&
        cob.provedor !== "manual"
      ) {
        cobrancaId = null;
        galleryId = galleryId ?? cob.galeria_id ?? null;
        sessionId = sessionId ?? cob.session_id ?? null;
      }
    }

    if (!galleryId) {
      return json({ error: "missing_gallery_id" }, 400);
    }

    // Ownership galeria + resolver cliente/session_id
    const { data: gal } = await admin
      .from("galerias")
      .select("id, user_id, cliente_id, session_id")
      .eq("id", galleryId)
      .maybeSingle();
    if (!gal || gal.user_id !== userId) {
      return json({ error: "gallery_not_found_or_forbidden" }, 403);
    }
    sessionId = sessionId ?? gal.session_id ?? null;
    const clienteId = gal.cliente_id;

    // ─────────────────────────────────────────────────────────────
    // 2.3 — cancelar cobranças pendentes digitais da mesma galeria
    // ─────────────────────────────────────────────────────────────
    const { data: pendentesIrmas } = await admin
      .from("cobrancas")
      .select("id, provedor")
      .eq("galeria_id", galleryId)
      .eq("status", "pendente")
      .neq("provedor", "manual");

    const cancelledIds: string[] = [];
    if (pendentesIrmas?.length) {
      for (const p of pendentesIrmas) {
        if (p.id === cobrancaId) continue;
        const { error: cancErr } = await admin
          .from("cobrancas")
          .update({
            status: "cancelado",
            obs_manual: `Cancelada — substituída por recebimento manual em ${now}`,
            updated_at: now,
          })
          .eq("id", p.id)
          .eq("status", "pendente");
        if (!cancErr) cancelledIds.push(p.id);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 2.4 — dedup 60s (mesma galeria + valor + método + manual)
    // ─────────────────────────────────────────────────────────────
    if (!cobrancaId) {
      const cutoff = new Date(Date.now() - 60_000).toISOString();
      const { data: dup } = await admin
        .from("cobrancas")
        .select("id, status")
        .eq("galeria_id", galleryId)
        .eq("provedor", "manual")
        .eq("metodo_manual", metodoManual)
        .eq("valor", valorManual)
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (dup?.id) cobrancaId = dup.id;
    }

    // ─────────────────────────────────────────────────────────────
    // 3 — criar cobrança manual (se necessário)
    // ─────────────────────────────────────────────────────────────
    if (!cobrancaId) {
      const componenteExtras =
        finalidade === "sessao_e_extras"
          ? body.valorExtrasComponente ?? null
          : null;

      const { data: inserted, error: insErr } = await admin
        .from("cobrancas")
        .insert({
          user_id: userId,
          galeria_id: galleryId,
          session_id: sessionId,
          cliente_id: clienteId,
          valor: valorManual,
          valor_liquido: valorManual,
          valor_extras_componente: componenteExtras,
          tipo_cobranca: finalidade === "sessao_e_extras" ? "sessao_e_extras" : "foto_extra",
          finalidade,
          provedor: "manual",
          status: "pendente",
          metodo_manual: metodoManual,
          obs_manual: observacao ?? null,
          descricao: observacao?.trim() || `Pagamento manual (${metodoManual})`,
        })
        .select("id")
        .single();

      if (insErr || !inserted?.id) {
        console.error("[confirm-payment-manual] insert error", insErr);
        return json({ error: "insert_failed", details: insErr?.message }, 500);
      }
      cobrancaId = inserted.id;
    } else {
      // 4 — atualizar valor apenas se ainda pendente
      await admin
        .from("cobrancas")
        .update({ valor: valorManual, updated_at: now })
        .eq("id", cobrancaId)
        .eq("status", "pendente");
    }

    // ─────────────────────────────────────────────────────────────
    // 5 — RPC canônica finalize_gallery_payment (advisory lock)
    // ─────────────────────────────────────────────────────────────
    const { data: rpcData, error: rpcErr } = await admin.rpc(
      "finalize_gallery_payment",
      {
        p_cobranca_id: cobrancaId,
        p_receipt_url: receiptUrl ?? null,
        p_paid_at: paidAt ?? now,
        p_manual_method: metodoManual,
        p_manual_obs: observacao ?? null,
      },
    );

    if (rpcErr) {
      console.error("[confirm-payment-manual] finalize_gallery_payment failed", rpcErr);
      return json(
        { error: "finalize_failed", details: rpcErr.message, cobrancaId },
        500,
      );
    }

    const alreadyPaid = Boolean((rpcData as any)?.already_paid);
    const galeriaId = (rpcData as any)?.galeria_id ?? galleryId;

    // ─────────────────────────────────────────────────────────────
    // 6 — audit_log
    // ─────────────────────────────────────────────────────────────
    try {
      await admin.from("audit_log").insert({
        action: "confirm_payment_manual",
        actor_type: "user",
        actor_id: userId,
        resource_type: "payment",
        resource_id: cobrancaId,
        gallery_id: galeriaId,
        metadata: {
          valor: valorManual,
          provedor: "manual",
          metodo: metodoManual,
          observacao,
          cancelled_pending_ids: cancelledIds,
          source,
          already_paid: alreadyPaid,
        },
      });
    } catch (auditErr) {
      console.warn("[confirm-payment-manual] audit_log insert failed (non-blocking)", auditErr);
    }

    return json({
      success: true,
      cobrancaId,
      galeriaId,
      alreadyPaid,
      cancelledPendingIds: cancelledIds,
    });
  } catch (e) {
    console.error("[confirm-payment-manual] fatal", e);
    return json({ error: "internal_error", details: String(e) }, 500);
  }
});
