/**
 * assistant-mcp/pricing.ts — matemática e loaders de Precificação para o bridge.
 *
 * Port Deno de `src/modules/precificacao/domain/calculo.ts` (funções puras,
 * idênticas) + loaders que rodam com service-role e SEMPRE filtram `user_id`.
 *
 * Nada aqui grava: os writes ficam no executor, para passar por escopo,
 * aprovação e auditoria.
 */
// deno-lint-ignore-file no-explicit-any
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface FaixaPreco { min: number; max: number | null; valor: number }
export type PricingModelo = "fixo" | "global" | "categoria";

export const round2 = (n: number): number => Math.round((Number(n) || 0) * 100) / 100;

export function ordenarFaixas(faixas: FaixaPreco[]): FaixaPreco[] {
  return [...(faixas ?? [])].sort((a, b) => a.min - b.min);
}

export function faixaPara(quantidade: number, faixas: FaixaPreco[]): FaixaPreco | null {
  if (quantidade <= 0) return null;
  const ordenadas = ordenarFaixas(faixas);
  for (const f of ordenadas) {
    if (quantidade >= f.min && (f.max === null || quantidade <= f.max)) return f;
  }
  return ordenadas[ordenadas.length - 1] ?? null;
}

export function valorPorFoto(quantidade: number, faixas: FaixaPreco[]): number {
  return faixaPara(quantidade, faixas)?.valor ?? 0;
}

export function depreciacaoMensal(valorPago: number, vidaUtilAnos: number): number {
  if (!vidaUtilAnos || vidaUtilAnos <= 0) return 0;
  return (Number(valorPago) || 0) / (vidaUtilAnos * 12);
}

export function horasMes(horasDia: number, diasSemana: number): number {
  return (Number(horasDia) || 0) * (Number(diasSemana) || 0) * 4;
}

export function custoFixoMensal(p: {
  totalGastosPessoais: number;
  percentualProLabore: number;
  totalCustosEstudio: number;
  totalDepreciacaoMensal: number;
}): number {
  const proLabore = (Number(p.totalGastosPessoais) || 0) * (1 + (Number(p.percentualProLabore) || 0) / 100);
  return proLabore + (Number(p.totalCustosEstudio) || 0) + (Number(p.totalDepreciacaoMensal) || 0);
}

export function calcularPrecoFinal(p: {
  horasEstimadas: number;
  custoPorHora: number;
  markup: number;
  custoProdutos: number;
  custosAdicionais: number;
}) {
  const custoHoras = (Number(p.horasEstimadas) || 0) * (Number(p.custoPorHora) || 0);
  const custoProdutos = Number(p.custoProdutos) || 0;
  const custosAdicionais = Number(p.custosAdicionais) || 0;
  const custoTotal = custoHoras + custoProdutos + custosAdicionais;
  const markup = Number(p.markup) || 0;
  const precoFinal = custoTotal * markup;
  const lucro = precoFinal - custoTotal;
  const lucratividade = precoFinal > 0 ? (lucro / precoFinal) * 100 : 0;
  return {
    custoTotal: round2(custoTotal),
    precoFinal: round2(precoFinal),
    lucratividade: round2(lucratividade),
    breakdown: {
      custoHoras: round2(custoHoras),
      custoProdutos: round2(custoProdutos),
      custosAdicionais: round2(custosAdicionais),
      lucroEstimado: round2(lucro),
    },
  };
}

export function validarFaixas(faixas: FaixaPreco[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!Array.isArray(faixas) || faixas.length === 0) {
    return { valid: false, errors: ["A tabela precisa de pelo menos uma faixa."] };
  }
  const ordenadas = ordenarFaixas(faixas);
  if (ordenadas[0].min !== 1) errors.push("A primeira faixa precisa começar em 1 foto.");
  ordenadas.forEach((f, i) => {
    if (!Number.isFinite(f.valor) || f.valor < 0) errors.push(`Faixa ${i + 1}: valor inválido.`);
    if (f.max !== null && f.max < f.min) errors.push(`Faixa ${i + 1}: o máximo não pode ser menor que o mínimo.`);
    if (i < ordenadas.length - 1) {
      const atual = ordenadas[i];
      const prox = ordenadas[i + 1];
      if (atual.max === null) errors.push(`Faixa ${i + 1}: só a última faixa pode ser aberta ("ou mais").`);
      else if (prox.min !== atual.max + 1) {
        errors.push(`Faixa ${i + 2}: deve começar em ${atual.max + 1} para não deixar buraco nem sobreposição.`);
      }
    }
  });
  if (ordenadas[ordenadas.length - 1].max !== null) {
    errors.push("A última faixa precisa ser aberta (sem máximo) para cobrir quantidades altas.");
  }
  return { valid: errors.length === 0, errors };
}

/** Markup derivado da margem de lucro desejada: markup = 1 / (1 − margem). */
export function markupDaMargem(margemPercentual: number): number | null {
  const m = Number(margemPercentual) || 0;
  if (m <= 0 || m >= 100) return null;
  return round2(1 / (1 - m / 100));
}

/* ============================ LOADERS ============================ */

export function parseFaixas(raw: unknown): FaixaPreco[] {
  if (!Array.isArray(raw)) return [];
  const out: FaixaPreco[] = [];
  for (const item of raw as Array<Record<string, unknown>>) {
    if (!item || typeof item !== "object") continue;
    const min = Number(item.min);
    const valor = Number(item.valor);
    if (!Number.isFinite(min) || !Number.isFinite(valor)) continue;
    const maxRaw = item.max;
    const max = maxRaw === null || maxRaw === undefined ? null : Number(maxRaw);
    out.push({ min, max: max !== null && Number.isFinite(max) ? max : null, valor });
  }
  return ordenarFaixas(out);
}

export interface TabelaResumo {
  id: string;
  nome: string;
  tipo: "global" | "categoria";
  categoriaId: string | null;
  usarValorFixoPacote: boolean;
  faixas: FaixaPreco[];
}

export async function loadModelo(sb: SupabaseClient, uid: string): Promise<PricingModelo> {
  const { data } = await sb.from("modelo_de_preco").select("modelo").eq("user_id", uid).maybeSingle();
  const m = data?.modelo as PricingModelo | undefined;
  return m === "global" || m === "categoria" ? m : "fixo";
}

export async function loadTabelas(sb: SupabaseClient, uid: string): Promise<TabelaResumo[]> {
  const { data, error } = await sb
    .from("tabelas_precos")
    .select("id, nome, tipo, categoria_id, usar_valor_fixo_pacote, faixas")
    .eq("user_id", uid)
    .order("tipo");
  if (error) throw new Error(error.message);
  return (data ?? []).map((t: any) => ({
    id: t.id,
    nome: t.nome ?? "Tabela",
    tipo: t.tipo === "categoria" ? "categoria" : "global",
    categoriaId: t.categoria_id ?? null,
    usarValorFixoPacote: Boolean(t.usar_valor_fixo_pacote),
    faixas: parseFaixas(t.faixas),
  }));
}

export interface EstruturaCustos {
  totalGastosPessoais: number;
  percentualProLabore: number;
  proLaboreCalculado: number;
  totalCustosEstudio: number;
  totalDepreciacaoMensal: number;
  custoFixoMensal: number;
  horasDisponiveisDia: number;
  diasTrabalhadosSemana: number;
  horasMes: number;
  custoPorHora: number;
  margemLucroDesejada: number;
  contagens: { gastosPessoais: number; custosEstudio: number; equipamentos: number };
}

export async function loadEstruturaCustos(sb: SupabaseClient, uid: string): Promise<EstruturaCustos> {
  const [cfgRes, gastosRes, custosRes, equipRes] = await Promise.all([
    sb.from("pricing_configuracoes")
      .select("percentual_pro_labore, horas_disponiveis, dias_trabalhados, margem_lucro_desejada")
      .eq("user_id", uid).maybeSingle(),
    sb.from("pricing_gastos_pessoais").select("valor").eq("user_id", uid),
    sb.from("pricing_custos_estudio").select("valor").eq("user_id", uid),
    sb.from("pricing_equipamentos").select("valor_pago, vida_util").eq("user_id", uid),
  ]);
  const firstError = cfgRes.error || gastosRes.error || custosRes.error || equipRes.error;
  if (firstError) throw new Error(firstError.message);

  const percentualProLabore = Number(cfgRes.data?.percentual_pro_labore ?? 0);
  const horasDia = Number(cfgRes.data?.horas_disponiveis ?? 8);
  const diasSemana = Number(cfgRes.data?.dias_trabalhados ?? 5);
  const margem = Number(cfgRes.data?.margem_lucro_desejada ?? 0);

  const totalGastosPessoais = (gastosRes.data ?? []).reduce((s: number, g: any) => s + (Number(g.valor) || 0), 0);
  const totalCustosEstudio = (custosRes.data ?? []).reduce((s: number, c: any) => s + (Number(c.valor) || 0), 0);
  const totalDepreciacaoMensal = (equipRes.data ?? []).reduce(
    (s: number, e: any) => s + depreciacaoMensal(Number(e.valor_pago) || 0, Number(e.vida_util) || 0), 0,
  );

  const fixoMensal = custoFixoMensal({
    totalGastosPessoais, percentualProLabore, totalCustosEstudio, totalDepreciacaoMensal,
  });
  const hMes = horasMes(horasDia, diasSemana);

  return {
    totalGastosPessoais: round2(totalGastosPessoais),
    percentualProLabore,
    proLaboreCalculado: round2(totalGastosPessoais * (percentualProLabore / 100)),
    totalCustosEstudio: round2(totalCustosEstudio),
    totalDepreciacaoMensal: round2(totalDepreciacaoMensal),
    custoFixoMensal: round2(fixoMensal),
    horasDisponiveisDia: horasDia,
    diasTrabalhadosSemana: diasSemana,
    horasMes: hMes,
    custoPorHora: hMes > 0 ? round2(fixoMensal / hMes) : 0,
    margemLucroDesejada: margem,
    contagens: {
      gastosPessoais: gastosRes.data?.length ?? 0,
      custosEstudio: custosRes.data?.length ?? 0,
      equipamentos: equipRes.data?.length ?? 0,
    },
  };
}
