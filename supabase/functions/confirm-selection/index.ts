import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';
import { logAuditEvent, getCorrelationId } from '../_shared/audit.ts';
import { errorResponse, corsHeaders } from '../_shared/responses.ts';
import { checkRateLimit, validateAndLockSelection } from './selectionValidator.ts';
import { resolvePricing } from './pricingResolver.ts';
import { resolvePayment } from './paymentResolver.ts';
import { finalizeSelectionAndRespond } from './postConfirmation.ts';

interface RequestBody {
  galleryToken: string;
  selectedCount: number;
  extraCount?: number;
  valorUnitario?: number;
  valorTotal?: number;
  requestPayment?: boolean;
  visitorId?: string;
  payer?: {
    nome?: string;
    email?: string;
    phone?: string;
    cpfCnpj?: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const correlationId = getCorrelationId(req);
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    await supabase.rpc('set_config', { name: 'app.correlation_id', value: correlationId });

    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!checkRateLimit(clientIp)) {
      return errorResponse('Muitas requisições. Tente novamente em instantes.', 429);
    }

    const body: RequestBody = await req.json();
    const { extraCount, requestPayment, galleryToken, visitorId, payer } = body;

    await logAuditEvent({
      correlationId,
      eventType: 'CONFIRM_SELECTION_START',
      source: 'edge_function',
      sourceName: 'confirm-selection',
      payload: { galleryToken, visitorId, extraCount, requestPayment }
    });

    // 1. Validate & Lock
    const lockResult = await validateAndLockSelection({
      supabase,
      galleryToken,
      visitorId,
      selectedCountFromBody: body.selectedCount,
    });

    if (lockResult.error) {
      return lockResult.error;
    }

    const {
      galleryId,
      selectedCount,
      gallery,
      extrasPagasTotal: initialExtrasPagas,
      valorJaPago: initialValorPago,
      rollbackGalleryStatus,
    } = lockResult;

    // 2. Resolve Pricing
    const pricing = await resolvePricing({
      supabase,
      galleryId,
      gallery,
      selectedCount,
      initialExtrasPagas,
      initialValorPago,
    });

    const {
      valorUnitario,
      valorTotal,
      extrasACobrar,
      saleSettingsJson,
      extrasNecessarias,
    } = pricing;

    const extrasCount = extraCount ?? extrasNecessarias;

    // 3. Resolve Payment
    const payment = await resolvePayment({
      supabase,
      gallery,
      galleryId,
      galleryToken,
      saleSettingsJson,
      valorTotal,
      extrasACobrar,
      extrasCount,
      correlationId,
      visitorId,
      payer,
      supabaseUrl,
      supabaseServiceKey,
      rollbackGalleryStatus,
    });

    if (payment.error) {
      return payment.error;
    }

    const {
      saleMode,
      shouldCreatePayment,
      paymentResponse,
      statusPagamento,
    } = payment;

    // 4. Finalize selection & background tasks
    return await finalizeSelectionAndRespond({
      supabase,
      gallery,
      galleryId,
      galleryToken,
      visitorId,
      selectedCount,
      extrasCount,
      valorTotal,
      valorUnitario,
      extrasACobrar,
      shouldCreatePayment,
      paymentResponse,
      statusPagamento,
      saleMode,
      clientIp,
      correlationId,
      supabaseUrl,
      supabaseServiceKey,
      userAgent: req.headers.get('user-agent'),
      rollbackGalleryStatus,
    });
  } catch (error) {
    console.error('Confirm selection error:', error);
    return errorResponse('Erro interno do servidor', 500);
  }
});
