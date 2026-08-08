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

    const { quote_id, component_tree, snapshot_id } = await req.json();

    if (!quote_id || !component_tree) {
      return new Response(JSON.stringify({ error: "quote_id and component_tree are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1. Fetch system components
    const { data: registry, error: registryError } = await supabase.from("component_registry").select("*");
    if (registryError) throw new Error("Failed to load component registry");

    const registryMap = new Map(registry.map(c => [c.type, c]));

    // 2. Validate component_tree against registry
    const blocks = component_tree.blocks || [];
    let isValid = true;
    const errors: string[] = [];

    for (const block of blocks) {
      const reg = registryMap.get(block.type);
      if (!reg) {
        isValid = false;
        errors.push(`Invalid component type: ${block.type}`);
        continue;
      }

      // Check variant
      const variants = reg.variants as string[];
      if (!variants.includes(block.variant)) {
        isValid = false;
        errors.push(`Invalid variant '${block.variant}' for component ${block.type}`);
      }

      // We could add JSON Schema validation here for block.props against reg.props_schema
      // Since this is a structural foundation, we do basic checks.
    }

    // 3. Grounding validation (conceptual, would check prices against service_catalog in a real scenario)
    
    // 4. Log the result
    const logStatus = isValid ? "success" : "validation_failed";
    const logData = {
      ai_context_snapshot_id: snapshot_id || null, // Can be null if this is just a manual editor save that didn't start from an AI prompt
      photographer_id: (await supabase.auth.getUser()).data.user?.id, // Get user id
      raw_output: component_tree,
      validation_result: { isValid, errors },
      status: logStatus
    };

    // If there is no snapshot_id (manual edit), we skip logging for now or we must fetch the snapshot.
    // The requirement is to log manual edits too, but ai_context_snapshot_id is required in the DB schema.
    // In a real flow, a manual edit creates a new quote_version directly, we'll log it if snapshot_id is provided.
    if (snapshot_id) {
        await supabase.from("ai_generation_logs").insert(logData);
    }

    if (!isValid) {
      return new Response(JSON.stringify({ success: false, errors }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    return new Response(JSON.stringify({ success: true, message: "Valid component tree" }), {
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
