import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { supabase } from "@/integrations/supabase/client";
import { domainError, err, ok } from "@/shared/result";
import { calcularPrecoFinal, round2, valorPorFoto } from "../../domain/calculo";
import type { Json } from "@/integrations/supabase/types";
import type { FaixaPreco } from "../../domain/types";
import { loadEstruturaCustos, loadModelo, loadTabelas } from "../leitura";
import {
  AVISO_CONGELAMENTO,
  DiffSchema,
  ProdutoInputSchema,
  CustoInputSchema,
  markupDaMargem,
  somaProdutos,
  somaCustos,
} from "./common";

/* ============================== PACOTE ============================== */

export const updatePacotePrecoCap = defineCommand({
  id: "precificacao.updatePacotePreco",
  title: "Alterar preço de um pacote",
  description:
    "Atualiza valor base, valor da foto extra e/ou fotos incluídas de um pacote. Requer aprovação.",
  input: z
    .object({
      pacoteId: z.string(),
      valorBase: z.number().nonnegative().optional(),
      valorFotoExtra: z.number().nonnegative().optional(),
      fotosIncluidas: z.number().int().nonnegative().optional(),
    })
    .strict(),
  output: z.object({
    id: z.string(),
    nome: z.string(),
    diff: DiffSchema,
    aviso: z.string(),
  }),
  permissions: [],
  sideEffects: ["db:pacotes"],
  handler: async ({ pacoteId, valorBase, valorFotoExtra, fotosIncluidas }) => {
    if (valorBase === undefined && valorFotoExtra === undefined && fotosIncluidas === undefined) {
      return err(domainError("VALIDATION", "Informe ao menos um valor para alterar."));
    }

    const { data: atual, error: readErr } = await supabase
      .from("pacotes")
      .select("id, nome, valor_base, valor_foto_extra, fotos_incluidas")
      .eq("id", pacoteId)
      .maybeSingle();
    if (readErr) return err(domainError("DB", readErr.message));
    if (!atual) return err(domainError("NOT_FOUND", "Pacote não encontrado."));

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const diff: Array<{ campo: string; de: string; para: string }> = [];

    if (valorBase !== undefined) {
      patch.valor_base = valorBase;
      diff.push({
        campo: "Valor base",
        de: String(round2(Number(atual.valor_base) || 0)),
        para: String(round2(valorBase)),
      });
    }
    if (valorFotoExtra !== undefined) {
      patch.valor_foto_extra = valorFotoExtra;
      diff.push({
        campo: "Valor foto extra",
        de: String(round2(Number(atual.valor_foto_extra) || 0)),
        para: String(round2(valorFotoExtra)),
      });
    }
    if (fotosIncluidas !== undefined) {
      patch.fotos_incluidas = fotosIncluidas;
      diff.push({
        campo: "Fotos incluídas",
        de: String(Number(atual.fotos_incluidas) || 0),
        para: String(fotosIncluidas),
      });
    }

    const { error } = await supabase.from("pacotes").update(patch).eq("id", pacoteId);
    if (error) return err(domainError("DB", error.message));

    return ok({
      id: atual.id as string,
      nome: (atual.nome as string) ?? "",
      diff,
      aviso: AVISO_CONGELAMENTO,
    });
  },
});

/* ==================== CRIAR PACOTE PRECIFICADO ==================== */

export const criarPacotePrecificadoCap = defineCommand({
  id: "precificacao.criarPacotePrecificado",
  title: "Criar pacote com preço calculado",
  description:
    "Calcula o preço a partir das horas, custo por hora e markup (ou margem desejada) e cria o pacote já precificado na categoria informada. Requer aprovação.",
  input: z
    .object({
      nome: z.string().min(1),
      categoriaId: z.string().uuid().optional(),
      categoria: z.string().optional(),
      criarCategoria: z.boolean().optional(),
      horasEstimadas: z.number().positive().optional(),
      markup: z.number().positive().optional(),
      margemDesejada: z.number().optional(),
      produtos: z.array(ProdutoInputSchema).optional(),
      custosExtras: z.array(CustoInputSchema).optional(),
      valorBase: z.number().nonnegative().optional(),
      arredondarPara: z.number().nonnegative().optional(),
      fotosIncluidas: z.number().int().nonnegative().optional(),
      valorFotoExtra: z.number().nonnegative().optional(),
    })
    .strict(),
  output: z.object({
    pacoteId: z.string(),
    nome: z.string(),
    valorBase: z.number(),
    valorFotoExtra: z.number(),
    custoTotal: z.number().nullable(),
    lucratividade: z.number().nullable(),
    aviso: z.string(),
  }),
  permissions: [],
  sideEffects: ["db:pacotes", "db:categorias"],
  handler: async (input, ctx) => {
    if (!ctx.user?.id) return err(domainError("UNAUTHORIZED", "Sessão expirada."));
    if (!input.valorBase && !input.horasEstimadas) {
      return err(domainError("VALIDATION", "Informe 'horasEstimadas' ou um 'valorBase' fechado."));
    }

    try {
      let categoriaId = input.categoriaId ?? null;
      if (!categoriaId && input.categoria) {
        const { data: cats } = await supabase.from("categorias").select("id, nome");
        const alvo = input.categoria.trim().toLowerCase();
        const achou = (cats ?? []).find((c) => String(c.nome).trim().toLowerCase() === alvo);
        if (achou) categoriaId = achou.id;
        else if (input.criarCategoria) {
          const { data: nova, error: catErr } = await supabase
            .from("categorias")
            .insert({ user_id: ctx.user.id, nome: input.categoria.trim() })
            .select("id")
            .single();
          if (catErr) return err(domainError("DB", catErr.message));
          categoriaId = nova.id;
        }
      }
      if (!categoriaId) {
        return err(
          domainError("VALIDATION", "Categoria não encontrada. Use criarCategoria=true para criá-la."),
        );
      }

      const { data: existentes } = await supabase
        .from("pacotes")
        .select("nome")
        .eq("categoria_id", categoriaId);
      const dup = (existentes ?? []).some(
        (p) => String(p.nome).trim().toLowerCase() === input.nome.trim().toLowerCase(),
      );
      if (dup) return err(domainError("CONFLICT", `Já existe um pacote "${input.nome}" nessa categoria.`));

      let valorBase = input.valorBase ?? 0;
      let custoTotal: number | null = null;
      let lucratividade: number | null = null;

      if (input.valorBase === undefined) {
        const estrutura = await loadEstruturaCustos();
        const markup =
          input.markup ??
          (input.margemDesejada ? markupDaMargem(input.margemDesejada) : null) ??
          markupDaMargem(estrutura.margemLucroDesejada) ??
          2;
        const calc = calcularPrecoFinal({
          horasEstimadas: input.horasEstimadas!,
          custoPorHora: estrutura.custoPorHora,
          markup,
          custoProdutos: somaProdutos(input.produtos),
          custosAdicionais: somaCustos(input.custosExtras),
        });
        custoTotal = calc.custoTotal;
        lucratividade = calc.lucratividade;
        valorBase = input.arredondarPara
          ? round2(Math.ceil(calc.precoFinal / input.arredondarPara) * input.arredondarPara)
          : calc.precoFinal;
      }

      let valorFotoExtra = input.valorFotoExtra ?? 0;
      if (input.valorFotoExtra === undefined) {
        const [modelo, tabelas] = await Promise.all([loadModelo(), loadTabelas()]);
        const tabela =
          modelo === "categoria"
            ? tabelas.find((t) => t.tipo === "categoria" && t.categoriaId === categoriaId)
            : modelo === "global"
              ? tabelas.find((t) => t.tipo === "global")
              : undefined;
        if (tabela && !tabela.usarValorFixoPacote) {
          valorFotoExtra = valorPorFoto(1, tabela.faixas as FaixaPreco[]);
        }
      }

      const { data: pacote, error } = await supabase
        .from("pacotes")
        .insert({
          user_id: ctx.user.id,
          nome: input.nome.trim(),
          categoria_id: categoriaId,
          valor_base: valorBase,
          valor_foto_extra: valorFotoExtra,
          fotos_incluidas: input.fotosIncluidas ?? 0,
        })
        .select("id, nome, valor_base, valor_foto_extra")
        .single();
      if (error) return err(domainError("DB", error.message));

      return ok({
        pacoteId: pacote.id,
        nome: pacote.nome,
        valorBase: Number(pacote.valor_base) || 0,
        valorFotoExtra: Number(pacote.valor_foto_extra) || 0,
        custoTotal,
        lucratividade,
        aviso: AVISO_CONGELAMENTO,
      });
    } catch (e) {
      return err(domainError("DB", (e as Error).message));
    }
  },
});

/* ======================== SALVAR CENÁRIO ======================== */

export const salvarCenarioCap = defineCommand({
  id: "precificacao.salvarCenario",
  title: "Salvar cenário da calculadora",
  description:
    "Calcula e salva um cenário de precificação (horas, markup, produtos e custos extras) sem alterar nenhum preço praticado.",
  input: z
    .object({
      nome: z.string().min(1),
      horasEstimadas: z.number().positive(),
      markup: z.number().positive().optional(),
      margemDesejada: z.number().optional(),
      produtos: z.array(ProdutoInputSchema).optional(),
      custosExtras: z.array(CustoInputSchema).optional(),
    })
    .strict(),
  output: z.object({
    cenarioId: z.string(),
    custoTotal: z.number(),
    precoFinal: z.number(),
    lucratividade: z.number(),
    markupUsado: z.number(),
    aviso: z.string(),
  }),
  permissions: [],
  sideEffects: ["db:pricing_calculadora_estados"],
  handler: async (input, ctx) => {
    if (!ctx.user?.id) return err(domainError("UNAUTHORIZED", "Sessão expirada."));
    try {
      const estrutura = await loadEstruturaCustos();
      const markup =
        input.markup ??
        (input.margemDesejada ? markupDaMargem(input.margemDesejada) : null) ??
        markupDaMargem(estrutura.margemLucroDesejada) ??
        2;
      const calc = calcularPrecoFinal({
        horasEstimadas: input.horasEstimadas,
        custoPorHora: estrutura.custoPorHora,
        markup,
        custoProdutos: somaProdutos(input.produtos),
        custosAdicionais: somaCustos(input.custosExtras),
      });

      const { data, error } = await supabase
        .from("pricing_calculadora_estados")
        .insert({
          user_id: ctx.user.id,
          nome: input.nome.trim(),
          horas_estimadas: input.horasEstimadas,
          markup,
          produtos: (input.produtos ?? []) as unknown as Json,
          custos_extras: (input.custosExtras ?? []) as unknown as Json,
          custo_total_calculado: calc.custoTotal,
          preco_final_calculado: calc.precoFinal,
          lucratividade: calc.lucratividade,
          is_default: false,
        })
        .select("id")
        .single();
      if (error) return err(domainError("DB", error.message));

      return ok({
        cenarioId: data.id,
        custoTotal: calc.custoTotal,
        precoFinal: calc.precoFinal,
        lucratividade: calc.lucratividade,
        markupUsado: markup,
        aviso: "Cenário salvo apenas como simulação — nenhum preço praticado foi alterado.",
      });
    } catch (e) {
      return err(domainError("DB", (e as Error).message));
    }
  },
});
