/**
 * Capabilities de SIMULAÇÃO — módulo Precificação (Bloco B2).
 *
 * Todas são LEITURA pura: leem a configuração atual, calculam e devolvem.
 * Nenhuma grava em banco, nem em cenário salvo. É o passo obrigatório antes
 * de qualquer escrita de preço (a Lu simula, mostra o diff, aí propõe aplicar).
 */
import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { supabase } from "@/integrations/supabase/client";
import { domainError, err, ok } from "@/shared/result";
import {
  calcularPrecoFinal,
  faixaPara,
  round2,
  validarFaixas,
  valorPorFoto,
} from "../domain/calculo";
import { FaixaSchema, loadEstruturaCustos, loadModelo, loadTabelas } from "./leitura";
import type { FaixaPreco } from "../domain/types";

/* ===================== SIMULAR PREÇO (CALCULADORA) ===================== */

export const simularPrecoCap = defineQuery({
  id: "precificacao.simularPreco",
  title: "Simular preço de um trabalho",
  description:
    "Calcula custo total, preço final e lucratividade a partir de horas estimadas, markup, produtos e custos extras — usando o custo por hora real do estúdio. Não salva nada.",
  input: z
    .object({
      horasEstimadas: z.number().nonnegative(),
      markup: z.number().positive().max(50).optional(),
      produtos: z
        .array(
          z.object({
            nome: z.string().optional(),
            custo: z.number().nonnegative(),
            quantidade: z.number().nonnegative().default(1),
          }),
        )
        .default([]),
      custosExtras: z
        .array(
          z.object({
            descricao: z.string().optional(),
            valorUnitario: z.number().nonnegative(),
            quantidade: z.number().nonnegative().default(1),
          }),
        )
        .default([]),
      custoPorHoraOverride: z.number().nonnegative().optional(),
    })
    .strict(),
  output: z.object({
    custoPorHora: z.number(),
    markupUsado: z.number(),
    custoTotal: z.number(),
    precoFinal: z.number(),
    lucratividade: z.number(),
    breakdown: z.object({
      custoHoras: z.number(),
      custoProdutos: z.number(),
      custosAdicionais: z.number(),
      lucroEstimado: z.number(),
    }),
    notas: z.array(z.string()),
  }),
  permissions: [],
  handler: async (input) => {
    try {
      const estrutura = await loadEstruturaCustos();
      const notas: string[] = [];
      const custoPorHora = input.custoPorHoraOverride ?? estrutura.custoPorHora;
      if (custoPorHora <= 0) {
        notas.push(
          "Custo por hora está zerado — cadastre custos fixos e horas produtivas para a simulação ser confiável.",
        );
      }
      const markup = input.markup ?? 2;
      if (!input.markup) notas.push("Markup não informado: usando 2x como referência.");

      const custoProdutos = input.produtos.reduce(
        (s, p) => s + p.custo * (p.quantidade ?? 1),
        0,
      );
      const custosAdicionais = input.custosExtras.reduce(
        (s, c) => s + c.valorUnitario * (c.quantidade ?? 1),
        0,
      );

      const r = calcularPrecoFinal({
        horasEstimadas: input.horasEstimadas,
        custoPorHora,
        markup,
        custoProdutos,
        custosAdicionais,
      });

      if (estrutura.margemLucroDesejada > 0 && r.lucratividade < estrutura.margemLucroDesejada) {
        notas.push(
          `Lucratividade de ${r.lucratividade}% está abaixo da margem desejada (${estrutura.margemLucroDesejada}%).`,
        );
      }

      return ok({
        custoPorHora: round2(custoPorHora),
        markupUsado: markup,
        custoTotal: r.custoTotal,
        precoFinal: r.precoFinal,
        lucratividade: r.lucratividade,
        breakdown: r.breakdown,
        notas,
      });
    } catch (e) {
      return err(domainError("DB", (e as Error).message));
    }
  },
});

/* ========================= SIMULAR FOTO EXTRA ========================= */

export const simularFotoExtraCap = defineQuery({
  id: "precificacao.simularFotoExtra",
  title: "Simular cobrança de fotos extras",
  description:
    "Dada uma quantidade de fotos extras (e opcionalmente pacote ou categoria), retorna valor unitário, total e a faixa aplicada segundo o modelo de preço ativo.",
  input: z
    .object({
      quantidade: z.number().int().positive(),
      pacoteId: z.string().optional(),
      categoriaId: z.string().optional(),
    })
    .strict(),
  output: z.object({
    modelo: z.enum(["fixo", "global", "categoria"]),
    quantidade: z.number(),
    valorUnitario: z.number(),
    valorTotal: z.number(),
    faixaAplicada: FaixaSchema.nullable(),
    tabelaUsada: z.string().nullable(),
    notas: z.array(z.string()),
  }),
  permissions: [],
  handler: async ({ quantidade, pacoteId, categoriaId }) => {
    try {
      const notas: string[] = [];
      const modelo = await loadModelo();

      let pacote: { valor_foto_extra: number; categoria_id: string | null } | null = null;
      if (pacoteId) {
        const { data, error } = await supabase
          .from("pacotes")
          .select("valor_foto_extra, categoria_id")
          .eq("id", pacoteId)
          .maybeSingle();
        if (error) return err(domainError("DB", error.message));
        if (!data) return err(domainError("NOT_FOUND", "Pacote não encontrado."));
        pacote = {
          valor_foto_extra: Number(data.valor_foto_extra) || 0,
          categoria_id: (data.categoria_id as string | null) ?? null,
        };
      }

      const catId = categoriaId ?? pacote?.categoria_id ?? null;

      if (modelo === "fixo") {
        const unit = pacote?.valor_foto_extra ?? 0;
        if (!pacoteId) {
          notas.push("Modelo fixo usa o valor do pacote — informe o pacote para um valor real.");
        }
        return ok({
          modelo,
          quantidade,
          valorUnitario: round2(unit),
          valorTotal: round2(unit * quantidade),
          faixaAplicada: null,
          tabelaUsada: null,
          notas,
        });
      }

      const tabelas = await loadTabelas();
      const tabela =
        modelo === "global"
          ? tabelas.find((t) => t.tipo === "global") ?? null
          : tabelas.find((t) => t.tipo === "categoria" && t.categoriaId === catId) ?? null;

      if (!tabela) {
        notas.push(
          modelo === "global"
            ? "Nenhuma tabela global configurada — a cobrança de extras ficaria zerada."
            : "Esta categoria não tem tabela configurada — a cobrança de extras ficaria zerada.",
        );
        return ok({
          modelo,
          quantidade,
          valorUnitario: 0,
          valorTotal: 0,
          faixaAplicada: null,
          tabelaUsada: null,
          notas,
        });
      }

      if (tabela.usarValorFixoPacote) {
        const unit = pacote?.valor_foto_extra ?? 0;
        notas.push("Tabela marcada para usar o valor fixo do pacote em vez das faixas.");
        return ok({
          modelo,
          quantidade,
          valorUnitario: round2(unit),
          valorTotal: round2(unit * quantidade),
          faixaAplicada: null,
          tabelaUsada: tabela.nome,
          notas,
        });
      }

      const unit = valorPorFoto(quantidade, tabela.faixas);
      return ok({
        modelo,
        quantidade,
        valorUnitario: round2(unit),
        valorTotal: round2(unit * quantidade),
        faixaAplicada: faixaPara(quantidade, tabela.faixas),
        tabelaUsada: tabela.nome,
        notas,
      });
    } catch (e) {
      return err(domainError("DB", (e as Error).message));
    }
  },
});

/* =========================== SIMULAR PACOTE =========================== */

export const simularPacoteCap = defineQuery({
  id: "precificacao.simularPacote",
  title: "Simular valor total de uma sessão",
  description:
    "Combina valor base do pacote, fotos extras (pelo modelo ativo), valor adicional e desconto para estimar o total ao cliente. Não cria sessão nem cobrança.",
  input: z
    .object({
      pacoteId: z.string(),
      fotosExtras: z.number().int().nonnegative().default(0),
      valorAdicional: z.number().nonnegative().default(0),
      desconto: z.number().nonnegative().default(0),
    })
    .strict(),
  output: z.object({
    pacote: z.object({ id: z.string(), nome: z.string(), valorBase: z.number() }),
    valorFotosExtras: z.number(),
    valorUnitarioFotoExtra: z.number(),
    valorAdicional: z.number(),
    desconto: z.number(),
    totalCliente: z.number(),
    notas: z.array(z.string()),
  }),
  permissions: [],
  handler: async ({ pacoteId, fotosExtras, valorAdicional, desconto }) => {
    try {
      const { data: pacote, error } = await supabase
        .from("pacotes")
        .select("id, nome, valor_base, valor_foto_extra, categoria_id")
        .eq("id", pacoteId)
        .maybeSingle();
      if (error) return err(domainError("DB", error.message));
      if (!pacote) return err(domainError("NOT_FOUND", "Pacote não encontrado."));

      const notas: string[] = [];
      const valorBase = Number(pacote.valor_base) || 0;
      let unit = 0;

      if (fotosExtras > 0) {
        const modelo = await loadModelo();
        if (modelo === "fixo") {
          unit = Number(pacote.valor_foto_extra) || 0;
        } else {
          const tabelas = await loadTabelas();
          const tabela =
            modelo === "global"
              ? tabelas.find((t) => t.tipo === "global")
              : tabelas.find(
                  (t) => t.tipo === "categoria" && t.categoriaId === pacote.categoria_id,
                );
          if (!tabela) {
            notas.push("Sem tabela para o modelo ativo — fotos extras calculadas como zero.");
          } else if (tabela.usarValorFixoPacote) {
            unit = Number(pacote.valor_foto_extra) || 0;
          } else {
            unit = valorPorFoto(fotosExtras, tabela.faixas);
          }
        }
      }

      const valorFotosExtras = unit * fotosExtras;
      const total = valorBase + valorFotosExtras + valorAdicional - desconto;
      if (total < 0) notas.push("O desconto informado deixa o total negativo.");

      return ok({
        pacote: { id: pacote.id as string, nome: (pacote.nome as string) ?? "", valorBase: round2(valorBase) },
        valorFotosExtras: round2(valorFotosExtras),
        valorUnitarioFotoExtra: round2(unit),
        valorAdicional: round2(valorAdicional),
        desconto: round2(desconto),
        totalCliente: round2(total),
        notas,
      });
    } catch (e) {
      return err(domainError("DB", (e as Error).message));
    }
  },
});

/* ====================== SIMULAR IMPACTO DE TABELA ====================== */

export const simularImpactoTabelaCap = defineQuery({
  id: "precificacao.simularImpactoTabela",
  title: "Simular impacto de uma nova tabela de preço",
  description:
    "Compara a tabela atual com uma proposta de faixas em quantidades típicas, mostrando o antes/depois por foto e no total. Nada é gravado — use antes de aplicar qualquer alteração.",
  input: z
    .object({
      escopo: z.enum(["global", "categoria"]).default("global"),
      categoriaId: z.string().optional(),
      faixas: z.array(FaixaSchema).min(1),
      quantidades: z.array(z.number().int().positive()).max(12).optional(),
    })
    .strict(),
  output: z.object({
    valida: z.boolean(),
    erros: z.array(z.string()),
    temTabelaAtual: z.boolean(),
    comparativo: z.array(
      z.object({
        quantidade: z.number(),
        unitarioAtual: z.number(),
        unitarioNovo: z.number(),
        totalAtual: z.number(),
        totalNovo: z.number(),
        variacaoPercentual: z.number(),
      }),
    ),
    notas: z.array(z.string()),
  }),
  permissions: [],
  handler: async ({ escopo, categoriaId, faixas, quantidades }) => {
    try {
      const novasFaixas = faixas as unknown as FaixaPreco[];
      const validacao = validarFaixas(novasFaixas);
      const notas: string[] = [
        "Alterar a tabela afeta apenas sessões novas — sessões existentes mantêm as regras congeladas.",
      ];

      if (escopo === "categoria" && !categoriaId) {
        return err(domainError("VALIDATION", "Informe a categoria para simular o escopo por categoria."));
      }

      const tabelas = await loadTabelas();
      const atual =
        escopo === "global"
          ? tabelas.find((t) => t.tipo === "global")
          : tabelas.find((t) => t.tipo === "categoria" && t.categoriaId === categoriaId);

      const qtds = quantidades && quantidades.length > 0 ? quantidades : [1, 5, 10, 20, 50];

      const comparativo = qtds.map((q) => {
        const unitAtual = atual ? valorPorFoto(q, atual.faixas) : 0;
        const unitNovo = valorPorFoto(q, novasFaixas);
        const totalAtual = unitAtual * q;
        const totalNovo = unitNovo * q;
        const variacao = totalAtual > 0 ? ((totalNovo - totalAtual) / totalAtual) * 100 : 0;
        return {
          quantidade: q,
          unitarioAtual: round2(unitAtual),
          unitarioNovo: round2(unitNovo),
          totalAtual: round2(totalAtual),
          totalNovo: round2(totalNovo),
          variacaoPercentual: round2(variacao),
        };
      });

      if (!atual) notas.push("Não existe tabela atual neste escopo — a comparação parte de zero.");

      return ok({
        valida: validacao.valid,
        erros: validacao.errors,
        temTabelaAtual: !!atual,
        comparativo,
        notas,
      });
    } catch (e) {
      return err(domainError("DB", (e as Error).message));
    }
  },
});
