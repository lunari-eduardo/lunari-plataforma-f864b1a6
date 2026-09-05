import { getPlatformAsaasConfig } from "../../_shared/platform-asaas.ts";
import {
  STORAGE_LIMITS,
  PLAN_SUBSCRIPTION_CREDITS,
  PLAN_PRICES,
  checkAndLogEvent,
  markEventProcessed,
} from "../types.ts";

export async function applyDowngrade(adminClient: any, subscription: any) {
  const newPlanType = subscription.pending_downgrade_plan;
  const newCycle = subscription.pending_downgrade_cycle || subscription.billing_cycle;

  if (!newPlanType) return;

  console.log(`Applying scheduled downgrade: ${subscription.plan_type} → ${newPlanType}`);

  const platformCfg = await getPlatformAsaasConfig(adminClient);
  if (!platformCfg) {
    console.error("Platform Asaas integration not configured, cannot apply downgrade");
    return;
  }
  const ASAAS_API_KEY = platformCfg.apiKey;
  const ASAAS_BASE_URL = platformCfg.baseUrl;

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

export async function handleSubscriptionPayment(adminClient: any, payment: any) {
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

export async function handleSubscriptionOverdue(adminClient: any, payment: any) {
  if (payment?.subscription) {
    await adminClient
      .from("subscriptions_asaas")
      .update({ status: "OVERDUE" })
      .eq("asaas_subscription_id", payment.subscription);
    console.log("Subscription overdue:", payment.subscription);
  }
}

export async function handleSubscriptionDeleted(adminClient: any, subscription: any, body: any) {
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

export async function handleSubscriptionRenewed(adminClient: any, subscription: any, body: any) {
  const subId = subscription?.id || body.id;
  if (subId) {
    const alreadyProcessed = await checkAndLogEvent(
      adminClient,
      "SUBSCRIPTION_RENEWED",
      body.id || `sub_renew_${subId}_${new Date().toISOString().slice(0, 10)}`,
      body
    );

    if (!alreadyProcessed) {
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

      await markEventProcessed(adminClient, body.id || `sub_renew_${subId}_${new Date().toISOString().slice(0, 10)}`);
    }
  }
}
