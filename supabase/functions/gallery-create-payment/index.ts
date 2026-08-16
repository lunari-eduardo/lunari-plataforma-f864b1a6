// supabase/functions/gallery-create-payment/index.ts
// Fachada pública para criação de pagamentos originados da Gallery, delegando ao orquestrador create-cobranca

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/auth-guard.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface CreatePaymentRequest {
  galleryId?: string;
  sessionId?: string;
  clienteId?: string;
  valor?: number;
  descricao?: string;
  qtdFotosExtras?: number;
  fotosIncluidasGaleria?: number;
  provedor?: "asaas" | "mercadopago" | "infinitepay" | "pix_manual";
  payer?: {
    nome?: string;
    email?: string;
    phone?: string;
    cpfCnpj?: string;
  };
  preloaded?: Record<string, any>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body: CreatePaymentRequest = await req.json();
    const { galleryId, sessionId, descricao, qtdFotosExtras, fotosIncluidasGaleria, preloaded, payer } = body;

    const valor = preloaded?.valorCanonico ?? body.valor;
    const finalSessionId = preloaded?.sessionIdTexto ?? sessionId;

    if (valor === undefined || valor === null || Number(valor) <= 0) {
      return errorResponse("valor deve ser maior que zero", 400);
    }
    if (!galleryId && !sessionId) {
      return errorResponse("galleryId ou sessionId é obrigatório", 400);
    }

    // 1. Resolver fotógrafo dono e cliente
    let photographerId: string | null = null;
    let clienteId: string | null = preloaded?.gallery?.cliente_id ?? body.clienteId ?? null;
    let galeriaObj: any = null;

    if (galleryId) {
      const { data: galeria, error: galError } = await supabase
        .from("galerias")
        .select("id, user_id, cliente_id, session_id, nome_sessao, fotos_incluidas")
        .eq("id", galleryId)
        .maybeSingle();

      if (galError || !galeria) {
        console.error("[gallery-create-payment] Galeria não encontrada:", galError);
        return errorResponse("Galeria não encontrada", 404);
      }
      galeriaObj = galeria;
      photographerId = galeria.user_id;
      clienteId = clienteId || galeria.cliente_id;
    } else if (sessionId) {
      const { data: sessao, error: sessError } = await supabase
        .from("clientes_sessoes")
        .select("user_id, session_id, cliente_id")
        .or(`session_id.eq.${sessionId},id.eq.${sessionId}`)
        .maybeSingle();

      if (sessError || !sessao) {
        console.error("[gallery-create-payment] Sessão não encontrada:", sessError);
        return errorResponse("Sessão não encontrada", 404);
      }
      photographerId = sessao.user_id;
      clienteId = clienteId || sessao.cliente_id;
    }

    if (!photographerId) {
      return errorResponse("Não foi possível identificar o fotógrafo", 404);
    }

    // 2. Gate de autorização Gallery server-side
    const { data: accessData, error: accessError } = await supabase.rpc("user_has_gallery_access", {
      _user_id: photographerId,
    });

    if (accessError || !accessData) {
      console.warn("[gallery-create-payment] Fotógrafo sem acesso à Gallery:", photographerId);
      return jsonResponse({
        success: false,
        error: "O fotógrafo não possui plano ativo com integração Gallery.",
        errorCode: "NO_GALLERY_ACCESS",
      }, 403);
    }

    // 3. Identificar provedor ativo se não enviado explicitamente
    let provedor = body.provedor || preloaded?.provedor;
    if (!provedor) {
      const { data: integracao } = await supabase
        .from("usuarios_integracoes")
        .select("provedor, is_default, updated_at")
        .eq("user_id", photographerId)
        .eq("status", "ativo")
        .in("provedor", ["mercadopago", "infinitepay", "asaas", "pix_manual"])
        .order("is_default", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!integracao) {
        return jsonResponse({
          success: false,
          error: "Fotógrafo não possui provedor de pagamento configurado",
          errorCode: "NO_PAYMENT_PROVIDER",
        }, 400);
      }

      provedor = integracao.provedor;
    }

    // Se cliente_id for nulo (ex: visitante em galeria pública), buscar ou criar registro temporário de cliente para vincular a cobrança
    if (!clienteId && photographerId) {
      const guestName = payer?.nome || "Cliente Galeria";
      const guestEmail = payer?.email || null;
      const guestPhone = payer?.phone || null;

      const { data: newGuest } = await supabase
        .from("clientes")
        .insert({
          user_id: photographerId,
          nome: guestName,
          email: guestEmail,
          telefone: guestPhone,
          whatsapp: guestPhone,
        })
        .select("id")
        .single();

      clienteId = newGuest?.id || null;
    }

    if (!clienteId) {
      return errorResponse("clienteId é obrigatório para registrar a cobrança", 400);
    }

    // 4. Delegar criação para create-cobranca com Service Role
    const orchestratorUrl = `${SUPABASE_URL}/functions/v1/create-cobranca`;
    const orchestratorPayload = {
      userId: photographerId,
      clienteId,
      sessionId: finalSessionId,
      galeriaId: galleryId,
      valor: Number(valor),
      descricao: descricao || `${qtdFotosExtras || 0} fotos extras - ${galeriaObj?.nome_sessao || "Galeria"}`,
      provedor,
      finalidade: "fotos_extras",
      qtdFotos: qtdFotosExtras,
      snapshotFotosIncluidas: fotosIncluidasGaleria ?? galeriaObj?.fotos_incluidas ?? 0,
      payerContact: payer,
      correlationId: preloaded?.correlationId || crypto.randomUUID(),
    };

    console.log(`[gallery-create-payment] Invocando create-cobranca para fotógrafo=${photographerId}, provedor=${provedor}, valor=${valor}`);

    const cobRes = await fetch(orchestratorUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        "x-lunari-internal-caller": "gallery-create-payment",
      },
      body: JSON.stringify(orchestratorPayload),
    });

    const cobData = await cobRes.json();

    if (!cobRes.ok || !cobData.success) {
      console.error("[gallery-create-payment] create-cobranca retornou erro:", cobData);
      return jsonResponse({
        success: false,
        error: cobData.error || "Erro ao processar cobrança da galeria",
        errorCode: cobData.errorCode || "COBRANCA_FAILED",
      }, 400);
    }

    return jsonResponse({
      success: true,
      checkoutUrl: cobData.checkoutUrl,
      paymentLink: cobData.paymentLink,
      socialShareUrl: cobData.socialShareUrl,
      cobrancaId: cobData.cobrancaId,
      provedor: cobData.provedor,
      status: cobData.status,
      pixCopiaCola: cobData.pixCopiaCola,
      pixQrCodeBase64: cobData.pixQrCodeBase64,
      reused: cobData.reused,
    });
  } catch (err: any) {
    console.error("[gallery-create-payment] Exceção inesperada:", err);
    return errorResponse(err.message || "Falha interna ao criar pagamento da galeria", 500);
  }
});
