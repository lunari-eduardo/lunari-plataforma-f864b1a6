// Unified edge function — reads plan pricing from unified_plans table (single source of truth).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASAAS_BASE_URL = Deno.env.get("ASAAS_ENV") === "production"
  ? "https://api.asaas.com"
  : "https://api-sandbox.asaas.com";

function getNextBusinessDay(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const day = date.getDay();
  if (day === 0) date.setDate(date.getDate() + 1);
  if (day === 6) date.setDate(date.getDate() + 2);
  return date.toISOString().split("T")[0];
}

// ─── Coupon validation helper ───
async function validateAndApplyCoupon(
  adminClient: any,
  couponCode: string | undefined,
  planCode: string,
  productFamily: string,
  originalCents: number
): Promise<{ finalCents: number; couponId: string | null; discountCents: number }> {
  if (!couponCode) return { finalCents: originalCents, couponId: null, discountCents: 0 };

  const { data: coupon, error } = await adminClient
    .from("coupons")
    .select("*")
    .eq("code", couponCode.trim().toUpperCase())
    .eq("is_active", true)
    .single();

  if (error || !coupon) {
    console.log("Coupon not found or inactive:", couponCode);
    return { finalCents: originalCents, couponId: null, discountCents: 0 };
  }

  const now = new Date();
  if (coupon.valid_from && new Date(coupon.valid_from) > now) {
    return { finalCents: originalCents, couponId: null, discountCents: 0 };
  }
  if (coupon.valid_until && new Date(coupon.valid_until) < now) {
    return { finalCents: originalCents, couponId: null, discountCents: 0 };
  }
  if (coupon.max_uses !== null && coupon.current_uses >= coupon.max_uses) {
    return { finalCents: originalCents, couponId: null, discountCents: 0 };
  }
  if (coupon.applies_to !== "all" && coupon.applies_to !== productFamily) {
    return { finalCents: originalCents, couponId: null, discountCents: 0 };
  }
  if (coupon.plan_codes && coupon.plan_codes.length > 0 && !coupon.plan_codes.includes(planCode)) {
    return { finalCents: originalCents, couponId: null, discountCents: 0 };
  }

  let discountCents = 0;
  if (coupon.discount_type === "percentage") {
    discountCents = Math.round(originalCents * (coupon.discount_value / 100));
  } else {
    discountCents = Math.min(coupon.discount_value, originalCents);
  }

  const finalCents = Math.max(0, originalCents - discountCents);
  return { finalCents, couponId: coupon.id, discountCents };
}

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

    const userId = user.id;
    const { planType, billingCycle, creditCard, creditCardHolderInfo, remoteIp, couponCode } = await req.json();

    if (!["MONTHLY", "YEARLY"].includes(billingCycle)) {
      return new Response(
        JSON.stringify({ error: "Invalid billing cycle" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate credit card data
    if (!creditCard?.number || !creditCard?.holderName || !creditCard?.expiryMonth || !creditCard?.expiryYear || !creditCard?.ccv) {
      return new Response(
        JSON.stringify({ error: "Dados do cartão incompletos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!creditCardHolderInfo?.name || !creditCardHolderInfo?.cpfCnpj || !creditCardHolderInfo?.postalCode || !creditCardHolderInfo?.phone) {
      return new Response(
        JSON.stringify({ error: "Dados do titular incompletos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    if (!ASAAS_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ASAAS_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch plan from unified_plans (single source of truth)
    const { data: plan, error: planError } = await adminClient
      .from("unified_plans")
      .select("code, name, monthly_price_cents, yearly_price_cents, is_active, select_credits_monthly, product_family")
      .eq("code", planType)
      .eq("is_active", true)
      .single();

    if (planError || !plan) {
      return new Response(
        JSON.stringify({ error: "Invalid plan type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get customer ID
    const { data: account } = await adminClient
      .from("photographer_accounts")
      .select("asaas_customer_id")
      .eq("user_id", userId)
      .single();

    if (!account?.asaas_customer_id) {
      return new Response(
        JSON.stringify({ error: "Customer not found. Create customer first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for existing active subscription of same plan type
    const { data: existing } = await adminClient
      .from("subscriptions_asaas")
      .select("id")
      .eq("user_id", userId)
      .eq("plan_type", planType)
      .in("status", ["ACTIVE", "PENDING"])
      .limit(1);

    if (existing && existing.length > 0) {
      return new Response(
        JSON.stringify({ error: "Você já possui uma assinatura ativa para este plano." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const originalCents = billingCycle === "YEARLY" ? plan.yearly_price_cents : plan.monthly_price_cents;

    // Validate and apply coupon
    const { finalCents, couponId, discountCents } = await validateAndApplyCoupon(
      adminClient, couponCode, planType, plan.product_family, originalCents
    );

    const valueReais = finalCents / 100;

    if (couponId) {
      console.log(`Coupon applied: ${couponCode} — discount ${discountCents} cents, final ${finalCents} cents`);
    }

    // Create subscription with credit card (transparent checkout)
    const subscriptionPayload: Record<string, unknown> = {
      customer: account.asaas_customer_id,
      billingType: "CREDIT_CARD",
      cycle: billingCycle,
      value: valueReais,
      nextDueDate: getNextBusinessDay(),
      description: `${plan.name} - ${billingCycle === "YEARLY" ? "Anual" : "Mensal"}${couponId ? ` (cupom: ${couponCode})` : ""}`,
      externalReference: userId,
      creditCard: {
        holderName: creditCard.holderName,
        number: creditCard.number.replace(/\s/g, ""),
        expiryMonth: creditCard.expiryMonth,
        expiryYear: creditCard.expiryYear,
        ccv: creditCard.ccv,
      },
      creditCardHolderInfo: {
        name: creditCardHolderInfo.name,
        email: creditCardHolderInfo.email || user.email,
        cpfCnpj: creditCardHolderInfo.cpfCnpj.replace(/\D/g, ""),
        postalCode: creditCardHolderInfo.postalCode.replace(/\D/g, ""),
        addressNumber: creditCardHolderInfo.addressNumber || "S/N",
        phone: creditCardHolderInfo.phone.replace(/\D/g, ""),
      },
    };

    // Add remoteIp if provided (required by Asaas for transparent checkout)
    if (remoteIp) {
      subscriptionPayload.remoteIp = remoteIp;
    }

    console.log("Creating subscription with transparent checkout for plan:", planType);

    const asaasResponse = await fetch(`${ASAAS_BASE_URL}/v3/subscriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: ASAAS_API_KEY,
      },
      body: JSON.stringify(subscriptionPayload),
    });

    const asaasData = await asaasResponse.json();

    if (!asaasResponse.ok) {
      console.error("Asaas subscription error:", asaasData);
      const errorMsg =
        asaasData.errors?.[0]?.description || "Falha ao processar pagamento com cartão";
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract creditCardToken for future renewals (never store raw card data)
    const creditCardToken = asaasData.creditCard?.creditCardToken || null;

    // Remove trial subscription if exists
    await adminClient
      .from("subscriptions")
      .update({ status: "canceled" })
      .eq("user_id", userId)
      .eq("status", "trialing");

    // Save subscription locally
    const { data: subscription, error: insertError } = await adminClient
      .from("subscriptions_asaas")
      .insert({
        user_id: userId,
        asaas_customer_id: account.asaas_customer_id,
        asaas_subscription_id: asaasData.id,
        plan_type: planType,
        billing_cycle: billingCycle,
        status: asaasData.status || "ACTIVE",
        value_cents: finalCents,
        next_due_date: (() => {
          const periodEnd = new Date();
          if (billingCycle === "YEARLY") {
            periodEnd.setFullYear(periodEnd.getFullYear() + 1);
          } else {
            periodEnd.setDate(periodEnd.getDate() + 30);
          }
          return periodEnd.toISOString().split("T")[0];
        })(),
        metadata: {
          creditCardToken,
          creditCardBrand: asaasData.creditCard?.creditCardBrand || null,
          creditCardNumber: asaasData.creditCard?.creditCardNumber || null,
          couponCode: couponCode || null,
          couponId: couponId || null,
          discountCents: discountCents || 0,
          originalValueCents: originalCents,
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
    }

    // Increment coupon usage
    if (couponId) {
      const { data: couponData } = await adminClient
        .from("coupons")
        .select("current_uses")
        .eq("id", couponId)
        .single();
      if (couponData) {
        await adminClient
          .from("coupons")
          .update({ current_uses: couponData.current_uses + 1, updated_at: new Date().toISOString() })
          .eq("id", couponId);
      }
    }

    // Grant subscription credits if plan includes them (combos)
    const subCredits = plan.select_credits_monthly || 0;
    if (subCredits > 0) {
      const { error: creditError } = await adminClient.rpc("renew_subscription_credits", {
        _user_id: userId,
        _amount: subCredits,
      });
      if (creditError) {
        console.error("Failed to grant subscription credits:", creditError);
      } else {
        console.log(`Granted ${subCredits} subscription credits for plan ${planType}`);
      }
    }

    console.log("Subscription created successfully:", asaasData.id, "status:", asaasData.status);

    return new Response(
      JSON.stringify({
        subscriptionId: asaasData.id,
        status: asaasData.status,
        localId: subscription?.id,
        discountApplied: discountCents > 0,
        discountCents,
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
