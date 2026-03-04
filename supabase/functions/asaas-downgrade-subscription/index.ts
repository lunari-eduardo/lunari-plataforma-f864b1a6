import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { subscriptionId, newPlanType, newBillingCycle } = await req.json();

    if (!subscriptionId || !newPlanType) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: subscriptionId, newPlanType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch plan from unified_plans (single source of truth)
    const { data: newPlan, error: planError } = await adminClient
      .from("unified_plans")
      .select("code, name, monthly_price_cents, yearly_price_cents, is_active")
      .eq("code", newPlanType)
      .eq("is_active", true)
      .single();

    if (planError || !newPlan) {
      return new Response(
        JSON.stringify({ error: "Invalid plan type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch current subscription
    const { data: currentSub, error: subError } = await adminClient
      .from("subscriptions_asaas")
      .select("*")
      .eq("id", subscriptionId)
      .eq("user_id", user.id)
      .in("status", ["ACTIVE", "PENDING", "OVERDUE"])
      .single();

    if (subError || !currentSub) {
      return new Response(
        JSON.stringify({ error: "Active subscription not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch current plan pricing from DB
    const { data: currentPlan } = await adminClient
      .from("unified_plans")
      .select("monthly_price_cents")
      .eq("code", currentSub.plan_type)
      .eq("is_active", true)
      .single();

    const currentMonthly = currentPlan?.monthly_price_cents ?? 0;
    const newMonthly = newPlan.monthly_price_cents;

    if (newMonthly >= currentMonthly) {
      return new Response(
        JSON.stringify({ error: "New plan must be cheaper than current plan for downgrade" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save pending downgrade
    const { error: updateError } = await adminClient
      .from("subscriptions_asaas")
      .update({
        pending_downgrade_plan: newPlanType,
        pending_downgrade_cycle: newBillingCycle || currentSub.billing_cycle,
      })
      .eq("id", subscriptionId);

    if (updateError) {
      console.error("Error scheduling downgrade:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to schedule downgrade" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Downgrade scheduled: ${currentSub.plan_type} → ${newPlanType} for subscription ${subscriptionId}`);

    return new Response(
      JSON.stringify({
        success: true,
        currentPlan: currentSub.plan_type,
        scheduledPlan: newPlanType,
        scheduledCycle: newBillingCycle || currentSub.billing_cycle,
        message: "Downgrade agendado para o próximo ciclo de cobrança.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
