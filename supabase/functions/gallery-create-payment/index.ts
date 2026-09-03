// supabase/functions/gallery-create-payment/index.ts
// Fachada pública para criação de pagamentos originados da Gallery, delegando ao orquestrador create-cobranca

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { resolvePayerHints } from "../_shared/payer-hints.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-lunari-internal-caller, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const GCP_VERSION = "v2.2.1";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "x-gcp-version": GCP_VERSION },
  });
}

function errorResponse(error: string, status = 400, code?: string, details?: unknown) {
  return jsonResponse(
    {
      success: false,
      version: GCP_VERSION,
      error,
      code: code || (status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : "BAD_REQUEST"),
      ...(details ? { details } : {}),
    },
    status
  );
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface CreatePaymentRequest {
  galleryId?: string;
  sessionId?: string;
  clienteId?: string;
  visitorId?: string;
  valor?: number;
  descricao?: string;
  qtdFotosExtras?: number;
  extraCount?: number;
  fotosIncluidasGaleria?: number;
  snapshotFotosIncluidas?: number;
  snapshotRegrasCongeladas?: any;
  provedor?: "asaas" | "mercadopago" | "infinitepay" | "pix_manual";
  provider?: "asaas" | "mercadopago" | "infinitepay" | "pix_manual";
  payer?: {
    nome?: string;
    email?: string;
    phone?: string;
    cpfCnpj?: string;
  };
  preloaded?: Record<string, any>;
  context?: string;
  expectedVersion?: string;
  correlationId?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body: CreatePaymentRequest = await req.json();

    const {
      galleryId: reqGalleryId,
      sessionId: reqSessionId,
      clienteId: reqClienteId,
      visitorId: reqVisitorId,
      valor: reqValor,
      descricao: reqDescricao,
      qtdFotosExtras: reqQtdFotos,
      extraCount: reqExtraCount,
      fotosIncluidasGaleria: reqFotosIncluidas,
      snapshotFotosIncluidas: reqSnapshotFotosIncluidas,
      provedor: reqProvedor,
      provider: reqProvider,
      payer,
      preloaded,
      correlationId: reqCorrelationId,
    } = body;

    const galleryId = preloaded?.gallery?.id ?? reqGalleryId ?? null;
    const sessionId = preloaded?.sessionIdTexto ?? preloaded?.gallery?.session_id ?? reqSessionId ?? null;

    // 1. Resolver fotógrafo dono e cliente
    let photographerId: string | null = preloaded?.gallery?.user_id ?? null;
    let clienteId: string | null = preloaded?.gallery?.cliente_id ?? reqClienteId ?? null;
    let galeriaObj: any = preloaded?.gallery ?? null;

    if (galleryId && (!galeriaObj || !photographerId || !clienteId)) {
      const { data: galeria, error: galError } = await supabase
        .from("galerias")
        .select("id, user_id, cliente_id, session_id, nome_sessao, fotos_incluidas, fotos_selecionadas, valor_extras, venda_pagamento_provedor, configuracoes")
        .eq("id", galleryId)
        .maybeSingle();

      if (galError || !galeria) {
        console.error("[gallery-create-payment] Galeria não encontrada:", galError);
        return errorResponse("Galeria não encontrada", 404);
      }
      galeriaObj = galeria;
      photographerId = galeria.user_id;
      clienteId = clienteId || galeria.cliente_id;
    } else if (sessionId && (!photographerId || !clienteId)) {
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

    let valor = preloaded?.valorCanonico ?? reqValor ?? (body as any)?.valorTotal ?? null;
    
    // Se valor não foi repassado explicitamente, consultar o cálculo canônico da galeria (delta seguro)
    if ((valor === null || valor === undefined || Number(valor) <= 0) && galleryId) {
      try {
        const { data: canonCalc } = await supabase.rpc("calculate_gallery_extra_payment", {
          p_gallery_id: galleryId,
          p_bypass_pre_selecao_gate: true,
        });
        if (canonCalc?.success && Number(canonCalc.valor_a_cobrar) > 0) {
          valor = Number(canonCalc.valor_a_cobrar);
        }
      } catch (calcErr) {
        console.warn("[gallery-create-payment] RPC calculate_gallery_extra_payment fallback:", calcErr);
      }
    }

    if ((valor === null || valor === undefined || Number(valor) <= 0) && galeriaObj?.valor_extras) {
      valor = Number(galeriaObj.valor_extras);
    }

    const finalSessionId = preloaded?.sessionIdTexto ?? sessionId;
    const rawQtd = preloaded?.extrasACobrar ?? reqQtdFotos ?? reqExtraCount ?? (body as any)?.qtdFotos;
    const fallbackQtd = galeriaObj ? Math.max(1, (galeriaObj.fotos_selecionadas || 0) - (galeriaObj.fotos_incluidas || 0)) : 1;
    const qtdFotosExtras = (rawQtd !== undefined && rawQtd !== null && Number(rawQtd) > 0) ? Number(rawQtd) : fallbackQtd;
    const fotosIncluidas = preloaded?.gallery?.fotos_incluidas ?? reqSnapshotFotosIncluidas ?? reqFotosIncluidas ?? galeriaObj?.fotos_incluidas ?? 0;

    if (valor === undefined || valor === null || Number(valor) <= 0) {
      return errorResponse("valor deve ser maior que zero", 400);
    }
    if (!galleryId && !sessionId) {
      return errorResponse("galleryId ou sessionId é obrigatório", 400);
    }

    if (!photographerId) {
      return errorResponse("Não foi possível identificar o fotógrafo", 404);
    }

    // 2. Identificar provedor com precedência canônica:
    // (1) Explícito no body / preloaded (provedor ou provider)
    // (2) Configurado na galeria (venda_pagamento_provedor ou configuracoes.saleSettings.paymentMethod)
    // (3) Fallback: Provedor padrão do fotógrafo (is_default) em usuarios_integracoes
    let provedor = reqProvedor || reqProvider || preloaded?.provedor || preloaded?.provider;

    if (!provedor && galeriaObj) {
      provedor = galeriaObj.venda_pagamento_provedor || galeriaObj.configuracoes?.saleSettings?.paymentMethod || null;
    }

    if (provedor) {
      // Validar se o fotógrafo tem esse provedor ativo
      const { data: integracaoAtiva } = await supabase
        .from("usuarios_integracoes")
        .select("provedor, status")
        .eq("user_id", photographerId)
        .eq("provedor", provedor)
        .eq("status", "ativo")
        .maybeSingle();

      if (!integracaoAtiva) {
        console.warn(`[gallery-create-payment] Provedor configurado (${provedor}) não está ativo para fotógrafo ${photographerId}. Buscando fallback...`);
        provedor = null;
      }
    }

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
          version: GCP_VERSION,
          error: "Fotógrafo não possui provedor de pagamento configurado ou ativo",
          errorCode: "NO_PAYMENT_PROVIDER",
        }, 400);
      }

      provedor = integracao.provedor;
    }

    // 3.5 Resolver dados do pagador em cascata e garantir cliente_id
    const hints = await resolvePayerHints({
      supabase,
      clienteId: clienteId || null,
      galleryId: galleryId || null,
      sessionId: sessionId || null,
      visitorId: reqVisitorId || null,
    });

    const effectivePayer = {
      nome: payer?.nome || hints.name || "Cliente Galeria",
      email: payer?.email || hints.email,
      phone: payer?.phone || hints.phone,
      cpfCnpj: payer?.cpfCnpj || hints.cpfCnpj,
    };

    // Se cliente_id for nulo, criar registro de cliente para vincular a cobrança
    if (!clienteId && photographerId) {
      const { data: newGuest } = await supabase
        .from("clientes")
        .insert({
          user_id: photographerId,
          nome: effectivePayer.nome,
          email: effectivePayer.email || null,
          telefone: effectivePayer.phone || null,
          whatsapp: effectivePayer.phone || null,
          cpf_cnpj: effectivePayer.cpfCnpj || null,
        })
        .select("id")
        .single();

      clienteId = newGuest?.id || null;
      if (clienteId && galleryId) {
        await supabase
          .from("galerias")
          .update({ cliente_id: clienteId })
          .eq("id", galleryId);
        console.log(`[gallery-create-payment] Galeria=${galleryId} vinculada ao novo cliente=${clienteId}`);
      }
    } else if (clienteId && (payer?.cpfCnpj || payer?.email || payer?.phone)) {
      // Se recebemos novos dados do cliente (ex: CPF preenchido no checkout), atualizar no CRM se estava vazio
      const patchData: Record<string, string> = {};
      if (payer.cpfCnpj && !hints.cpfCnpj) patchData.cpf_cnpj = payer.cpfCnpj;
      if (payer.email && !hints.email) patchData.email = payer.email;
      if (payer.phone && !hints.phone) {
        patchData.telefone = payer.phone;
        patchData.whatsapp = payer.phone;
      }
      if (Object.keys(patchData).length > 0) {
        await supabase.from("clientes").update(patchData).eq("id", clienteId);
      }
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
      descricao: reqDescricao || `${qtdFotosExtras || 0} fotos extras - ${galeriaObj?.nome_sessao || "Galeria"}`,
      provedor,
      finalidade: "fotos_extras",
      qtdFotos: qtdFotosExtras,
      snapshotFotosIncluidas: fotosIncluidas,
      payerContact: {
        nome: effectivePayer.nome,
        email: effectivePayer.email,
        telefone: effectivePayer.phone,
        whatsapp: effectivePayer.phone,
        cpfCnpj: effectivePayer.cpfCnpj,
      },
      correlationId: preloaded?.correlationId || reqCorrelationId || crypto.randomUUID(),
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
        version: GCP_VERSION,
        error: cobData.error || "Erro ao processar cobrança da galeria",
        errorCode: cobData.errorCode || "COBRANCA_FAILED",
      }, 400);
    }

    return jsonResponse({
      success: true,
      version: GCP_VERSION,
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
