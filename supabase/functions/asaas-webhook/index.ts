// ⚠️ PLATAFORMA LUNARI — webhook das assinaturas Lunari e cobranças de fotógrafos.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "./types.ts";
import {
  handleSubscriptionPayment,
  handleSubscriptionOverdue,
  handleSubscriptionDeleted,
  handleSubscriptionRenewed,
} from "./handlers/platformSubscriptionEvents.ts";
import {
  handlePhotographerPayment,
  handleAnticipationEvent,
} from "./handlers/photographerPaymentEvents.ts";

const PAYMENT_EVENTS = [
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
  "PAYMENT_ANTICIPATED",
  "PAYMENT_REFUNDED",
  "PAYMENT_PARTIALLY_REFUNDED",
  "PAYMENT_CHARGEBACK_REQUESTED",
  "PAYMENT_CHARGEBACK_DISPUTE",
  "PAYMENT_DELETED",
];

const ANTICIPATION_EVENTS = [
  "RECEIVABLE_ANTICIPATION_PENDING",
  "RECEIVABLE_ANTICIPATION_SCHEDULED",
  "RECEIVABLE_ANTICIPATION_AUTHORIZED",
  "RECEIVABLE_ANTICIPATION_CREDITED",
  "RECEIVABLE_ANTICIPATION_DENIED",
  "RECEIVABLE_ANTICIPATION_CANCELLED",
  "RECEIVABLE_ANTICIPATION_DEBITED",
  "RECEIVABLE_ANTICIPATION_OVERDUE",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const asaasWebhookSecret = Deno.env.get("ASAAS_WEBHOOK_SECRET");
    const receivedToken = req.headers.get("asaas-access-token");
    if (asaasWebhookSecret && receivedToken && receivedToken !== asaasWebhookSecret) {
      console.warn("[asaas-webhook] Rejeitado: cabeçalho asaas-access-token inválido.");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      payload: body,
      headers: Object.fromEntries(req.headers.entries()),
    }).then(() => {}, (err: any) => console.error("Log insert error:", err));

    // 1. PAYMENT EVENTS
    if (PAYMENT_EVENTS.includes(event) && payment) {
      if (payment.subscription) {
        if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
          await handleSubscriptionPayment(adminClient, payment);
        }
      } else {
        const result = await handlePhotographerPayment(adminClient, body, payment, event);
        if (result.skipped) {
          return new Response(JSON.stringify({ received: true, skipped: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (!result.success) {
          return new Response(
            JSON.stringify({
              received: false,
              error: result.error,
              paymentId: payment.id,
              event,
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // 2. ANTICIPATION EVENTS
    if (ANTICIPATION_EVENTS.includes(event) && body.anticipation) {
      const result = await handleAnticipationEvent(adminClient, body, event);
      if (result.skipped) {
        return new Response(JSON.stringify({ received: true, skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 3. PAYMENT_OVERDUE
    if (event === "PAYMENT_OVERDUE") {
      await handleSubscriptionOverdue(adminClient, payment);
    }

    // 4. SUBSCRIPTION DELETED / INACTIVATED
    if (event === "SUBSCRIPTION_DELETED" || event === "SUBSCRIPTION_INACTIVATED") {
      await handleSubscriptionDeleted(adminClient, subscription, body);
    }

    // 5. SUBSCRIPTION RENEWED
    if (event === "SUBSCRIPTION_RENEWED") {
      await handleSubscriptionRenewed(adminClient, subscription, body);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const err = error as Error;
    console.error("Webhook error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
