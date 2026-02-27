import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASAAS_BASE_URL = Deno.env.get("ASAAS_ENV") === "production"
  ? "https://api.asaas.com"
  : "https://api-sandbox.asaas.com";

const PLANS: Record<string, { yearlyPrice: number; name: string }> = {
  studio_starter: { yearlyPrice: 15198, name: "Lunari Starter" },
  studio_pro: { yearlyPrice: 36618, name: "Lunari Pro" },
  combo_pro_select2k: { yearlyPrice: 45259, name: "Studio Pro + Select 2k" },
  combo_completo: { yearlyPrice: 66198, name: "Combo Completo" },
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

    const userId = user.id;
    const { planType, installmentCount, creditCard, creditCardHolderInfo, remoteIp } = await req.json();

    const plan = PLANS[planType];
    if (!plan) {
      return new Response(
        JSON.stringify({ error: "Invalid plan type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    const valueReais = plan.yearlyPrice / 100;
    const validatedInstallments = Math.min(12, Math.max(1, installmentCount || 1));

    // Build payment
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    const day = dueDate.getDay();
    if (day === 0) dueDate.setDate(dueDate.getDate() + 1);
    if (day === 6) dueDate.setDate(dueDate.getDate() + 2);
    const dueDateStr = dueDate.toISOString().split("T")[0];

    const paymentPayload: Record<string, unknown> = {
      customer: account.asaas_customer_id,
      billingType: "CREDIT_CARD",
      value: valueReais,
      dueDate: dueDateStr,
      description: `${plan.name} - Anual`,
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

    if (validatedInstallments > 1) {
      paymentPayload.installmentCount = validatedInstallments;
      paymentPayload.installmentValue = Math.round((valueReais / validatedInstallments) * 100) / 100;
    }

    if (remoteIp) {
      paymentPayload.remoteIp = remoteIp;
    }

    console.log(`Creating yearly payment: plan=${planType}, value=${valueReais}, installments=${validatedInstallments}`);

    const asaasResponse = await fetch(`${ASAAS_BASE_URL}/v3/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: ASAAS_API_KEY,
      },
      body: JSON.stringify(paymentPayload),
    });

    const asaasData = await asaasResponse.json();

    if (!asaasResponse.ok) {
      console.error("Asaas payment error:", asaasData);
      const errorMsg =
        asaasData.errors?.[0]?.description || "Falha ao processar pagamento";
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paymentStatus = asaasData.status;
    const paymentId = asaasData.id;
    const creditCardToken = asaasData.creditCard?.creditCardToken || null;

    // Remove trial
    await adminClient
      .from("subscriptions")
      .update({ status: "canceled" })
      .eq("user_id", userId)
      .eq("status", "trialing");

    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    const { data: subscription, error: insertError } = await adminClient
      .from("subscriptions_asaas")
      .insert({
        user_id: userId,
        asaas_customer_id: account.asaas_customer_id,
        asaas_subscription_id: paymentId,
        plan_type: planType,
        billing_cycle: "YEARLY",
        status: paymentStatus === "CONFIRMED" || paymentStatus === "RECEIVED" ? "ACTIVE" : "PENDING",
        value_cents: Math.round(valueReais * 100),
        next_due_date: expiresAt.toISOString().split("T")[0],
        metadata: {
          creditCardToken,
          creditCardBrand: asaasData.creditCard?.creditCardBrand || null,
          creditCardNumber: asaasData.creditCard?.creditCardNumber || null,
          installmentCount: validatedInstallments,
          paymentType: "one_time",
          expiresAt: expiresAt.toISOString(),
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
    }

    return new Response(
      JSON.stringify({
        paymentId,
        status: paymentStatus === "CONFIRMED" || paymentStatus === "RECEIVED" ? "ACTIVE" : paymentStatus,
        localId: subscription?.id,
        installmentCount: validatedInstallments,
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