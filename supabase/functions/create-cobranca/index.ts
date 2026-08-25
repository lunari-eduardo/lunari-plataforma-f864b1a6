// supabase/functions/create-cobranca/index.ts
// Orquestrador central de criação de cobranças do Lunari (Studio, Workflow e Gallery)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { resolveCallerAuth, corsHeaders, jsonResponse, errorResponse } from "../_shared/auth-guard.ts";
import {
  CreateCobrancaRequest,
  CreateCobrancaResponse,
  AdapterCreatePaymentInput,
  AdapterCreatePaymentOutput,
  ClienteContact,
} from "../_shared/payment-types.ts";
import {
  resolveCobrancaBinding,
  assertExtraPaymentWithinIdeal,
  assertNotAmbiguousSessionCharge,
  cancelStalePendingChargesForSession,
  cancelStalePendingChargesForGallery,
} from "../_shared/cobrancaBinding.ts";
import { generatePixPayload } from "../_shared/pix-utils.ts";
import { createMercadoPagoPayment } from "../_shared/adapters/mercadopago.ts";
import { createInfinitePayPayment } from "../_shared/adapters/infinitepay.ts";
import { createAsaasPayment } from "../_shared/adapters/asaas.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUBLIC_SITE_URL = (Deno.env.get("VITE_SITE_URL") || Deno.env.get("SITE_URL") || "https://app.lunarihub.com").replace(/\/$/, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body: CreateCobrancaRequest & { userId?: string } = await req.json();

    // 1. Resolver autenticação do chamador
    // - Se tiver JWT de usuário: usa o userId criptografado no token
    // - Se for Service Role ou cliente anônimo em checkout público/galeria: usa body.userId
    const authResult = await resolveCallerAuth(req, supabase);
    let userId: string;
    if (authResult.authType === "user" && authResult.userId) {
      userId = authResult.userId;
    } else if (body.userId) {
      userId = body.userId;
    } else if (authResult.errorResponse) {
      return authResult.errorResponse;
    } else {
      return errorResponse("userId é obrigatório", 400, "MISSING_USER_ID");
    }

    const {
      clienteId,
      sessionId,
      valor,
      descricao,
      provedor,
      idempotencyKey,
      payerContact,
      billingType,
      creditCard,
      creditCardHolderInfo,
      installmentCount,
      dadosExtras,
    } = body;

    // Validações básicas de entrada
    if (!clienteId) return errorResponse("clienteId é obrigatório", 400, "MISSING_CLIENTE_ID");
    if (!valor || Number(valor) <= 0) return errorResponse("valor deve ser maior que zero", 400, "INVALID_VALOR");
    if (!provedor || !["mercadopago", "infinitepay", "asaas", "pix_manual"].includes(provedor)) {
      return errorResponse("provedor inválido. Aceitos: mercadopago, infinitepay, asaas, pix_manual", 400, "INVALID_PROVIDER");
    }

    // 2. Resolver contrato de finalidade e guards de integridade (sessao, fotos_extras, sessao_e_extras)
    const { binding, error: bindingError } = await resolveCobrancaBinding(
      supabase,
      userId,
      {
        finalidade: body.finalidade,
        galeriaId: body.galeriaId,
        sessionId: body.sessionId,
        qtdFotos: body.qtdFotos,
        snapshotFotosIncluidas: body.snapshotFotosIncluidas,
        correlationId: body.correlationId,
        valorSessaoComponente: body.valorSessaoComponente,
        valorExtrasComponente: body.valorExtrasComponente,
        valorTotal: valor,
      },
      ["sessao", "fotos_extras", "sessao_e_extras"]
    );

    if (bindingError || !binding) {
      return jsonResponse({ success: false, error: bindingError?.message, code: bindingError?.code, details: bindingError?.details }, 400);
    }

    // Guardas anti-overcharge em fotos extras (apenas quando a galeria já tiver cálculo formal consolidado e não for override de sessão)
    if (binding.finalidade === "fotos_extras" && binding.galeria_id && !sessionId) {
      const guard = await assertExtraPaymentWithinIdeal(supabase, binding.galeria_id, valor);
      if (guard.error) {
        return jsonResponse({ success: false, error: guard.error.message, code: guard.error.code, details: guard.error.details }, 400);
      }
    } else if (binding.finalidade === "sessao_e_extras" && binding.galeria_id && binding.valor_extras_componente && !sessionId) {
      const guard = await assertExtraPaymentWithinIdeal(supabase, binding.galeria_id, binding.valor_extras_componente);
      if (guard.error) {
        return jsonResponse({ success: false, error: guard.error.message, code: guard.error.code, details: guard.error.details }, 400);
      }
    } else if (binding.finalidade === "sessao" && sessionId) {
      const guard = await assertNotAmbiguousSessionCharge(supabase, sessionId, valor, body.allowAmbiguous === true);
      if (guard.error) {
        return jsonResponse({ success: false, error: guard.error.message, code: guard.error.code, details: guard.error.details }, 400);
      }
    }

    // 3. Normalizar session_id se informado
    let normalizedSessionId: string | null = null;
    if (sessionId) {
      const { data: sessao } = await supabase
        .from("clientes_sessoes")
        .select("session_id")
        .or(`id.eq.${sessionId},session_id.eq.${sessionId}`)
        .maybeSingle();
      normalizedSessionId = sessao?.session_id || sessionId;
    }

    // 4. Tratamento atômico de Idempotência
    if (idempotencyKey) {
      const { data: existing } = await supabase
        .from("cobrancas")
        .select("*")
        .eq("user_id", userId)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (existing) {
        console.log(`[create-cobranca] Cobrança existente reutilizada por idempotency_key=${idempotencyKey}, id=${existing.id}`);
        const socialUrl = `${PUBLIC_SITE_URL}/l/${existing.id}`;
        const finalUrl = existing.checkout_url || existing.ip_checkout_url || existing.mp_payment_link || socialUrl;
        return jsonResponse({
          success: true,
          cobrancaId: existing.id,
          checkoutUrl: finalUrl,
          paymentLink: finalUrl,
          socialShareUrl: socialUrl,
          pixCopiaCola: existing.pix_copia_cola || existing.mp_pix_copia_cola || undefined,
          pixQrCodeBase64: existing.pix_qr_code_base64 || existing.mp_qr_code_base64 || undefined,
          provedor: existing.provedor,
          status: existing.status,
          reused: true,
        } as CreateCobrancaResponse, 200);
      }
    }

    // 5. Inserir registro preliminar na tabela cobrancas
    const insertPayload: Record<string, any> = {
      user_id: userId,
      cliente_id: clienteId,
      session_id: normalizedSessionId,
      galeria_id: binding.galeria_id,
      valor: Math.round(Number(valor) * 100) / 100,
      descricao: descricao || "Serviço fotográfico",
      tipo_cobranca: billingType === "PIX" ? "pix" : billingType === "CREDIT_CARD" ? "card" : "link",
      total_parcelas: installmentCount && installmentCount > 1 ? installmentCount : 1,
      provedor,
      status: "pendente",
      finalidade: binding.finalidade,
      qtd_fotos: binding.qtd_fotos,
      snapshot_fotos_incluidas: binding.snapshot_fotos_incluidas,
      correlation_id: binding.correlation_id,
      valor_sessao_componente: binding.valor_sessao_componente,
      valor_extras_componente: binding.valor_extras_componente,
      idempotency_key: idempotencyKey || null,
      dados_extras: dadosExtras || null,
    };

    let cobranca: any;
    const { data: inserted, error: insertError } = await supabase
      .from("cobrancas")
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      if (insertError.code === "23505" && idempotencyKey) {
        console.log(`[create-cobranca] Unique violation capturada (23505) em concorrência. Buscando cobrança existente...`);
        const { data: raceFound } = await supabase
          .from("cobrancas")
          .select("*")
          .eq("user_id", userId)
          .eq("idempotency_key", idempotencyKey)
          .single();

        if (raceFound) {
          const socialUrl = `${PUBLIC_SITE_URL}/l/${raceFound.id}`;
          const finalUrl = raceFound.checkout_url || raceFound.ip_checkout_url || raceFound.mp_payment_link || socialUrl;
          return jsonResponse({
            success: true,
            cobrancaId: raceFound.id,
            checkoutUrl: finalUrl,
            paymentLink: finalUrl,
            socialShareUrl: socialUrl,
            pixCopiaCola: raceFound.pix_copia_cola || raceFound.mp_pix_copia_cola || undefined,
            pixQrCodeBase64: raceFound.pix_qr_code_base64 || raceFound.mp_qr_code_base64 || undefined,
            provedor: raceFound.provedor,
            status: raceFound.status,
            reused: true,
          } as CreateCobrancaResponse, 200);
        }
      }

      console.error("[create-cobranca] Falha ao inserir registro de cobrança:", insertError);
      return errorResponse("Erro ao registrar cobrança no banco de dados", 500, "INSERT_COBRANCA_FAILED", insertError);
    }

    cobranca = inserted;
    const cobrancaId = cobranca.id;
    console.log(`[create-cobranca] Cobrança inicial criada id=${cobrancaId}, provedor=${provedor}, finalidade=${binding.finalidade}`);

    // Cancelar cobranças pendentes anteriores órfãs da mesma galeria/sessão
    if (binding.galeria_id) {
      await cancelStalePendingChargesForGallery(supabase, binding.galeria_id, cobrancaId);
    }
    if (normalizedSessionId) {
      await cancelStalePendingChargesForSession(supabase, normalizedSessionId, cobrancaId);
    }

    // 6. Buscar e mesclar dados do cliente
    const { data: clienteDb } = await supabase
      .from("clientes")
      .select("nome, email, telefone, whatsapp, cpf_cnpj, cep, endereco, numero, complemento, bairro, cidade, estado")
      .eq("id", clienteId)
      .maybeSingle();

    const mergedCliente: ClienteContact = {
      id: clienteId,
      nome: clienteDb?.nome || payerContact?.nome || "Cliente",
      email: clienteDb?.email || payerContact?.email,
      telefone: clienteDb?.telefone || payerContact?.telefone,
      whatsapp: clienteDb?.whatsapp || payerContact?.whatsapp,
      cpfCnpj: clienteDb?.cpf_cnpj || payerContact?.cpfCnpj,
      cep: clienteDb?.cep || payerContact?.cep,
      endereco: clienteDb?.endereco || payerContact?.endereco,
      numero: clienteDb?.numero || payerContact?.numero,
      complemento: clienteDb?.complemento || payerContact?.complemento,
      bairro: clienteDb?.bairro || payerContact?.bairro,
      cidade: clienteDb?.cidade || payerContact?.cidade,
      uf: clienteDb?.estado || payerContact?.uf,
    };

    // 7. CASO ESPECIAL: PIX MANUAL (processado localmente)
    if (provedor === "pix_manual") {
      const { data: integPix } = await supabase
        .from("usuarios_integracoes")
        .select("dados_extras")
        .eq("user_id", userId)
        .eq("provedor", "pix_manual")
        .eq("status", "ativo")
        .maybeSingle();

      const pixConfig = integPix?.dados_extras as { chavePix?: string; nomeTitular?: string } | null;
      if (!pixConfig?.chavePix || !pixConfig?.nomeTitular) {
        await supabase.from("cobrancas").update({ status: "falha", error_message: "PIX Manual não configurado" }).eq("id", cobrancaId);
        return errorResponse("PIX Manual não configurado pelo fotógrafo", 400, "PIX_MANUAL_NOT_CONFIGURED");
      }

      const emvPayload = generatePixPayload({
        chavePix: pixConfig.chavePix,
        nomeBeneficiario: pixConfig.nomeTitular,
        valor: Number(valor),
        identificador: normalizedSessionId?.substring(0, 20) || cobrancaId.substring(0, 20),
      });

      const socialShareUrl = `${PUBLIC_SITE_URL}/l/${cobrancaId}`;

      await supabase
        .from("cobrancas")
        .update({
          pix_copia_cola: emvPayload,
          mp_pix_copia_cola: emvPayload,
          updated_at: new Date().toISOString(),
        })
        .eq("id", cobrancaId);

      return jsonResponse({
        success: true,
        cobrancaId,
        checkoutUrl: socialShareUrl,
        paymentLink: socialShareUrl,
        socialShareUrl,
        pixCopiaCola: emvPayload,
        provedor: "pix_manual",
        status: "pendente",
      } as CreateCobrancaResponse, 200);
    }

    // 8. DESPACHO PARA O ADAPTADOR CORRESPONDENTE
    const adapterPayload: AdapterCreatePaymentInput = {
      cobrancaId,
      userId,
      valor: Number(valor),
      descricao: descricao || "Serviço fotográfico",
      cliente: mergedCliente,
      clientIp: req.headers.get("x-forwarded-for") || undefined,
      requestDadosExtras: dadosExtras,
      integrationData: {},
      billingType,
      creditCard,
      creditCardHolderInfo,
      installmentCount,
      correlationId: binding.correlation_id,
    };

    let adapterData: AdapterCreatePaymentOutput;

    if (provedor === "mercadopago") {
      adapterData = await createMercadoPagoPayment(supabase, adapterPayload, SUPABASE_URL, PUBLIC_SITE_URL);
    } else if (provedor === "infinitepay") {
      adapterData = await createInfinitePayPayment(supabase, adapterPayload, SUPABASE_URL, PUBLIC_SITE_URL);
    } else if (provedor === "asaas") {
      adapterData = await createAsaasPayment(supabase, adapterPayload, PUBLIC_SITE_URL);
    } else {
      return errorResponse(`Provedor desconhecido: ${provedor}`, 400);
    }

    if (!adapterData.success) {
      console.error(`[create-cobranca] Falha no adaptador ${provedor}:`, adapterData);
      await supabase
        .from("cobrancas")
        .update({
          status: "falha",
          error_message: adapterData.error || "Erro no gateway de pagamento",
          updated_at: new Date().toISOString(),
        })
        .eq("id", cobrancaId);

      return jsonResponse({
        success: false,
        cobrancaId,
        error: adapterData.error || "Falha na emissão de cobrança no provedor",
        errorCode: adapterData.errorCode || "ADAPTER_ERROR",
      } as CreateCobrancaResponse, 400);
    }

    // 9. Atualizar cobrança com os identificadores retornados pelo adaptador
    const socialShareUrl = `${PUBLIC_SITE_URL}/l/${cobrancaId}`;
    const finalCheckoutUrl = adapterData.checkoutUrl || socialShareUrl;

    const updateData: Record<string, any> = {
      provider_order_id: adapterData.providerOrderId || null,
      provider_transaction_id: adapterData.providerTransactionId || null,
      checkout_url: finalCheckoutUrl,
      pix_copia_cola: adapterData.pixCopiaCola || null,
      pix_qr_code_base64: adapterData.pixQrCodeBase64 || null,
      dados_extras: {
        ...(cobranca.dados_extras || {}),
        ...(adapterData.dadosExtras || {}),
      },
      updated_at: new Date().toISOString(),
    };

    // Campos de retrocompatibilidade para leitores legados
    if (provedor === "mercadopago") {
      updateData.mp_preference_id = adapterData.providerOrderId || null;
      updateData.mp_payment_link = finalCheckoutUrl;
      if (adapterData.pixCopiaCola) updateData.mp_pix_copia_cola = adapterData.pixCopiaCola;
      if (adapterData.pixQrCodeBase64) updateData.mp_qr_code_base64 = adapterData.pixQrCodeBase64;
    } else if (provedor === "infinitepay") {
      updateData.ip_order_nsu = cobrancaId;
      updateData.ip_checkout_url = finalCheckoutUrl;
      updateData.ip_invoice_slug = adapterData.providerOrderId || null;
    } else if (provedor === "asaas") {
      updateData.asaas_payment_id = adapterData.providerOrderId || null;
      if (adapterData.pixCopiaCola) updateData.mp_pix_copia_cola = adapterData.pixCopiaCola;
    }

    const asaasStatus = adapterData.dadosExtras?.status;
    const isPaid = asaasStatus === "CONFIRMED" || asaasStatus === "RECEIVED";
    if (isPaid) {
      updateData.status = "pago";
      updateData.data_pagamento = new Date().toISOString();
      if (adapterData.dadosExtras?.netValue != null) {
        updateData.valor_liquido = adapterData.dadosExtras.netValue;
      }
    }

    await supabase.from("cobrancas").update(updateData).eq("id", cobrancaId);

    if (isPaid && (binding.finalidade === "fotos_extras" || binding.finalidade === "sessao_e_extras")) {
      try {
        await supabase.rpc("finalize_gallery_payment", {
          p_cobranca_id: cobrancaId,
          p_paid_at: updateData.data_pagamento,
        });
        console.log(`[create-cobranca] finalize_gallery_payment executado com sucesso para cobranca=${cobrancaId}`);
      } catch (finalizeErr) {
        console.error(`[create-cobranca] Falha não fatal ao invocar finalize_gallery_payment:`, finalizeErr);
      }
    }

    console.log(`[create-cobranca] Cobrança ${cobrancaId} finalizada com sucesso (status=${updateData.status || 'pendente'})! Checkout: ${finalCheckoutUrl}`);

    const response: CreateCobrancaResponse = {
      success: true,
      cobrancaId,
      checkoutUrl: finalCheckoutUrl,
      paymentLink: finalCheckoutUrl,
      socialShareUrl,
      pixCopiaCola: adapterData.pixCopiaCola,
      pixQrCodeBase64: adapterData.pixQrCodeBase64,
      provedor,
      status: isPaid ? "pago" : "pendente",
      paid: isPaid,
      creditCardStatus: asaasStatus || undefined,
      requiresPolling: !isPaid && billingType === "CREDIT_CARD",
      paymentId: adapterData.providerOrderId,
    };

    return jsonResponse(response, 200);
  } catch (err: any) {
    console.error("[create-cobranca] Exceção não tratada:", err);
    return errorResponse(err.message || "Erro interno ao processar criação de cobrança", 500);
  }
});
