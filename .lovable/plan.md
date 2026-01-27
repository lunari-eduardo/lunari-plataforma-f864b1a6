
# Plano de Execução: Conformidade com Contrato Oficial InfinitePay

## Resumo das Correções

Este plano implementa as 4 correções obrigatórias identificadas na auditoria, mantendo compatibilidade total com Gallery e projetos futuros.

---

## Correção 1: Remover decisão baseada em formato de order_nsu

**Arquivo:** `supabase/functions/infinitepay-webhook/index.ts`

**Alteração:**
- Remover linha 29-30 (UUID_REGEX)
- Remover toda lógica condicional baseada em regex (linhas 79-98)

**Antes:**
```typescript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// ...
if (UUID_REGEX.test(order_nsu)) {
  // busca por id
}
```

**Depois:**
- Nenhum regex, nenhuma inferência de formato

---

## Correção 2: Corrigir ordem de busca (fixa conforme contrato)

**Arquivo:** `supabase/functions/infinitepay-webhook/index.ts`

**Ordem contratual obrigatória:**
```text
1º → Buscar por ip_order_nsu = order_nsu
2º → Fallback por id = order_nsu
```

**Implementação:**
```typescript
// ESTRATÉGIA DE BUSCA CONFORME CONTRATO
// 1º: SEMPRE buscar por ip_order_nsu primeiro
let cobranca = null;
let searchMethod = "";

console.log(`[infinitepay-webhook] 1st search: ip_order_nsu = ${order_nsu}`);
const { data: byNsu, error: nsuError } = await supabase
  .from("cobrancas")
  .select("*, clientes(nome)")
  .eq("ip_order_nsu", order_nsu)
  .eq("provedor", "infinitepay")
  .maybeSingle();

if (nsuError) {
  console.error("[infinitepay-webhook] Error searching by ip_order_nsu:", nsuError);
}

if (byNsu) {
  cobranca = byNsu;
  searchMethod = "by_ip_order_nsu";
  console.log(`[infinitepay-webhook] Found by ip_order_nsu: ${byNsu.id}`);
}

// 2º: Fallback por id (sem regex!)
if (!cobranca) {
  console.log(`[infinitepay-webhook] 2nd search (fallback): id = ${order_nsu}`);
  const { data: byId, error: idError } = await supabase
    .from("cobrancas")
    .select("*, clientes(nome)")
    .eq("id", order_nsu)
    .eq("provedor", "infinitepay")
    .maybeSingle();

  if (idError) {
    console.error("[infinitepay-webhook] Error searching by id:", idError);
  }

  if (byId) {
    cobranca = byId;
    searchMethod = "by_id";
    console.log(`[infinitepay-webhook] Found by id: ${byId.id}`);
  }
}
```

**Nota:** A busca por `id` com valor não-UUID simplesmente não retorna resultado (sem erro). Não é necessário regex.

---

## Correção 3: Garantir log do payload bruto ANTES de qualquer falha

**Arquivo:** `supabase/functions/infinitepay-webhook/index.ts`

**Problema atual:**
- Log acontece DEPOIS de `await req.json()` (linha 49)
- Se JSON for inválido, erro ocorre antes do log

**Solução:**
```typescript
serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 405 }
    );
  }

  // PASSO 1: Ler corpo como texto bruto ANTES de qualquer processamento
  let rawBody = "";
  try {
    rawBody = await req.text();
  } catch (readError) {
    rawBody = "FAILED_TO_READ_BODY";
    console.error("[infinitepay-webhook] Failed to read request body:", readError);
  }

  // PASSO 2: SEMPRE logar ANTES de tentar parse
  try {
    await supabase.from("webhook_logs").insert({
      provedor: "infinitepay",
      order_nsu: "pending_parse",
      payload: { raw: rawBody.substring(0, 10000) }, // Limitar tamanho
      headers: Object.fromEntries(req.headers.entries()),
      status: "received",
    });
  } catch (logError) {
    console.warn("[infinitepay-webhook] Failed to log webhook:", logError);
  }

  // PASSO 3: Agora tentar parse do JSON
  let payload: InfinitePayWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch (parseError) {
    console.error("[infinitepay-webhook] Invalid JSON:", parseError);
    
    // Atualizar log com erro
    await supabase
      .from("webhook_logs")
      .update({ status: "error", error_message: "Invalid JSON" })
      .eq("order_nsu", "pending_parse")
      .eq("provedor", "infinitepay")
      .order("created_at", { ascending: false })
      .limit(1);
    
    return new Response(
      JSON.stringify({ error: "Invalid JSON" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }

  // PASSO 4: Atualizar log com order_nsu real
  const { order_nsu } = payload;
  
  if (order_nsu) {
    await supabase
      .from("webhook_logs")
      .update({ order_nsu: order_nsu, payload: payload })
      .eq("order_nsu", "pending_parse")
      .eq("provedor", "infinitepay")
      .order("created_at", { ascending: false })
      .limit(1);
  }

  // ... resto do processamento ...
});
```

---

## Correção 4: Criar edge function check-payment-status

**Novo arquivo:** `supabase/functions/check-payment-status/index.ts`

**Propósito:** Fallback obrigatório para quando webhook falha

**Lógica de resolução:** Segue a mesma ordem do webhook (ip_order_nsu → id)

**Implementação:**
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    // 1. Buscar por cobrancaId (UUID do banco)
    if (cobrancaId) {
      // Primeiro tentar por ip_order_nsu
      const { data: byNsu } = await supabase
        .from("cobrancas")
        .select("*")
        .eq("ip_order_nsu", cobrancaId)
        .maybeSingle();

      if (byNsu) {
        cobranca = byNsu;
        searchMethod = "by_ip_order_nsu";
      } else {
        // Fallback por id
        const { data: byId } = await supabase
          .from("cobrancas")
          .select("*")
          .eq("id", cobrancaId)
          .maybeSingle();

        if (byId) {
          cobranca = byId;
          searchMethod = "by_id";
        }
      }
    }

    // 2. Buscar por orderNsu se não encontrou
    if (!cobranca && orderNsu) {
      const { data: byNsu } = await supabase
        .from("cobrancas")
        .select("*")
        .eq("ip_order_nsu", orderNsu)
        .maybeSingle();

      if (byNsu) {
        cobranca = byNsu;
        searchMethod = "by_ip_order_nsu";
      }
    }

    // 3. Buscar por sessionId se não encontrou
    if (!cobranca && sessionId) {
      const { data: bySession } = await supabase
        .from("cobrancas")
        .select("*")
        .eq("session_id", sessionId)
        .eq("status", "pendente")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (bySession) {
        cobranca = bySession;
        searchMethod = "by_session_id";
      }
    }

    if (!cobranca) {
      return new Response(
        JSON.stringify({ found: false, error: "Cobranca not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    console.log(`[check-payment-status] Found via ${searchMethod}: ${cobranca.id}, status: ${cobranca.status}`);

    // Se já está pago, retornar status
    if (cobranca.status === "pago") {
      return new Response(
        JSON.stringify({ found: true, status: "pago", updated: false, source: "already_paid" }),
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

      // Se tem sessão vinculada, criar transação
      if (cobranca.session_id) {
        // Buscar sessão para obter cliente_id
        const { data: session } = await supabase
          .from("clientes_sessoes")
          .select("session_id, cliente_id")
          .eq("session_id", cobranca.session_id)
          .maybeSingle();

        if (session) {
          const { error: txError } = await supabase
            .from("clientes_transacoes")
            .insert({
              user_id: cobranca.user_id,
              cliente_id: session.cliente_id || cobranca.cliente_id,
              session_id: session.session_id,
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
        }
      }

      console.log(`[check-payment-status] Cobranca ${cobranca.id} updated to 'pago' (manual verification)`);

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
```

---

## Correção 5: Adicionar config para check-payment-status

**Arquivo:** `supabase/config.toml`

**Adicionar:**
```toml
[functions.check-payment-status]
verify_jwt = false
```

---

## Resumo de Arquivos a Modificar

| Arquivo | Ação | Linhas Afetadas |
|---------|------|-----------------|
| `supabase/functions/infinitepay-webhook/index.ts` | Modificar | 29-30 (remover regex), 49-65 (log antes do parse), 79-118 (inverter ordem) |
| `supabase/functions/check-payment-status/index.ts` | **CRIAR** | Arquivo novo (~150 linhas) |
| `supabase/config.toml` | Adicionar | 1 seção nova |

---

## Validação Pós-Implementação

Após deploy, validar:

| Cenário | Entrada | Resultado Esperado |
|---------|---------|-------------------|
| order_nsu = UUID (Gestão) | `d2c5f4bd-5332-401e-b80b-fe56916792b7` | Encontra via ip_order_nsu OU fallback id |
| order_nsu = prefixado (Gallery) | `gallery-1769483972062-pj4o1d` | Encontra via ip_order_nsu |
| order_nsu inválido | `xyz-invalid` | Retorna 404 após ambas buscas |
| JSON inválido | `{malformed` | Log registrado, erro 400 |
| Webhook falhou | Botão "Verificar Status" | check-payment-status atualiza para pago |

---

## Compatibilidade

- **Gallery:** Funciona normalmente (busca por ip_order_nsu primeiro)
- **Gestão:** Funciona normalmente (ip_order_nsu = UUID, ou fallback por id)
- **Projetos futuros:** Qualquer formato de order_nsu será suportado
