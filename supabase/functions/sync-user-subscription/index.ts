import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const timestamp = new Date().toISOString();
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[${timestamp}] [SYNC-USER-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Plan hierarchy: higher value = higher priority
const PLAN_PRIORITY: Record<string, number> = {
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("=== SYNC USER SUBSCRIPTION STARTED ===");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get all plans from database for mapping
    const { data: plans, error: plansError } = await supabaseAdmin
      .from("plans")
      .select("id, code, stripe_price_id, price_cents");
    
    if (plansError || !plans) {
      throw new Error("Failed to fetch plans from database");
    }
    
    logStep("Plans loaded", { count: plans.length });

    // Find Stripe customer by email
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No Stripe customer found for this email");
      return new Response(JSON.stringify({ 
        synced: false, 
        message: "No Stripe customer found",
        hasStripeCustomer: false
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Stripe customer found", { customerId });

    // Get all subscriptions for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 100,
    });

    logStep("Found subscriptions in Stripe", { 
      total: subscriptions.data.length,
      statuses: subscriptions.data.map(s => ({ id: s.id, status: s.status }))
    });

    // Filter to active/trialing subscriptions
    const activeSubscriptions = subscriptions.data.filter(
      s => s.status === 'active' || s.status === 'trialing'
    );

    logStep("Active subscriptions", { count: activeSubscriptions.length });

    if (activeSubscriptions.length === 0) {
      // No active subscriptions - check if we need to mark local as canceled
      const { data: localSub } = await supabaseAdmin
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .single();
      
      if (localSub && localSub.stripe_subscription_id && localSub.status !== 'canceled') {
        await supabaseAdmin
          .from("subscriptions")
          .update({ status: 'canceled', updated_at: new Date().toISOString() })
          .eq("user_id", user.id);
        
        logStep("Marked local subscription as canceled (no active in Stripe)");
      }
      
      return new Response(JSON.stringify({ 
        synced: true, 
        message: "No active subscriptions in Stripe",
        hasActiveSubscription: false
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // If multiple active subscriptions, determine the highest priority one
    let bestSubscription = activeSubscriptions[0];
    let bestPriority = 0;
    let bestPlan: any = null;

    for (const sub of activeSubscriptions) {
      const priceId = sub.items.data[0]?.price?.id;
      const plan = plans.find(p => p.stripe_price_id === priceId);
      
      if (plan) {
        const priority = PLAN_PRIORITY[plan.code] || 0;
        logStep("Evaluating subscription", { 
          subId: sub.id, 
          priceId, 
          planCode: plan.code, 
          priority,
          status: sub.status
        });
        
        if (priority > bestPriority) {
          bestPriority = priority;
          bestSubscription = sub;
          bestPlan = plan;
        }
      }
    }

    logStep("Best subscription determined", { 
      subId: bestSubscription.id,
      planCode: bestPlan?.code,
      priority: bestPriority
    });

    // Cancel all other active subscriptions in Stripe
    const subscriptionsToCancel = activeSubscriptions.filter(s => s.id !== bestSubscription.id);
    
    for (const sub of subscriptionsToCancel) {
      try {
        await stripe.subscriptions.cancel(sub.id);
        logStep("✓ Cancelled duplicate subscription", { subId: sub.id });
      } catch (cancelError) {
        logStep("Error cancelling subscription", { 
          subId: sub.id,
          error: cancelError instanceof Error ? cancelError.message : String(cancelError)
        });
      }
    }

    // Update local database with the best subscription
    // Use safe timestamp conversion to prevent "Invalid time value" errors
    const subscriptionData = {
      user_id: user.id,
      plan_id: bestPlan?.id,
      status: bestSubscription.status,
      stripe_subscription_id: bestSubscription.id,
      stripe_customer_id: customerId,
      current_period_start: safeTimestampToISO(bestSubscription.current_period_start, 0),
      current_period_end: safeTimestampToISO(bestSubscription.current_period_end, 30),
      cancel_at_period_end: bestSubscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    };

    logStep("Upserting subscription to database", subscriptionData);

    const { error: upsertError } = await supabaseAdmin
      .from("subscriptions")
      .upsert(subscriptionData, { onConflict: "user_id" });

    if (upsertError) {
      logStep("ERROR upserting subscription", { error: upsertError });
      throw new Error(`Failed to update subscription: ${upsertError.message}`);
    }

    logStep("=== SYNC COMPLETED SUCCESSFULLY ===");

    return new Response(JSON.stringify({ 
      synced: true,
      subscription: {
        stripeSubscriptionId: bestSubscription.id,
        status: bestSubscription.status,
        planCode: bestPlan?.code,
        currentPeriodEnd: safeTimestampToISO(bestSubscription.current_period_end, 30),
      },
      cancelledDuplicates: subscriptionsToCancel.length,
      message: `Synced to ${bestPlan?.code} plan, cancelled ${subscriptionsToCancel.length} duplicate(s)`
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("=== ERROR in sync-user-subscription ===", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
