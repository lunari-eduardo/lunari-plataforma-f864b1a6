import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: req.headers.get("Authorization")! } },
    });

    const { quote_id, session_instructions } = await req.json();

    if (!quote_id) {
      return new Response(JSON.stringify({ error: "quote_id is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1. Fetch Quote and related data
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select(`
        *,
        clients (*),
        client_briefings (*)
      `)
      .eq("id", quote_id)
      .single();

    if (quoteError || !quote) {
      throw new Error(`Quote not found: ${quoteError?.message}`);
    }

    const photographerId = quote.photographer_id;

    // 2. Fetch Commercial contexts
    const [
      { data: businessContext },
      { data: brandContext },
      { data: audienceProfiles },
      { data: strategyConfig },
      { data: designPreferences },
      { data: serviceCatalog }
    ] = await Promise.all([
      supabase.from("photographer_business_context").select("*").eq("photographer_id", photographerId).single(),
      supabase.from("brand_context").select("*").eq("photographer_id", photographerId).single(),
      supabase.from("audience_profiles").select("*").eq("photographer_id", photographerId),
      supabase.from("photographer_sales_strategy_config").select("*").eq("photographer_id", photographerId).single(),
      supabase.from("design_preferences").select("*").eq("photographer_id", photographerId).eq("scope", "default").single(),
      supabase.from("service_catalog").select("*").eq("photographer_id", photographerId).eq("active", true),
    ]);

    // 3. Fetch System Catalogs (using Service Role to bypass RLS if needed, or anon since it's readable)
    // We can use the same authenticated client because they are readable for authenticated users.
    const [
      { data: componentRegistry },
      { data: layoutContractRules },
      { data: salesStrategyCatalog }
    ] = await Promise.all([
      supabase.from("component_registry").select("*"),
      supabase.from("layout_contract_rules").select("*"),
      supabase.from("sales_strategy_catalog").select("*")
    ]);

    // 4. Assemble the context payload
    const payload = {
      context_version: "2026-08-lunari-v1",
      system_rules: {
        description: "Regras obrigatórias do sistema. NUNCA violar.",
        rules: layoutContractRules
      },
      layout_contract: layoutContractRules,
      component_registry_ref: "v1.0",
      components: componentRegistry,

      business_context: businessContext,
      brand_context: brandContext,
      audience_context: audienceProfiles, // In a real scenario, filter by the specific segment if selected in the briefing
      sales_strategy_context: {
        config: strategyConfig,
        catalog: salesStrategyCatalog
      },
      design_preferences: designPreferences,
      
      client_context: {
        client: quote.clients,
        briefing: quote.client_briefings && quote.client_briefings.length > 0 ? quote.client_briefings[0] : null
      },
      quote_context: {
        quote: {
          id: quote.id,
          status: quote.status,
          validity_period: quote.validity_period,
          payment_conditions_ref: quote.payment_conditions_ref
        },
        service_catalog: serviceCatalog
      },
      session_instructions: session_instructions
    };

    // 5. Persist the snapshot
    const { data: snapshot, error: snapshotError } = await supabase
      .from("ai_context_snapshots")
      .insert({
        quote_id: quote_id,
        photographer_id: photographerId,
        payload: payload,
        context_version: "2026-08-lunari-v1",
        session_instructions: session_instructions || {}
      })
      .select()
      .single();

    if (snapshotError) {
      throw new Error(`Failed to save snapshot: ${snapshotError.message}`);
    }

    return new Response(JSON.stringify({ success: true, snapshot_id: snapshot.id, payload: payload }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
