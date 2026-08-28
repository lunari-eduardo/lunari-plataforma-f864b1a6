// scripts/backfill_financeiro_asaas.ts
// Script para executar o backfill de cobranças e antecipações históricas
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getAsaasHeaders(userId: string) {
  const { data: integ } = await supabase
    .from("usuarios_integracoes")
    .select("access_token, dados_extras")
    .eq("user_id", userId)
    .eq("provedor", "asaas")
    .eq("status", "ativo")
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!integ?.access_token) return null;
  const env = (integ.dados_extras as any)?.environment === "production" ? "production" : "sandbox";
  return {
    apiKey: integ.access_token,
    baseUrl: env === "production" ? "https://api.asaas.com" : "https://api-sandbox.asaas.com",
  };
}

async function runBackfill() {
  console.log("Iniciando backfill financeiro - Fase 3...");

  // 1. Marcar transações legadas como 'migradas' (apenas para não aparecerem duplicadas)
  console.log("Marcando lançamentos antigos de gateway como migrados...");
  const { error: txError } = await supabase
    .from("clientes_transacoes")
    .update({ dados_extras: { migrado_para_gateway: true } })
    .eq("tipo", "pagamento")
    .ilike("descricao", "%cobranca%")
    .is("dados_extras->>migrado_para_gateway", null);

  if (txError) {
    console.error("Erro ao atualizar clientes_transacoes:", txError);
  }

  // 2. Processar cobranças Asaas pagas/antecipadas que não tenham recebido as novas colunas
  const { data: cobrancas, error: cobError } = await supabase
    .from("cobrancas")
    .select("id, user_id, provider_order_id, asaas_payment_id, status")
    .eq("provedor", "asaas")
    .in("status", ["pago", "parcialmente_pago"])
    .is("valor_principal", null);

  if (cobError) {
    console.error("Erro ao buscar cobranças:", cobError);
    return;
  }

  console.log(`Encontradas ${cobrancas?.length || 0} cobranças Asaas legadas para backfill.`);

  for (const cob of cobrancas || []) {
    const creds = await getAsaasHeaders(cob.user_id);
    if (!creds) {
      console.warn(`Sem credenciais para usuário ${cob.user_id}`);
      continue;
    }

    const asaasId = cob.provider_order_id || cob.asaas_payment_id;
    if (!asaasId) continue;

    // TODO: A lógica detalhada faria fetch na API do Asaas e criaria as parcelas 
    // e os registros na gateway_cash_movements. 
    // Como a instrução atual é apenas criar a base do script:
    
    console.log(`Processando cobrança ${cob.id} (Asaas: ${asaasId})...`);
    // Exemplo:
    // const res = await fetch(`${creds.baseUrl}/v3/payments/${asaasId}`, { headers: { access_token: creds.apiKey }});
    // const payment = await res.json();
    
    // Simular delay para não dar rate limit
    await sleep(200);
  }

  console.log("Backfill concluído!");
}

if (import.meta.main) {
  runBackfill();
}
