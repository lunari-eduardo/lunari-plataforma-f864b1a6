import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GB = 1024 * 1024 * 1024;
const STORAGE_LIMITS: Record<string, number> = {
  transfer_5gb: 5 * GB,
  transfer_20gb: 20 * GB,
  transfer_50gb: 50 * GB,
  transfer_100gb: 100 * GB,
  combo_completo: 20 * GB,
};

const PLAN_SUBSCRIPTION_CREDITS: Record<string, number> = {
  combo_pro_select2k: 2000,
  combo_completo: 2000,
};

const PLAN_PRICES: Record<string, { monthly: number; yearly: number }> = {
  studio_starter: { monthly: 1490, yearly: 15198 },
  studio_pro: { monthly: 3590, yearly: 36618 },
  transfer_5gb: { monthly: 1290, yearly: 12384 },
  transfer_20gb: { monthly: 2490, yearly: 23904 },
  transfer_50gb: { monthly: 3490, yearly: 33504 },
  transfer_100gb: { monthly: 5990, yearly: 57504 },
  combo_pro_select2k: { monthly: 4490, yearly: 45259 },
  combo_completo: { monthly: 6490, yearly: 66198 },
};

const ASAAS_BASE_URL = Deno.env.get("ASAAS_ENV") === "production"
  ? "https://api.asaas.com"
  : "https://api-sandbox.asaas.com";

async function applyDowngrade(adminClient: any, subscription: any) {
  const newPlanType = subscription.pending_downgrade_plan;
  const newCycle = subscription.pending_downgrade_cycle || subscription.billing_cycle;

  if (!newPlanType) return;

  console.log(`Applying scheduled downgrade: ${subscription.plan_type} → ${newPlanType}`);

  const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
  if (!ASAAS_API_KEY) {
    console.error("ASAAS_API_KEY not configured, cannot apply downgrade");
    return;
  }

  const userId = subscription.user_id;

  if (subscription.asaas_subscription_id) {
    const cancelRes = await fetch(
      `${ASAAS_BASE_URL}/v3/subscriptions/${subscription.asaas_subscription_id}`,
      { method: "DELETE", headers: { access_token: ASAAS_API_KEY } }
    );
    if (!cancelRes.ok) {
      console.error("Failed to cancel old subscription in Asaas:", await cancelRes.text());
    }
  }

  await adminClient
    .from("subscriptions_asaas")
    .update({
      status: "CANCELLED",
      pending_downgrade_plan: null,
      pending_downgrade_cycle: null,
    })
    .eq("id", subscription.id);

  const { data: account } = await adminClient
    .from("photographer_accounts")
    .select("asaas_customer_id")
    .eq("user_id", userId)
    .single();

  if (!account?.asaas_customer_id) {
    console.error("No customer ID found for user:", userId);
    return;
  }

  const newPrices = PLAN_PRICES[newPlanType];
  if (!newPrices) {
    console.error("Unknown plan type for pricing:", newPlanType);
    return;
  }
  const newValueCents = newCycle === "YEARLY" ? newPrices.yearly : newPrices.monthly;
  const newValueReais = newValueCents / 100;

  const creditCardToken = subscription.metadata?.creditCardToken;

  const nextDueDate = new Date();
  nextDueDate.setDate(nextDueDate.getDate() + (newCycle === "YEARLY" ? 365 : 30));
  const nextDueDateStr = nextDueDate.toISOString().split("T")[0];

  const newSubPayload: Record<string, unknown> = {
    customer: account.asaas_customer_id,
    billingType: "CREDIT_CARD",
    cycle: newCycle,
    value: newValueReais,
    nextDueDate: nextDueDateStr,
    description: `${newPlanType} - ${newCycle === "YEARLY" ? "Anual" : "Mensal"}`,
    externalReference: userId,
  };

  if (creditCardToken) {
    newSubPayload.creditCardToken = creditCardToken;
  }

  const newSubRes = await fetch(`${ASAAS_BASE_URL}/v3/subscriptions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: ASAAS_API_KEY },
    body: JSON.stringify(newSubPayload),
  });

  const newSubData = await newSubRes.json();
  if (!newSubRes.ok) {
    console.error("Failed to create downgraded subscription:", newSubData);
    return;
  }

  await adminClient.from("subscriptions_asaas").insert({
    user_id: userId,
    asaas_customer_id: account.asaas_customer_id,
    asaas_subscription_id: newSubData.id,
    plan_type: newPlanType,
    billing_cycle: newCycle,
    status: newSubData.status || "ACTIVE",
    value_cents: newValueCents,
    next_due_date: newSubData.nextDueDate || nextDueDateStr,
    metadata: {
      creditCardToken: newSubData.creditCard?.creditCardToken || creditCardToken,
      downgraded_from: subscription.plan_type,
    },
  });

  const newLimit = STORAGE_LIMITS[newPlanType] || 0;

  const { data: storageData } = await adminClient.rpc("get_transfer_storage_bytes", {
    _user_id: userId,
  });
  const storageUsed = (storageData as number) || 0;

  if (storageUsed > newLimit) {
    console.log(`OVER LIMIT: ${storageUsed} bytes used, limit is ${newLimit} bytes.`);

    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 30);

    await adminClient
      .from("photographer_accounts")
      .update({
        account_over_limit: true,
        over_limit_since: new Date().toISOString(),
        deletion_scheduled_at: deletionDate.toISOString(),
      })
      .eq("user_id", userId);

    await adminClient
      .from("galerias")
      .update({ status: "expired_due_to_plan" })
      .eq("user_id", userId)
      .eq("tipo", "entrega")
      .in("status", ["enviado", "rascunho"]);

    console.log(`All Transfer galleries expired. Deletion scheduled for ${deletionDate.toISOString()}`);
  }

  console.log(`Downgrade complete: new subscription ${newSubData.id}, plan ${newPlanType}`);
}

async function checkAndLogEvent(
  adminClient: any,
  eventType: string,
  paymentId: string | null,
  installmentId: string | null,
  payload: any
): Promise<boolean> {
  if (!paymentId) return false; // no payment ID = can't dedup

  // Try insert with ON CONFLICT DO NOTHING
  const { data, error } = await adminClient
    .from("asaas_webhook_events")
    .insert({
      event_type: eventType,
      payment_id: paymentId,
      installment_id: installmentId,
      payload,
      processed: false,
    })
    .select("id, processed")
    .maybeSingle();

  if (error) {
    // Unique constraint violation = duplicate
    if (error.code === "23505") {
      // Check if already processed
      const { data: existing } = await adminClient
        .from("asaas_webhook_events")
        .select("processed")
        .eq("event_type", eventType)
        .eq("payment_id", paymentId)
        .maybeSingle();

      if (existing?.processed) {
        console.log(`⏭️ Event ${eventType}/${paymentId} already processed, skipping`);
        return true; // already processed
      }
      return false; // exists but not processed yet
    }
    console.error("Error logging webhook event:", error);
    return false;
  }

  return false; // new event, not yet processed
}

async function markEventProcessed(adminClient: any, eventType: string, paymentId: string) {
  await adminClient
    .from("asaas_webhook_events")
    .update({ processed: true })
    .eq("event_type", eventType)
    .eq("payment_id", paymentId);
}

async function findCobranca(adminClient: any, payment: any) {
  // Try by asaas_installment_id first (installment group)
  if (payment?.installment) {
    const { data } = await adminClient
      .from("cobrancas")
      .select("id, status, valor, total_parcelas, asaas_installment_id")
      .eq("asaas_installment_id", payment.installment)
      .maybeSingle();
    if (data) return data;
  }

  // Fallback: by mp_payment_id
  if (payment?.id) {
    const { data } = await adminClient
      .from("cobrancas")
      .select("id, status, valor, total_parcelas, asaas_installment_id")
      .eq("mp_payment_id", payment.id)
      .maybeSingle();
    if (data) return data;
  }

  return null;
}

async function upsertParcela(
  adminClient: any,
  cobrancaId: string,
  payment: any,
  status: string
) {
  const valorBruto = payment.value || 0;
  const valorLiquido = payment.netValue ?? null;
  const taxaGateway = valorLiquido != null ? Math.round((valorBruto - valorLiquido) * 100) / 100 : 0;

  const parcelaData: Record<string, unknown> = {
    cobranca_id: cobrancaId,
    numero_parcela: payment.installmentNumber || 1,
    asaas_payment_id: payment.id,
    valor_bruto: valorBruto,
    taxa_gateway: taxaGateway,
    valor_liquido: valorLiquido,
    status,
    billing_type: payment.billingType || null,
    data_vencimento: payment.dueDate || null,
    data_pagamento: payment.paymentDate || payment.confirmedDate || null,
    data_credito: payment.creditDate || null,
    antecipado: payment.anticipated || false,
    updated_at: new Date().toISOString(),
  };

  // Upsert by asaas_payment_id
  const { error } = await adminClient
    .from("cobranca_parcelas")
    .upsert(parcelaData, { onConflict: "asaas_payment_id" })
    .select()
    .maybeSingle();

  if (error) {
    console.error(`Error upserting parcela ${payment.id}:`, error);
    return false;
  }
  console.log(`✅ Parcela ${payment.id} → status=${status}, bruto=${valorBruto}, liquido=${valorLiquido}`);
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const event = body.event;
    const payment = body.payment;
    const subscription = body.subscription;

    console.log("Asaas webhook received:", event, JSON.stringify(body).slice(0, 500));

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Log webhook to webhook_logs
    await adminClient.from("webhook_logs").insert({
      provedor: "asaas",
      event_type: event,
      payload: body,
      headers: Object.fromEntries(req.headers.entries()),
    }).then(() => {}, (err: any) => console.error("Log insert error:", err));

    // ==========================================
    // PAYMENT EVENTS
    // ==========================================

    const PAYMENT_EVENTS = [
      "PAYMENT_CONFIRMED",
      "PAYMENT_RECEIVED",
      "PAYMENT_ANTICIPATED",
      "PAYMENT_REFUNDED",
      "PAYMENT_CHARGEBACK_REQUESTED",
      "PAYMENT_DELETED",
    ];

    if (PAYMENT_EVENTS.includes(event) && payment) {
      if (payment.subscription) {
        // --- SUBSCRIPTION PAYMENTS (unchanged logic) ---
        if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
          const { data: sub } = await adminClient
            .from("subscriptions_asaas")
            .select("*")
            .eq("asaas_subscription_id", payment.subscription)
            .single();

          const today = new Date();
          const cycleDays = sub?.billing_cycle === "YEARLY" ? 365 : 30;
          const nextPeriodEnd = new Date(today);
          nextPeriodEnd.setDate(nextPeriodEnd.getDate() + cycleDays);

          await adminClient
            .from("subscriptions_asaas")
            .update({
              status: "ACTIVE",
              next_due_date: nextPeriodEnd.toISOString().split("T")[0],
            })
            .eq("asaas_subscription_id", payment.subscription);

          console.log("Subscription activated:", payment.subscription);

          if (sub?.pending_downgrade_plan) {
            await applyDowngrade(adminClient, sub);
          }
        }
      } else {
        // --- NON-SUBSCRIPTION PAYMENTS (gestão/checkout charges) ---

        // Idempotency check
        const alreadyProcessed = await checkAndLogEvent(
          adminClient,
          event,
          payment.id,
          payment.installment || null,
          body
        );
        if (alreadyProcessed) {
          return new Response(JSON.stringify({ received: true, skipped: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Find the parent cobranca
        const cobranca = await findCobranca(adminClient, payment);

        if (!cobranca) {
          console.log(`ℹ️ No cobrança found for payment ${payment.id} (installment=${payment.installment})`);
        } else {
          let upsertSuccess = false;

          // Handle each event type
          if (event === "PAYMENT_CONFIRMED") {
            upsertSuccess = await upsertParcela(adminClient, cobranca.id, payment, "confirmado");
          } else if (event === "PAYMENT_RECEIVED") {
            upsertSuccess = await upsertParcela(adminClient, cobranca.id, payment, "recebido");
          } else if (event === "PAYMENT_ANTICIPATED") {
            // Update parcela with anticipation data
            const valorBruto = payment.value || 0;
            const valorLiquido = payment.netValue ?? null;
            const taxaGateway = valorLiquido != null ? Math.round((valorBruto - valorLiquido) * 100) / 100 : 0;

            const { data: existingParcela } = await adminClient
              .from("cobranca_parcelas")
              .select("taxa_gateway, valor_liquido")
              .eq("asaas_payment_id", payment.id)
              .maybeSingle();

            let taxaAntecipacao = 0;
            if (existingParcela && existingParcela.valor_liquido != null && valorLiquido != null) {
              taxaAntecipacao = Math.max(0, Math.round((existingParcela.valor_liquido - valorLiquido) * 100) / 100);
            }

            const { error } = await adminClient
              .from("cobranca_parcelas")
              .upsert({
                cobranca_id: cobranca.id,
                numero_parcela: payment.installmentNumber || 1,
                asaas_payment_id: payment.id,
                valor_bruto: valorBruto,
                taxa_gateway: existingParcela?.taxa_gateway ?? taxaGateway,
                taxa_antecipacao: taxaAntecipacao,
                valor_liquido: valorLiquido,
                status: "antecipado",
                billing_type: payment.billingType || null,
                data_vencimento: payment.dueDate || null,
                data_pagamento: payment.paymentDate || null,
                data_credito: payment.creditDate || null,
                antecipado: true,
                updated_at: new Date().toISOString(),
              }, { onConflict: "asaas_payment_id" })
              .select()
              .maybeSingle();

            if (error) {
              console.error(`Error upserting anticipated parcela:`, error);
            } else {
              console.log(`✅ Parcela ${payment.id} anticipated, taxa_antecipacao=${taxaAntecipacao}`);
              upsertSuccess = true;
            }
          } else if (event === "PAYMENT_REFUNDED" || event === "PAYMENT_CHARGEBACK_REQUESTED") {
            upsertSuccess = await upsertParcela(adminClient, cobranca.id, payment, "estornado");
          } else if (event === "PAYMENT_DELETED") {
            upsertSuccess = await upsertParcela(adminClient, cobranca.id, payment, "cancelado");
          }

          // Only mark as processed if upsert succeeded
          if (upsertSuccess && payment.id) {
            await markEventProcessed(adminClient, event, payment.id);
          }
        }
      }
    }

    // ==========================================
    // PAYMENT_OVERDUE (subscription only)
    // ==========================================
    if (event === "PAYMENT_OVERDUE") {
      if (payment?.subscription) {
        await adminClient
          .from("subscriptions_asaas")
          .update({ status: "OVERDUE" })
          .eq("asaas_subscription_id", payment.subscription);
        console.log("Subscription overdue:", payment.subscription);
      }
    }

    // ==========================================
    // SUBSCRIPTION EVENTS (unchanged)
    // ==========================================
    if (event === "SUBSCRIPTION_DELETED" || event === "SUBSCRIPTION_INACTIVATED") {
      const subId = subscription?.id || body.id;
      if (subId) {
        const { data: sub } = await adminClient
          .from("subscriptions_asaas")
          .select("*")
          .eq("asaas_subscription_id", subId)
          .single();

        await adminClient
          .from("subscriptions_asaas")
          .update({ status: "CANCELLED" })
          .eq("asaas_subscription_id", subId);

        console.log("Subscription cancelled:", subId);

        if (sub) {
          const subCredits = PLAN_SUBSCRIPTION_CREDITS[sub.plan_type];
          if (subCredits && subCredits > 0) {
            const { error: expireError } = await adminClient.rpc("expire_subscription_credits", {
              _user_id: sub.user_id,
            });
            if (expireError) {
              console.error("Failed to expire subscription credits:", expireError);
            } else {
              console.log(`Expired subscription credits for user ${sub.user_id}`);
            }
          }
        }
      }
    }

    if (event === "SUBSCRIPTION_RENEWED") {
      const subId = subscription?.id || body.id;
      if (subId) {
        const { data: sub } = await adminClient
          .from("subscriptions_asaas")
          .select("*")
          .eq("asaas_subscription_id", subId)
          .single();

        const cycleDays = sub?.billing_cycle === "YEARLY" ? 365 : 30;
        const nextPeriodEnd = new Date();
        nextPeriodEnd.setDate(nextPeriodEnd.getDate() + cycleDays);

        await adminClient
          .from("subscriptions_asaas")
          .update({
            status: "ACTIVE",
            next_due_date: nextPeriodEnd.toISOString().split("T")[0],
          })
          .eq("asaas_subscription_id", subId);

        console.log("Subscription renewed:", subId);

        if (sub) {
          const subCredits = PLAN_SUBSCRIPTION_CREDITS[sub.plan_type];
          if (subCredits && subCredits > 0) {
            const { error: creditError } = await adminClient.rpc("renew_subscription_credits", {
              _user_id: sub.user_id,
              _amount: subCredits,
            });
            if (creditError) {
              console.error("Failed to renew subscription credits:", creditError);
            } else {
              console.log(`Renewed ${subCredits} subscription credits for user ${sub.user_id}`);
            }
          }

          if (sub.pending_downgrade_plan) {
            await applyDowngrade(adminClient, sub);
          }
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
