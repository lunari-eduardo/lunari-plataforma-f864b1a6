import { supabase } from "@/integrations/supabase/client";
import type { EstruturaCustosFixos, GastoItem, Equipamento } from "@/types/precificacao";

export async function syncGastosPessoais(userId: string, gastos: GastoItem[]): Promise<void> {
  console.log("🔄 Sincronizando gastos pessoais:", gastos?.length || 0);

  // Estratégia: delete-all + insert-all (mais confiável que upsert)
  const { error: deleteError } = await supabase
    .from("pricing_gastos_pessoais")
    .delete()
    .eq("user_id", userId);

  if (deleteError) {
    console.error("❌ Erro ao deletar gastos pessoais:", deleteError);
    throw deleteError;
  }

  // Inserir todos novamente
  if (gastos && gastos.length > 0) {
    const gastosParaInserir = gastos.map((g) => ({
      id: g.id,
      user_id: userId,
      descricao: g.descricao,
      valor: g.valor,
    }));

    const { error: insertError } = await supabase
      .from("pricing_gastos_pessoais")
      .insert(gastosParaInserir);

    if (insertError) {
      console.error("❌ Erro ao inserir gastos pessoais:", insertError);
      throw insertError;
    }
    console.log("✅ Gastos pessoais salvos:", gastos.length);
  }
}

export async function syncCustosEstudio(userId: string, custos: GastoItem[]): Promise<void> {
  console.log("🔄 Sincronizando custos de estúdio:", custos?.length || 0);

  // Estratégia: delete-all + insert-all (mais confiável que upsert)
  const { error: deleteError } = await supabase
    .from("pricing_custos_estudio")
    .delete()
    .eq("user_id", userId);

  if (deleteError) {
    console.error("❌ Erro ao deletar custos de estúdio:", deleteError);
    throw deleteError;
  }

  // Inserir todos novamente
  if (custos && custos.length > 0) {
    const custosParaInserir = custos.map((c) => ({
      id: c.id,
      user_id: userId,
      descricao: c.descricao,
      valor: c.valor,
      origem: "manual",
    }));

    const { error: insertError } = await supabase
      .from("pricing_custos_estudio")
      .insert(custosParaInserir);

    if (insertError) {
      console.error("❌ Erro ao inserir custos de estúdio:", insertError);
      throw insertError;
    }
    console.log("✅ Custos de estúdio salvos:", custos.length);
  }
}

export async function syncEquipamentos(userId: string, equipamentos: Equipamento[]): Promise<void> {
  console.log("🔧 ====== SYNC EQUIPAMENTOS ======");
  console.log("🔧 User ID:", userId);
  console.log("🔧 Quantidade:", equipamentos?.length || 0);

  // Estratégia: delete-all + insert-all (mais confiável que upsert com onConflict)
  const { error: deleteError } = await supabase
    .from("pricing_equipamentos")
    .delete()
    .eq("user_id", userId);

  if (deleteError) {
    console.error("❌ Erro ao deletar equipamentos:", deleteError);
    throw deleteError;
  }
  console.log("🗑️ Equipamentos antigos deletados");

  // Inserir todos novamente
  if (equipamentos && equipamentos.length > 0) {
    const equipamentosParaInserir = equipamentos.map((eq) => ({
      id: eq.id,
      user_id: userId,
      nome: eq.nome,
      valor_pago: eq.valorPago,
      data_compra: eq.dataCompra || new Date().toISOString().split("T")[0],
      vida_util: eq.vidaUtil || 5,
      fin_transaction_id: eq.fin_transaction_id || null,
    }));

    console.log("📦 Equipamentos a inserir:", JSON.stringify(equipamentosParaInserir, null, 2));

    const { data: insertedData, error: insertError } = await supabase
      .from("pricing_equipamentos")
      .insert(equipamentosParaInserir)
      .select();

    if (insertError) {
      console.error("❌ Erro ao inserir equipamentos:", insertError);
      throw insertError;
    }
    console.log("✅ Equipamentos inseridos com sucesso:", insertedData?.length || 0);
    console.log("✅ Dados inseridos:", JSON.stringify(insertedData, null, 2));
  } else {
    console.log("ℹ️ Nenhum equipamento para inserir");
  }
  console.log("🔧 ====== FIM SYNC EQUIPAMENTOS ======");
}

export function createDefaultEstruturaCustos(userId?: string | null): EstruturaCustosFixos {
  return {
    gastosPessoais: [],
    percentualProLabore: 30,
    custosEstudio: [],
    equipamentos: [],
    totalCalculado: 0,
    user_id: userId || undefined,
    created_at: new Date().toISOString(),
  };
}

export function validateEstruturaCustos(dados: EstruturaCustosFixos): string[] {
  const erros: string[] = [];

  if (dados.percentualProLabore < 0 || dados.percentualProLabore > 200) {
    erros.push("Percentual de pró-labore deve estar entre 0% e 200%");
  }

  dados.gastosPessoais.forEach((gasto, index) => {
    if (!gasto.descricao?.trim()) {
      erros.push(`Gasto pessoal ${index + 1}: Descrição é obrigatória`);
    }
    if (gasto.valor < 0) {
      erros.push(`Gasto pessoal ${index + 1}: Valor não pode ser negativo`);
    }
  });

  dados.equipamentos.forEach((eq, index) => {
    if (!eq.nome?.trim()) {
      erros.push(`Equipamento ${index + 1}: Nome é obrigatório`);
    }
    if (eq.valorPago < 0) {
      erros.push(`Equipamento ${index + 1}: Valor pago não pode ser negativo`);
    }
    if (eq.vidaUtil <= 0) {
      erros.push(`Equipamento ${index + 1}: Vida útil deve ser maior que zero`);
    }
  });

  return erros;
}

export async function saveEstruturaCustos(userId: string, dados: EstruturaCustosFixos): Promise<boolean> {
  try {
    console.log("💾 ====== INÍCIO SALVAMENTO ESTRUTURA DE CUSTOS ======");
    console.log("💾 User ID:", userId);
    console.log("💾 Pró-labore:", dados.percentualProLabore, "%");
    console.log("💾 Gastos Pessoais:", dados.gastosPessoais?.length || 0);
    console.log("💾 Custos Estúdio:", dados.custosEstudio?.length || 0);
    console.log("💾 Equipamentos:", dados.equipamentos?.length || 0);

    if (dados.equipamentos && dados.equipamentos.length > 0) {
      console.log("💾 Detalhes equipamentos:", JSON.stringify(dados.equipamentos, null, 2));
    }

    // 1. Upsert configurações (pró-labore)
    const { error: configError } = await supabase
      .from("pricing_configuracoes")
      .upsert(
        {
          user_id: userId,
          percentual_pro_labore: dados.percentualProLabore,
        },
        { onConflict: "user_id" },
      );

    if (configError) {
      console.error("❌ Erro ao salvar pró-labore:", configError);
      throw configError;
    }
    console.log("✅ Pró-labore salvo:", dados.percentualProLabore, "%");

    // 2. Sincronizar gastos pessoais
    await syncGastosPessoais(userId, dados.gastosPessoais);

    // 3. Sincronizar custos de estúdio
    await syncCustosEstudio(userId, dados.custosEstudio);

    // 4. Sincronizar equipamentos
    await syncEquipamentos(userId, dados.equipamentos);

    console.log("💾 ====== FIM SALVAMENTO - SUCESSO ======");
    return true;
  } catch (error) {
    console.error("❌ ====== ERRO NO SALVAMENTO ======");
    console.error("❌ Erro:", error);
    return false;
  }
}

export async function loadEstruturaCustos(userId: string): Promise<EstruturaCustosFixos> {
  try {
    // Buscar tudo em paralelo
    const [configRes, gastosRes, custosRes, equipamentosRes] = await Promise.all([
      supabase.from("pricing_configuracoes").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("pricing_gastos_pessoais").select("*").eq("user_id", userId),
      supabase.from("pricing_custos_estudio").select("*").eq("user_id", userId),
      supabase.from("pricing_equipamentos").select("*").eq("user_id", userId),
    ]);

    const config = configRes.data;
    const gastos = (gastosRes.data || []).map((g) => ({
      id: g.id,
      descricao: g.descricao,
      valor: Number(g.valor),
      user_id: g.user_id,
      created_at: g.created_at,
      updated_at: g.updated_at,
    })) as GastoItem[];

    const custos = (custosRes.data || []).map((c) => ({
      id: c.id,
      descricao: c.descricao,
      valor: Number(c.valor),
      user_id: c.user_id,
      created_at: c.created_at,
      updated_at: c.updated_at,
    })) as GastoItem[];

    const equipamentos = (equipamentosRes.data || []).map((eq) => ({
      id: eq.id,
      nome: eq.nome,
      valorPago: Number(eq.valor_pago),
      dataCompra: eq.data_compra,
      vidaUtil: eq.vida_util,
      fin_transaction_id: eq.fin_transaction_id || undefined,
      user_id: eq.user_id,
      created_at: eq.created_at,
      updated_at: eq.updated_at,
    })) as Equipamento[];

    // Calcular total
    const totalGastos = gastos.reduce((sum, g) => sum + g.valor, 0);
    const percentualProLabore = config?.percentual_pro_labore || 30;
    const proLaboreCalculado = totalGastos * (1 + percentualProLabore / 100);
    const totalCustos = custos.reduce((sum, c) => sum + c.valor, 0);
    const totalDepreciacao = equipamentos.reduce(
      (sum, eq) => sum + eq.valorPago / (eq.vidaUtil * 12),
      0,
    );
    const totalCalculado = proLaboreCalculado + totalCustos + totalDepreciacao;

    return {
      gastosPessoais: gastos,
      percentualProLabore,
      custosEstudio: custos,
      equipamentos,
      totalCalculado,
      user_id: userId,
      created_at: config?.created_at,
      updated_at: config?.updated_at,
    };
  } catch (error) {
    console.error("❌ Erro ao carregar estrutura de custos:", error);
    return createDefaultEstruturaCustos(userId);
  }
}
