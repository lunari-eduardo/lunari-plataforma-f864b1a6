import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLAN_PRICES: Record<string, { monthly: number; yearly: number }> = {
  studio_starter: { monthly: 1490, yearly: 15198 },
  studio_pro: { monthly: 3590, yearly: 36618 },
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

  console.log(`Applying downgrade: ${subscription.plan_type} → ${newPlanType}`);

  const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
  if (!ASAAS_API_KEY) return;

  const userId = subscription.user_id;

  if (subscription.asaas_subscription_id) {
    await fetch(
      `${ASAAS_BASE_URL}/v3/subscriptions/${subscription.asaas_subscription_id}`,
      { method: "DELETE", headers: { access_token: ASAAS_API_KEY } }
    );
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

  if (!account?.asaas_customer_id) return;

  const newPrices = PLAN_PRICES[newPlanType];
  if (!newPrices) return;
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

  console.log(`Downgrade complete: ${newSubData.id}, plan ${newPlanType}`);
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

    console.log("Asaas webhook received:", event);

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Payment confirmed
    if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
      if (payment?.subscription) {
        await adminClient
          .from("subscriptions_asaas")
          .update({ status: "ACTIVE", next_due_date: payment.dueDate })
          .eq("asaas_subscription_id", payment.subscription);

        const { data: sub } = await adminClient
          .from("subscriptions_asaas")
          .select("*")
          .eq("asaas_subscription_id", payment.subscription)
          .single();

        if (sub?.pending_downgrade_plan) {
          await applyDowngrade(adminClient, sub);
        }
      }
    }

    if (event === "PAYMENT_OVERDUE") {
      if (payment?.subscription) {
        await adminClient
          .from("subscriptions_asaas")
          .update({ status: "OVERDUE" })
          .eq("asaas_subscription_id", payment.subscription);
      }
    }

    if (event === "SUBSCRIPTION_DELETED" || event === "SUBSCRIPTION_INACTIVATED") {
      const subId = subscription?.id || body.id;
      if (subId) {
        await adminClient
          .from("subscriptions_asaas")
          .update({ status: "CANCELLED" })
          .eq("asaas_subscription_id", subId);
      }
    }

    if (event === "SUBSCRIPTION_RENEWED") {
      const subId = subscription?.id || body.id;
      if (subId) {
        await adminClient
          .from("subscriptions_asaas")
          .update({ status: "ACTIVE" })
          .eq("asaas_subscription_id", subId);

        const { data: sub } = await adminClient
          .from("subscriptions_asaas")
          .select("*")
          .eq("asaas_subscription_id", subId)
          .single();

        if (sub?.pending_downgrade_plan) {
          await applyDowngrade(adminClient, sub);
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