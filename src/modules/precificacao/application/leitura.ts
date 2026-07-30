/**
 * Capabilities de LEITURA — módulo Precificação (Bloco B2).
 *
 * Projeção sobre `modelo_de_preco`, `tabelas_precos`, `pacotes`,
 * `pricing_configuracoes`, `pricing_gastos_pessoais`, `pricing_custos_estudio`,
 * `pricing_equipamentos`, `pricing_calculadora_estados` e `metas_personalizadas`.
 *
 * RLS por `user_id` — nenhuma query filtra usuário manualmente.
 * Nada aqui escreve: leitura é sempre segura para o assistente.
 */
import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { supabase } from "@/integrations/supabase/client";
import { domainError, err, ok } from "@/shared/result";
import {
  custoFixoMensal,
  depreciacaoMensal,
  horasMes,
  ordenarFaixas,
  round2,
} from "../domain/calculo";
import type { FaixaPreco, PricingModelo, TabelaPrecosResumo } from "../domain/types";

/* ============================ SCHEMAS ============================ */

export const FaixaSchema = z.object({
  min: z.number(),
  max: z.number().nullable(),
  valor: z.number(),
});

export const TabelaSchema = z.object({
  id: z.string(),
  nome: z.string(),
  tipo: z.enum(["global", "categoria"]),
  categoriaId: z.string().nullable(),
  usarValorFixoPacote: z.boolean(),
  faixas: z.array(FaixaSchema),
});

/* ============================ HELPERS ============================ */

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

export async function loadModelo(): Promise<PricingModelo> {
  const { data } = await supabase
    .from("modelo_de_preco")
    .select("modelo")
    .maybeSingle();
  const modelo = data?.modelo as PricingModelo | undefined;
  return modelo === "global" || modelo === "categoria" ? modelo : "fixo";
}

export async function loadTabelas(): Promise<TabelaPrecosResumo[]> {
  const { data, error } = await supabase
    .from("tabelas_precos")
    .select("id, nome, tipo, categoria_id, usar_valor_fixo_pacote, faixas")
    .order("tipo");
  if (error) throw new Error(error.message);
  return (data ?? []).map((t) => ({
    id: t.id as string,
    nome: (t.nome as string) ?? "Tabela",
    tipo: (t.tipo as string) === "categoria" ? ("categoria" as const) : ("global" as const),
    categoriaId: (t.categoria_id as string | null) ?? null,
    usarValorFixoPacote: Boolean(t.usar_valor_fixo_pacote),
    faixas: parseFaixas(t.faixas),
  }));
}

export interface EstruturaCustosLoaded {
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

export async function loadEstruturaCustos(): Promise<EstruturaCustosLoaded> {
  const [cfgRes, gastosRes, custosRes, equipRes] = await Promise.all([
    supabase
      .from("pricing_configuracoes")
      .select(
        "percentual_pro_labore, horas_disponiveis, dias_trabalhados, margem_lucro_desejada",
      )
      .maybeSingle(),
    supabase.from("pricing_gastos_pessoais").select("valor"),
    supabase.from("pricing_custos_estudio").select("valor"),
    supabase.from("pricing_equipamentos").select("valor_pago, vida_util"),
  ]);

  const firstError = cfgRes.error || gastosRes.error || custosRes.error || equipRes.error;
  if (firstError) throw new Error(firstError.message);

  const percentualProLabore = Number(cfgRes.data?.percentual_pro_labore ?? 0);
  const horasDia = Number(cfgRes.data?.horas_disponiveis ?? 8);
  const diasSemana = Number(cfgRes.data?.dias_trabalhados ?? 5);
  const margem = Number(cfgRes.data?.margem_lucro_desejada ?? 0);

  const totalGastosPessoais = (gastosRes.data ?? []).reduce(
    (s, g) => s + (Number(g.valor) || 0),
    0,
  );
  const totalCustosEstudio = (custosRes.data ?? []).reduce(
    (s, c) => s + (Number(c.valor) || 0),
    0,
  );
  const totalDepreciacaoMensal = (equipRes.data ?? []).reduce(
    (s, e) => s + depreciacaoMensal(Number(e.valor_pago) || 0, Number(e.vida_util) || 0),
    0,
  );

  const fixoMensal = custoFixoMensal({
    totalGastosPessoais,
    percentualProLabore,
    totalCustosEstudio,
    totalDepreciacaoMensal,
  });
  const hMes = horasMes(horasDia, diasSemana);

  return {
    totalGastosPessoais: round2(totalGastosPessoais),
    percentualProLabore,
    proLaboreCalculado: round2(totalGastosPessoais * (1 + percentualProLabore / 100)),
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

/* ========================== CAPABILITIES ========================== */

export const getConfiguracaoCap = defineQuery({
  id: "precificacao.getConfiguracao",
  title: "Ver configuração de precificação",
  description:
    "Retorna o modelo de preço ativo (fixo, tabela global ou tabela por categoria), horas produtivas, pró-labore e margem desejada.",
  input: z.object({}).strict(),
  output: z.object({
    modelo: z.enum(["fixo", "global", "categoria"]),
    hasTabelaGlobal: z.boolean(),
    categoriasComTabela: z.number(),
    horasDisponiveisDia: z.number(),
    diasTrabalhadosSemana: z.number(),
    horasMes: z.number(),
    percentualProLabore: z.number(),
    margemLucroDesejada: z.number(),
    custoPorHora: z.number(),
  }),
  permissions: [],
  handler: async () => {
    try {
      const [modelo, tabelas, estrutura] = await Promise.all([
        loadModelo(),
        loadTabelas(),
        loadEstruturaCustos(),
      ]);
      return ok({
        modelo,
        hasTabelaGlobal: tabelas.some((t) => t.tipo === "global"),
        categoriasComTabela: tabelas.filter((t) => t.tipo === "categoria").length,
        horasDisponiveisDia: estrutura.horasDisponiveisDia,
        diasTrabalhadosSemana: estrutura.diasTrabalhadosSemana,
        horasMes: estrutura.horasMes,
        percentualProLabore: estrutura.percentualProLabore,
        margemLucroDesejada: estrutura.margemLucroDesejada,
        custoPorHora: estrutura.custoPorHora,
      });
    } catch (e) {
      return err(domainError("DB", (e as Error).message));
    }
  },
});

export const getEstruturaCustosCap = defineQuery({
  id: "precificacao.getEstruturaCustos",
  title: "Ver estrutura de custos",
  description:
    "Retorna gastos pessoais, pró-labore, custos de estúdio, depreciação de equipamentos, custo fixo mensal e custo por hora.",
  input: z.object({}).strict(),
  output: z.object({
    totalGastosPessoais: z.number(),
    percentualProLabore: z.number(),
    proLaboreCalculado: z.number(),
    totalCustosEstudio: z.number(),
    totalDepreciacaoMensal: z.number(),
    custoFixoMensal: z.number(),
    horasMes: z.number(),
    custoPorHora: z.number(),
    contagens: z.object({
      gastosPessoais: z.number(),
      custosEstudio: z.number(),
      equipamentos: z.number(),
    }),
  }),
  permissions: [],
  handler: async () => {
    try {
      const e = await loadEstruturaCustos();
      return ok({
        totalGastosPessoais: e.totalGastosPessoais,
        percentualProLabore: e.percentualProLabore,
        proLaboreCalculado: e.proLaboreCalculado,
        totalCustosEstudio: e.totalCustosEstudio,
        totalDepreciacaoMensal: e.totalDepreciacaoMensal,
        custoFixoMensal: e.custoFixoMensal,
        horasMes: e.horasMes,
        custoPorHora: e.custoPorHora,
        contagens: e.contagens,
      });
    } catch (e) {
      return err(domainError("DB", (e as Error).message));
    }
  },
});

export const listTabelasCap = defineQuery({
  id: "precificacao.listTabelas",
  title: "Listar tabelas de preço de foto extra",
  description:
    "Lista a tabela global e as tabelas por categoria com suas faixas progressivas de valor por foto.",
  input: z.object({}).strict(),
  output: z.object({
    modelo: z.enum(["fixo", "global", "categoria"]),
    items: z.array(TabelaSchema),
  }),
  permissions: [],
  handler: async () => {
    try {
      const [modelo, items] = await Promise.all([loadModelo(), loadTabelas()]);
      return ok({ modelo, items });
    } catch (e) {
      return err(domainError("DB", (e as Error).message));
    }
  },
});

export const getTabelaCategoriaCap = defineQuery({
  id: "precificacao.getTabelaCategoria",
  title: "Ver tabela de preço de uma categoria",
  description: "Retorna as faixas progressivas configuradas para uma categoria específica.",
  input: z.object({ categoriaId: z.string() }).strict(),
  output: TabelaSchema.nullable(),
  permissions: [],
  handler: async ({ categoriaId }) => {
    try {
      const tabelas = await loadTabelas();
      return ok(
        tabelas.find((t) => t.tipo === "categoria" && t.categoriaId === categoriaId) ?? null,
      );
    } catch (e) {
      return err(domainError("DB", (e as Error).message));
    }
  },
});

export const listPacotesComPrecoCap = defineQuery({
  id: "precificacao.listPacotesComPreco",
  title: "Listar pacotes com preço",
  description:
    "Lista os pacotes do estúdio com valor base, valor da foto extra e quantidade de fotos incluídas.",
  input: z
    .object({ categoriaId: z.string().optional() })
    .strict(),
  output: z.object({
    items: z.array(
      z.object({
        id: z.string(),
        nome: z.string(),
        categoriaId: z.string().nullable(),
        valorBase: z.number(),
        valorFotoExtra: z.number(),
        fotosIncluidas: z.number(),
      }),
    ),
  }),
  permissions: [],
  handler: async ({ categoriaId }) => {
    let q = supabase
      .from("pacotes")
      .select("id, nome, categoria_id, valor_base, valor_foto_extra, fotos_incluidas")
      .order("nome");
    if (categoriaId) q = q.eq("categoria_id", categoriaId);
    const { data, error } = await q;
    if (error) return err(domainError("DB", error.message));
    return ok({
      items: (data ?? []).map((p) => ({
        id: p.id as string,
        nome: (p.nome as string) ?? "",
        categoriaId: (p.categoria_id as string | null) ?? null,
        valorBase: Number(p.valor_base) || 0,
        valorFotoExtra: Number(p.valor_foto_extra) || 0,
        fotosIncluidas: Number(p.fotos_incluidas) || 0,
      })),
    });
  },
});

export const getMetasCap = defineQuery({
  id: "precificacao.getMetas",
  title: "Ver metas de faturamento e lucro",
  description:
    "Retorna a margem desejada, as metas anuais e as metas personalizadas por mês/categoria.",
  input: z.object({ ano: z.number().int().optional() }).strict(),
  output: z.object({
    margemLucroDesejada: z.number(),
    anoMeta: z.number().nullable(),
    metaFaturamentoAnual: z.number(),
    metaLucroAnual: z.number(),
    usarMetasPersonalizadas: z.boolean(),
    personalizadas: z.array(
      z.object({
        ano: z.number(),
        mes: z.number().nullable(),
        categoria: z.string().nullable(),
        metaFaturamento: z.number(),
        metaLucro: z.number(),
      }),
    ),
  }),
  permissions: [],
  handler: async ({ ano }) => {
    const { data: cfg, error: cfgErr } = await supabase
      .from("pricing_configuracoes")
      .select(
        "margem_lucro_desejada, ano_meta, meta_faturamento_anual, meta_lucro_anual, usar_metas_personalizadas",
      )
      .maybeSingle();
    if (cfgErr) return err(domainError("DB", cfgErr.message));

    let q = supabase
      .from("metas_personalizadas")
      .select("ano, mes, categoria, meta_faturamento, meta_lucro")
      .order("ano")
      .order("mes");
    if (ano) q = q.eq("ano", ano);
    const { data: metas, error: metasErr } = await q;
    if (metasErr) return err(domainError("DB", metasErr.message));

    return ok({
      margemLucroDesejada: Number(cfg?.margem_lucro_desejada ?? 0),
      anoMeta: cfg?.ano_meta ?? null,
      metaFaturamentoAnual: Number(cfg?.meta_faturamento_anual ?? 0),
      metaLucroAnual: Number(cfg?.meta_lucro_anual ?? 0),
      usarMetasPersonalizadas: Boolean(cfg?.usar_metas_personalizadas),
      personalizadas: (metas ?? []).map((m) => ({
        ano: Number(m.ano),
        mes: m.mes === null || m.mes === undefined ? null : Number(m.mes),
        categoria: (m.categoria as string | null) ?? null,
        metaFaturamento: Number(m.meta_faturamento) || 0,
        metaLucro: Number(m.meta_lucro) || 0,
      })),
    });
  },
});

export const listCenariosCap = defineQuery({
  id: "precificacao.listCenarios",
  title: "Listar cenários salvos da calculadora",
  description:
    "Lista os cenários de precificação já salvos, com horas, markup, custo total e preço final.",
  input: z.object({ limit: z.number().int().positive().max(50).default(20) }).strict(),
  output: z.object({
    items: z.array(
      z.object({
        id: z.string(),
        nome: z.string().nullable(),
        horasEstimadas: z.number(),
        markup: z.number(),
        custoTotal: z.number(),
        precoFinal: z.number(),
        lucratividade: z.number(),
        isDefault: z.boolean(),
        updatedAt: z.string().nullable(),
      }),
    ),
  }),
  permissions: [],
  handler: async ({ limit }) => {
    const { data, error } = await supabase
      .from("pricing_calculadora_estados")
      .select(
        "id, nome, horas_estimadas, markup, custo_total_calculado, preco_final_calculado, lucratividade, is_default, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) return err(domainError("DB", error.message));
    return ok({
      items: (data ?? []).map((c) => ({
        id: c.id as string,
        nome: (c.nome as string | null) ?? null,
        horasEstimadas: Number(c.horas_estimadas) || 0,
        markup: Number(c.markup) || 0,
        custoTotal: Number(c.custo_total_calculado) || 0,
        precoFinal: Number(c.preco_final_calculado) || 0,
        lucratividade: Number(c.lucratividade) || 0,
        isDefault: Boolean(c.is_default),
        updatedAt: (c.updated_at as string | null) ?? null,
      })),
    });
  },
});

export const diagnosticoCap = defineQuery({
  id: "precificacao.diagnostico",
  title: "Diagnosticar precificação",
  description:
    "Aponta o que ainda falta configurar para o preço ser confiável: custos, horas, margem, tabela do modelo ativo e pacotes sem valor.",
  input: z.object({}).strict(),
  output: z.object({
    pronto: z.boolean(),
    problemas: z.array(z.string()),
    avisos: z.array(z.string()),
  }),
  permissions: [],
  handler: async () => {
    try {
      const [modelo, tabelas, estrutura] = await Promise.all([
        loadModelo(),
        loadTabelas(),
        loadEstruturaCustos(),
      ]);
      const problemas: string[] = [];
      const avisos: string[] = [];

      if (estrutura.custoFixoMensal <= 0) {
        problemas.push("Nenhum custo fixo cadastrado — o custo por hora fica zerado.");
      }
      if (estrutura.horasMes <= 0) {
        problemas.push("Horas produtivas não configuradas (horas por dia × dias por semana).");
      }
      if (estrutura.margemLucroDesejada <= 0) {
        avisos.push("Margem de lucro desejada não definida.");
      }
      if (modelo === "global" && !tabelas.some((t) => t.tipo === "global")) {
        problemas.push("Modelo é 'tabela global', mas nenhuma tabela global foi criada.");
      }
      if (modelo === "categoria" && tabelas.filter((t) => t.tipo === "categoria").length === 0) {
        problemas.push("Modelo é 'por categoria', mas nenhuma categoria tem tabela.");
      }

      const { data: pacotes } = await supabase
        .from("pacotes")
        .select("nome, valor_base, valor_foto_extra");
      const semBase = (pacotes ?? []).filter((p) => !(Number(p.valor_base) > 0));
      if (semBase.length > 0) {
        avisos.push(`${semBase.length} pacote(s) sem valor base definido.`);
      }
      if (modelo === "fixo") {
        const semExtra = (pacotes ?? []).filter((p) => !(Number(p.valor_foto_extra) > 0));
        if (semExtra.length > 0) {
          avisos.push(
            `${semExtra.length} pacote(s) sem valor de foto extra — no modelo fixo isso zera a cobrança de extras.`,
          );
        }
      }

      return ok({ pronto: problemas.length === 0, problemas, avisos });
    } catch (e) {
      return err(domainError("DB", (e as Error).message));
    }
  },
});
