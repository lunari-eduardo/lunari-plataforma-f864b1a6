import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: any) => {
  const timestamp = new Date().toISOString();
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[${timestamp}] [STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

// Plan hierarchy: higher price = higher priority
const PLAN_HIERARCHY: Record<string, number> = {
  'pro_yearly': 4,
  'pro_monthly': 3,
  'starter_yearly': 2,
  'starter_monthly': 1,
};

// Helper function to safely convert Stripe timestamps to ISO strings
const safeTimestampToISO = (timestamp: number | null | undefined, fallbackDays: number = 0): string => {
  if (timestamp && typeof timestamp === 'number' && timestamp > 0) {
    try {
      return new Date(timestamp * 1000).toISOString();
    } catch (e) {
      logStep("WARNING: Invalid timestamp, using fallback", { timestamp, error: String(e) });
    }
  }
  // Fallback: current date + fallbackDays
  const fallbackDate = new Date();
  if (fallbackDays > 0) {
    fallbackDate.setDate(fallbackDate.getDate() + fallbackDays);
  }
  return fallbackDate.toISOString();
};

serve(async (req) => {
  try {
    logStep("=== WEBHOOK RECEIVED ===");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey) {
      logStep("ERROR: STRIPE_SECRET_KEY is not set");
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    if (!webhookSecret) {
      logStep("ERROR: STRIPE_WEBHOOK_SECRET is not set");
      throw new Error("STRIPE_WEBHOOK_SECRET is not set");
    }
    
    logStep("Environment variables verified");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get the signature from headers
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      logStep("ERROR: No stripe-signature header found");
      return new Response(JSON.stringify({ error: "No signature" }), { status: 400 });
    }

    // Get raw body for signature verification
    const body = await req.text();
    logStep("Request body received", { bodyLength: body.length });
    
    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
      logStep("✓ Webhook signature VERIFIED", { eventType: event.type, eventId: event.id });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logStep("ERROR: Webhook signature verification FAILED", { error: errorMessage });
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
    }

    logStep("Processing event", { type: event.type, id: event.id });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("=== CHECKOUT SESSION COMPLETED ===", { 
          sessionId: session.id, 
          customerId: session.customer,
          subscriptionId: session.subscription,
          customerEmail: session.customer_email,
          metadata: session.metadata
        });

        // Try to get user_id from metadata first
        let userId = session.metadata?.user_id;
        const planCode = session.metadata?.plan_code;
        
        // If no user_id in metadata, find user by email
        if (!userId && session.customer_email) {
          logStep("No user_id in metadata, searching by email", { email: session.customer_email });
          
          const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
          
          if (authError) {
            logStep("Error listing users", { error: authError.message });
          } else if (authUsers?.users) {
            const matchedUser = authUsers.users.find(u => u.email === session.customer_email);
            if (matchedUser) {
              userId = matchedUser.id;
              logStep("✓ Found user by email", { userId, email: session.customer_email });
            }
          }
        }
        
        if (!userId) {
          logStep("ERROR: Could not find user for checkout session", { 
            customerEmail: session.customer_email,
            metadata: session.metadata
          });
          break;
        }

        // Get subscription details from Stripe
        const newSubscription = await stripe.subscriptions.retrieve(session.subscription as string);
        const newPriceId = newSubscription.items.data[0]?.price?.id;
        
        logStep("New subscription details", {
          subscriptionId: newSubscription.id,
          status: newSubscription.status,
          priceId: newPriceId,
          currentPeriodStart: newSubscription.current_period_start,
          currentPeriodEnd: newSubscription.current_period_end
        });

        // ========================================
        // CRITICAL: Cancel any previous active subscriptions for this customer
        // ========================================
        if (session.customer) {
          logStep("Checking for previous subscriptions to cancel...");
          
          const allSubscriptions = await stripe.subscriptions.list({
            customer: session.customer as string,
            status: 'active',
          });
          
          logStep("Found active subscriptions", { count: allSubscriptions.data.length });
          
          for (const sub of allSubscriptions.data) {
            if (sub.id !== newSubscription.id) {
              try {
                await stripe.subscriptions.cancel(sub.id);
                logStep("✓ CANCELLED previous subscription", { 
                  cancelledId: sub.id,
                  cancelledPriceId: sub.items.data[0]?.price?.id
                });
                
                // Also mark as canceled in our database
                await supabaseAdmin
                  .from("subscriptions")
                  .update({ 
                    status: "canceled",
                    updated_at: new Date().toISOString()
                  })
                  .eq("stripe_subscription_id", sub.id);
                  
              } catch (cancelError) {
                logStep("Error cancelling subscription", { 
                  subId: sub.id, 
                  error: cancelError instanceof Error ? cancelError.message : String(cancelError)
                });
              }
            }
          }
        }

        // Get plan from database by price_id (most reliable)
        let planId: string | null = null;
        let resolvedPlanCode: string | null = planCode || null;
        
        if (newPriceId) {
          const { data: plan, error: planError } = await supabaseAdmin
            .from("plans")
            .select("id, code")
            .eq("stripe_price_id", newPriceId)
            .single();
          
          if (plan) {
            planId = plan.id;
            resolvedPlanCode = plan.code;
            logStep("✓ Found plan by stripe_price_id", { priceId: newPriceId, planId, planCode: plan.code });
          } else {
            logStep("Plan not found by price_id", { priceId: newPriceId, error: planError });
          }
        }
        
        // Fallback: try by plan_code from metadata
        if (!planId && planCode) {
          const { data: plan } = await supabaseAdmin
            .from("plans")
            .select("id")
            .eq("code", planCode)
            .single();
          
          if (plan) {
            planId = plan.id;
            logStep("Found plan by metadata code", { planCode, planId });
          }
        }
        
        // Last resort fallback to pro_monthly
        if (!planId) {
          const { data: fallbackPlan } = await supabaseAdmin
            .from("plans")
            .select("id, code")
            .eq("code", "pro_monthly")
            .single();
          
          if (fallbackPlan) {
            planId = fallbackPlan.id;
            resolvedPlanCode = fallbackPlan.code;
            logStep("WARNING: Using fallback plan pro_monthly", { planId });
          }
        }

        if (!planId) {
          logStep("ERROR: No plan found - cannot update subscription");
          break;
        }

        // Update or insert subscription with ACTIVE status (not trialing!)
        // Use safe timestamp conversion to prevent "Invalid time value" errors
        const subscriptionData = {
          user_id: userId,
          plan_id: planId,
          status: newSubscription.status, // Should be 'active' for paid subscriptions
          stripe_subscription_id: newSubscription.id,
          stripe_customer_id: session.customer as string,
          current_period_start: safeTimestampToISO(newSubscription.current_period_start, 0),
          current_period_end: safeTimestampToISO(newSubscription.current_period_end, 30),
          cancel_at_period_end: newSubscription.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        };
        
        logStep("Saving subscription data", subscriptionData);

        // Use SELECT + UPDATE/INSERT pattern (more reliable than upsert)
        const { data: existingSub } = await supabaseAdmin
          .from("subscriptions")
          .select("id")
          .eq("user_id", userId)
          .single();

        let saveError;
        if (existingSub) {
          // UPDATE existing subscription
          const { error: updateError } = await supabaseAdmin
            .from("subscriptions")
            .update(subscriptionData)
            .eq("user_id", userId);
          saveError = updateError;
          logStep("Performed UPDATE on existing subscription");
        } else {
          // INSERT new subscription
          const { error: insertError } = await supabaseAdmin
            .from("subscriptions")
            .insert(subscriptionData);
          saveError = insertError;
          logStep("Performed INSERT for new subscription");
        }

        if (saveError) {
          logStep("ERROR saving subscription", { error: saveError });
        } else {
          logStep("✓ SUBSCRIPTION SAVED SUCCESSFULLY", { 
            userId, 
            planCode: resolvedPlanCode,
            status: newSubscription.status,
            stripeSubscriptionId: newSubscription.id
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const priceId = subscription.items.data[0]?.price?.id;
        
        logStep("=== SUBSCRIPTION UPDATED ===", { 
          subscriptionId: subscription.id, 
          status: subscription.status,
          priceId,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          currentPeriodStart: subscription.current_period_start,
          currentPeriodEnd: subscription.current_period_end
        });

        // Get current plan_id from price_id (for plan changes/upgrades)
        let planId: string | null = null;
        if (priceId) {
          const { data: plan } = await supabaseAdmin
            .from("plans")
            .select("id, code")
            .eq("stripe_price_id", priceId)
            .single();
          
          if (plan) {
            planId = plan.id;
            logStep("Found plan for update", { priceId, planId, planCode: plan.code });
          }
        }

        // Use safe timestamp conversion
        const updateData: Record<string, any> = {
          status: subscription.status,
          current_period_start: safeTimestampToISO(subscription.current_period_start, 0),
          current_period_end: safeTimestampToISO(subscription.current_period_end, 30),
          cancel_at_period_end: subscription.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        };
        
        // IMPORTANT: Update plan_id if we found one (handles upgrades/downgrades)
        if (planId) {
          updateData.plan_id = planId;
          logStep("Including plan_id in update", { planId });
        }

        const { error } = await supabaseAdmin
          .from("subscriptions")
          .update(updateData)
          .eq("stripe_subscription_id", subscription.id);

        if (error) {
          logStep("ERROR updating subscription", { error });
        } else {
          logStep("✓ Subscription updated", { 
            subscriptionId: subscription.id,
            status: subscription.status,
            planId
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("=== SUBSCRIPTION DELETED ===", { subscriptionId: subscription.id });

        const { error } = await supabaseAdmin
          .from("subscriptions")
          .update({
            status: "canceled",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);

        if (error) {
          logStep("ERROR marking subscription as canceled", { error });
        } else {
          logStep("✓ Subscription marked as canceled");
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("=== INVOICE PAID ===", { 
          invoiceId: invoice.id, 
          subscriptionId: invoice.subscription,
          amountPaid: invoice.amount_paid
        });

        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
          const priceId = subscription.items.data[0]?.price?.id;
          
          logStep("Invoice subscription details", {
            subscriptionId: subscription.id,
            status: subscription.status,
            currentPeriodStart: subscription.current_period_start,
            currentPeriodEnd: subscription.current_period_end
          });
          
          // Get plan_id for the subscription
          let planId: string | null = null;
          if (priceId) {
            const { data: plan } = await supabaseAdmin
              .from("plans")
              .select("id")
              .eq("stripe_price_id", priceId)
              .single();
            
            if (plan) planId = plan.id;
          }
          
          // Use safe timestamp conversion
          const updateData: Record<string, any> = {
            status: subscription.status,
            current_period_start: safeTimestampToISO(subscription.current_period_start, 0),
            current_period_end: safeTimestampToISO(subscription.current_period_end, 30),
            updated_at: new Date().toISOString(),
          };
          
          if (planId) {
            updateData.plan_id = planId;
          }

          const { error } = await supabaseAdmin
            .from("subscriptions")
            .update(updateData)
            .eq("stripe_subscription_id", subscription.id);

          if (error) {
            logStep("ERROR updating subscription after invoice paid", { error });
          } else {
            logStep("✓ Subscription updated after invoice paid", {
              subscriptionId: subscription.id,
              status: subscription.status,
              planId
            });
          }
        }
        break;
      }

      default:
        logStep("Unhandled event type (ignored)", { type: event.type });
    }

    logStep("=== WEBHOOK PROCESSING COMPLETE ===");
    
    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("=== FATAL ERROR in stripe-webhook ===", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
