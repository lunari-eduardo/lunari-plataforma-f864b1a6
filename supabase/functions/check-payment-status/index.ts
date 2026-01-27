import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * CONTRATO OFICIAL: Fallback obrigatório para verificação manual de pagamentos
 * 
 * Lógica de resolução segue a mesma ordem do webhook:
 * 1º: Buscar por ip_order_nsu = identifier
 * 2º: Fallback por id = identifier
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { cobrancaId, orderNsu, sessionId, forceUpdate } = await req.json();

    console.log("[check-payment-status] Request:", { cobrancaId, orderNsu, sessionId, forceUpdate });

    // RESOLUÇÃO SEGUE MESMA ORDEM DO WEBHOOK: ip_order_nsu → id
    let cobranca = null;
    let searchMethod = "";

    // 1. Buscar por cobrancaId (pode ser UUID ou ip_order_nsu)
    if (cobrancaId) {
      // Primeiro tentar por ip_order_nsu
      console.log(`[check-payment-status] 1st search: ip_order_nsu = ${cobrancaId}`);
      const { data: byNsu, error: nsuError } = await supabase
        .from("cobrancas")
        .select("*")
        .eq("ip_order_nsu", cobrancaId)
        .maybeSingle();

      if (nsuError) {
        console.error("[check-payment-status] Error searching by ip_order_nsu:", nsuError);
      }

      if (byNsu) {
        cobranca = byNsu;
        searchMethod = "by_ip_order_nsu";
        console.log(`[check-payment-status] Found by ip_order_nsu: ${byNsu.id}`);
      } else {
        // Fallback por id (sem regex - query simplesmente não retorna se não for UUID válido)
        console.log(`[check-payment-status] 2nd search (fallback): id = ${cobrancaId}`);
        const { data: byId, error: idError } = await supabase
          .from("cobrancas")
          .select("*")
          .eq("id", cobrancaId)
          .maybeSingle();

        if (idError) {
          console.error("[check-payment-status] Error searching by id:", idError);
        }

        if (byId) {
          cobranca = byId;
          searchMethod = "by_id";
          console.log(`[check-payment-status] Found by id: ${byId.id}`);
        }
      }
    }

    // 2. Buscar por orderNsu se não encontrou
    if (!cobranca && orderNsu) {
      console.log(`[check-payment-status] Searching by orderNsu: ${orderNsu}`);
      const { data: byNsu, error: nsuError } = await supabase
        .from("cobrancas")
        .select("*")
        .eq("ip_order_nsu", orderNsu)
        .maybeSingle();

      if (nsuError) {
        console.error("[check-payment-status] Error searching by orderNsu:", nsuError);
      }

      if (byNsu) {
        cobranca = byNsu;
        searchMethod = "by_ip_order_nsu_param";
        console.log(`[check-payment-status] Found by orderNsu: ${byNsu.id}`);
      }
    }

    // 3. Buscar por sessionId se não encontrou (cobrança mais recente pendente)
    if (!cobranca && sessionId) {
      console.log(`[check-payment-status] Searching by sessionId: ${sessionId}`);
      const { data: bySession, error: sessionError } = await supabase
        .from("cobrancas")
        .select("*")
        .eq("session_id", sessionId)
        .eq("status", "pendente")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sessionError) {
        console.error("[check-payment-status] Error searching by sessionId:", sessionError);
      }

      if (bySession) {
        cobranca = bySession;
        searchMethod = "by_session_id";
        console.log(`[check-payment-status] Found by sessionId: ${bySession.id}`);
      }
    }

    if (!cobranca) {
      console.log("[check-payment-status] Cobranca not found");
      return new Response(
        JSON.stringify({ found: false, error: "Cobranca not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    console.log(`[check-payment-status] Found via ${searchMethod}: ${cobranca.id}, status: ${cobranca.status}`);

    // Se já está pago, retornar status
    if (cobranca.status === "pago") {
      return new Response(
        JSON.stringify({ 
          found: true, 
          status: "pago", 
          updated: false, 
          source: "already_paid",
          cobrancaId: cobranca.id 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Se forceUpdate, marcar como pago
    if (forceUpdate) {
      const now = new Date().toISOString();

      // Atualizar cobrança
      const { error: updateError } = await supabase
        .from("cobrancas")
        .update({
          status: "pago",
          data_pagamento: now,
          ip_transaction_nsu: "manual-verification",
          updated_at: now,
        })
        .eq("id", cobranca.id);

      if (updateError) {
        console.error("[check-payment-status] Error updating cobranca:", updateError);
        throw new Error("Failed to update cobranca");
      }

      console.log(`[check-payment-status] Cobranca ${cobranca.id} updated to 'pago'`);

      // Se tem sessão vinculada, criar transação
      if (cobranca.session_id) {
        // Buscar sessão para obter cliente_id e session_id texto
        let session = null;

        // Primeiro tentar por session_id texto
        const { data: byText } = await supabase
          .from("clientes_sessoes")
          .select("session_id, cliente_id")
          .eq("session_id", cobranca.session_id)
          .maybeSingle();

        if (byText) {
          session = byText;
        } else {
          // Fallback por UUID
          const { data: byUuid } = await supabase
            .from("clientes_sessoes")
            .select("session_id, cliente_id")
            .eq("id", cobranca.session_id)
            .maybeSingle();

          if (byUuid) {
            session = byUuid;
          }
        }

        if (session) {
          const { error: txError } = await supabase
            .from("clientes_transacoes")
            .insert({
              user_id: cobranca.user_id,
              cliente_id: session.cliente_id || cobranca.cliente_id,
              session_id: session.session_id, // Usar session_id TEXTO
              valor: cobranca.valor,
              tipo: "pagamento",
              data_transacao: now.split("T")[0],
              descricao: `Pagamento verificado manualmente - ${cobranca.descricao || "Link"}`,
            });

          if (txError) {
            console.error("[check-payment-status] Error creating transaction:", txError);
          } else {
            console.log(`[check-payment-status] Transaction created for session ${session.session_id}`);
          }
        } else {
          console.warn(`[check-payment-status] Session not found for: ${cobranca.session_id}`);
          
          // Fallback: criar transação sem session_id
          const { error: txError } = await supabase
            .from("clientes_transacoes")
            .insert({
              user_id: cobranca.user_id,
              cliente_id: cobranca.cliente_id,
              session_id: null,
              valor: cobranca.valor,
              tipo: "pagamento",
              data_transacao: now.split("T")[0],
              descricao: `Pagamento verificado manualmente - ${cobranca.descricao || "Link"}`,
            });

          if (txError) {
            console.error("[check-payment-status] Error creating fallback transaction:", txError);
          }
        }
      }

      return new Response(
        JSON.stringify({ 
          found: true, 
          status: "pago", 
          updated: true, 
          source: "manual_verification",
          cobrancaId: cobranca.id 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Retornar status atual sem modificar
    return new Response(
      JSON.stringify({ 
        found: true, 
        status: cobranca.status, 
        updated: false,
        cobranca: {
          id: cobranca.id,
          valor: cobranca.valor,
          status: cobranca.status,
          provedor: cobranca.provedor,
          createdAt: cobranca.created_at,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("[check-payment-status] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
