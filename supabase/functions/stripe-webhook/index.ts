import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get the signature from headers
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      logStep("ERROR: No stripe-signature header");
      return new Response(JSON.stringify({ error: "No signature" }), { status: 400 });
    }

    // Get raw body for signature verification
    const body = await req.text();
    
    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
      logStep("Webhook signature verified", { eventType: event.type });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logStep("ERROR: Webhook signature verification failed", { error: errorMessage });
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
    }

    logStep("Event received", { type: event.type, id: event.id });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Checkout completed", { 
          sessionId: session.id, 
          customerId: session.customer,
          subscriptionId: session.subscription,
          customerEmail: session.customer_email
        });

        // Try to get user_id from metadata first
        let userId = session.metadata?.user_id;
        const planCode = session.metadata?.plan_code;
        
        // If no user_id in metadata, find user by email
        if (!userId && session.customer_email) {
          logStep("No user_id in metadata, searching by email", { email: session.customer_email });
          
          const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
          
          if (!authError && authUsers?.users) {
            const matchedUser = authUsers.users.find(u => u.email === session.customer_email);
            if (matchedUser) {
              userId = matchedUser.id;
              logStep("Found user by email", { userId, email: session.customer_email });
            }
          }
        }
        
        if (!userId) {
          logStep("ERROR: Could not find user for checkout session", { 
            customerEmail: session.customer_email 
          });
          break;
        }

        // Get plan from database
        let planId: string | null = null;
        
        if (planCode) {
          const { data: plan } = await supabaseAdmin
            .from("plans")
            .select("id")
            .eq("code", planCode)
            .single();
          
          if (plan) {
            planId = plan.id;
          }
        }
        
        // If no plan found by code, try to match by price_id from Stripe
        if (!planId && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          const priceId = subscription.items.data[0]?.price?.id;
          
          if (priceId) {
            const { data: plan } = await supabaseAdmin
              .from("plans")
              .select("id")
              .eq("stripe_price_id", priceId)
              .single();
            
            if (plan) {
              planId = plan.id;
              logStep("Found plan by price_id", { priceId, planId });
            }
          }
        }
        
        // Fallback to pro_monthly if no plan found
        if (!planId) {
          const { data: fallbackPlan } = await supabaseAdmin
            .from("plans")
            .select("id")
            .eq("code", "pro_monthly")
            .single();
          
          if (fallbackPlan) {
            planId = fallbackPlan.id;
            logStep("Using fallback plan pro_monthly", { planId });
          }
        }

        if (!planId) {
          logStep("ERROR: No plan found", { planCode });
          break;
        }

        // Get subscription details from Stripe
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

        // Update or insert subscription
        const { error: upsertError } = await supabaseAdmin
          .from("subscriptions")
          .upsert({
            user_id: userId,
            plan_id: planId,
            status: subscription.status,
            stripe_subscription_id: subscription.id,
            stripe_customer_id: session.customer as string,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });

        if (upsertError) {
          logStep("Error upserting subscription", { error: upsertError });
        } else {
          logStep("Subscription updated successfully", { 
            userId, 
            status: subscription.status,
            stripeSubscriptionId: subscription.id,
            stripeCustomerId: session.customer 
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription updated", { 
          subscriptionId: subscription.id, 
          status: subscription.status 
        });

        const { error } = await supabaseAdmin
          .from("subscriptions")
          .update({
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);

        if (error) {
          logStep("Error updating subscription", { error });
        } else {
          logStep("Subscription status updated");
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription deleted", { subscriptionId: subscription.id });

        const { error } = await supabaseAdmin
          .from("subscriptions")
          .update({
            status: "canceled",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);

        if (error) {
          logStep("Error marking subscription as canceled", { error });
        } else {
          logStep("Subscription marked as canceled");
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Invoice paid", { invoiceId: invoice.id, subscriptionId: invoice.subscription });

        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
          
          const { error } = await supabaseAdmin
            .from("subscriptions")
            .update({
              status: subscription.status,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_subscription_id", subscription.id);

          if (error) {
            logStep("Error updating subscription after invoice paid", { error });
          } else {
            logStep("Subscription updated after invoice paid");
          }
        }
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in stripe-webhook", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
