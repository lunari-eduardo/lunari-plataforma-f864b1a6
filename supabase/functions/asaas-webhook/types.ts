export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export const GB = 1024 * 1024 * 1024;
export const STORAGE_LIMITS: Record<string, number> = {
  transfer_5gb: 5 * GB,
  transfer_20gb: 20 * GB,
  transfer_50gb: 50 * GB,
  transfer_100gb: 100 * GB,
  combo_completo: 20 * GB,
};

export const PLAN_SUBSCRIPTION_CREDITS: Record<string, number> = {
  combo_pro_select2k: 2000,
  combo_completo: 2000,
};

export const PLAN_PRICES: Record<string, { monthly: number; yearly: number }> = {
  studio_starter: { monthly: 1490, yearly: 15198 },
  studio_pro: { monthly: 3590, yearly: 36618 },
  transfer_5gb: { monthly: 1290, yearly: 12384 },
  transfer_20gb: { monthly: 2490, yearly: 23904 },
  transfer_50gb: { monthly: 3490, yearly: 33504 },
  transfer_100gb: { monthly: 5990, yearly: 57504 },
  combo_pro_select2k: { monthly: 4490, yearly: 45259 },
  combo_completo: { monthly: 6490, yearly: 66198 },
};

export async function checkAndLogEvent(
  adminClient: any,
  eventType: string,
  eventId: string,
  payload: any
): Promise<boolean> {
  if (!eventId) return false;

  const { error } = await adminClient
    .from("gateway_events")
    .insert({
      event_type: eventType,
      provider: "asaas",
      provider_event_id: eventId,
      payload,
      processed: false,
    })
    .select("id, processed")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      const { data: existing } = await adminClient
        .from("gateway_events")
        .select("processed")
        .eq("provider", "asaas")
        .eq("provider_event_id", eventId)
        .maybeSingle();

      if (existing?.processed) {
        console.log(`⏭️ Event ${eventId} already processed, skipping`);
        return true;
      }
      return false;
    }
    console.error("Error logging webhook event:", error);
    return false;
  }

  return false;
}

export async function markEventProcessed(adminClient: any, eventId: string) {
  await adminClient
    .from("gateway_events")
    .update({ processed: true, processed_at: new Date().toISOString() })
    .eq("provider", "asaas")
    .eq("provider_event_id", eventId);
}
