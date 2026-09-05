import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';
import { handleFinalizePayment } from './paymentFinalizer.ts';
import { handleRegenerateCharge } from './chargeRegenerator.ts';
import { handlePhotoAction } from './photoActions.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiter — in-memory per isolate (burst protection)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60; // max requests per window
const RATE_WINDOW = 60_000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

interface RequestBody {
  galleryToken: string;
  photoId?: string;
  action: 'toggle' | 'select' | 'deselect' | 'comment' | 'favorite' | 'finalize_payment' | 'regenerate_charge';
  comment?: string;
  visitorId?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Rate limit check
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!checkRateLimit(clientIp)) {
      return new Response(
        JSON.stringify({ error: 'Muitas requisições. Tente novamente em instantes.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: RequestBody = await req.json();
    const { galleryToken, photoId, action, comment, visitorId } = body;

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'action é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!galleryToken) {
      return new Response(
        JSON.stringify({ error: 'galleryToken é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve galleryId from token (primary), UUID (legacy), or alias (fallback)
    let tokenGallery: { id: string } | null = null;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(galleryToken);

    if (isUUID) {
      const { data: uuidGallery, error: uuidError } = await supabase
        .from('galerias')
        .select('id')
        .eq('id', galleryToken)
        .maybeSingle();

      if (!uuidError && uuidGallery) {
        tokenGallery = uuidGallery;
      }
    }

    if (!tokenGallery) {
      const { data: primaryGallery, error: tokenError } = await supabase
        .from('galerias')
        .select('id')
        .eq('public_token', galleryToken)
        .maybeSingle();

      if (!tokenError && primaryGallery) {
        tokenGallery = primaryGallery;
      } else {
        const { data: alias } = await supabase
          .from('gallery_token_aliases')
          .select('gallery_id')
          .eq('old_token', galleryToken)
          .maybeSingle();
        if (alias?.gallery_id) {
          tokenGallery = { id: alias.gallery_id };
          console.log(`[client-selection] Resolved via token alias: ${galleryToken} -> ${alias.gallery_id}`);
        }
      }
    }

    if (!tokenGallery) {
      return new Response(
        JSON.stringify({ error: 'Galeria não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const galleryId = tokenGallery.id;

    if (action === 'finalize_payment') {
      return await handleFinalizePayment(supabase, galleryId, corsHeaders);
    }

    if (action === 'regenerate_charge') {
      return await handleRegenerateCharge(supabase, galleryId, corsHeaders);
    }

    return await handlePhotoAction({
      supabase,
      galleryId,
      photoId,
      action,
      comment,
      visitorId,
      corsHeaders,
    });
  } catch (error) {
    console.error('Client selection error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
