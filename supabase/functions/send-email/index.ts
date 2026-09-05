import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { EventType, RequestBody } from './types.ts';
import { corsHeaders, jsonResponse, getAuthenticatedUserId } from './helpers.ts';
import { handleGallerySent } from './handlers/handleGallerySent.ts';
import { handleGalleryReactivated } from './handlers/handleGalleryReactivated.ts';
import { handleSelectionConfirmed } from './handlers/handleSelectionConfirmed.ts';
import { handleSelectionReminder } from './handlers/handleSelectionReminder.ts';
import { handlePaymentConfirmed } from './handlers/handlePaymentConfirmed.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    if (req.method !== 'POST') return jsonResponse({ success: false, error: 'Método não permitido' }, 405);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({})) as RequestBody;

    const validEvents: EventType[] = ['gallery_sent', 'payment_confirmed', 'gallery_reactivated', 'selection_confirmed', 'selection_reminder'];
    if (!body.eventType || !validEvents.includes(body.eventType)) {
      return jsonResponse({ success: false, status: 'erro', message: 'Evento de e-mail inválido' }, 400);
    }

    const callerUserId = await getAuthenticatedUserId(req, supabaseUrl, anonKey, serviceKey);
    if (!callerUserId) return jsonResponse({ success: false, status: 'erro', message: 'Autenticação obrigatória' }, 401);

    const ctx = { supabase, callerUserId, body };

    switch (body.eventType) {
      case 'gallery_sent':
        return await handleGallerySent(ctx);
      case 'gallery_reactivated':
        return await handleGalleryReactivated(ctx);
      case 'selection_confirmed':
        return await handleSelectionConfirmed(ctx);
      case 'selection_reminder':
        return await handleSelectionReminder(ctx);
      case 'payment_confirmed':
        return await handlePaymentConfirmed(ctx);
      default:
        return jsonResponse({ success: false, status: 'erro', message: 'Evento não tratado' }, 400);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('send-email fatal error:', error);
    return jsonResponse({ success: false, status: 'erro', message: 'Erro interno ao processar e-mail', details: errorMessage }, 500);
  }
});
