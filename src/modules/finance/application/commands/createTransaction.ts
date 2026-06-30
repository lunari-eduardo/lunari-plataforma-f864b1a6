import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { domainError, err, isOk, ok } from "@/shared/result";
import { supabaseTransactionsRepo } from "../../infrastructure/supabase/transactionsRepo";
import { transactionsStore } from "../../presentation/store/transactionsStore";
import { resolveUserId } from "../_auth";

const FormaPagamento = z.enum([
  "dinheiro",
  "pix",
  "transferencia",
  "boleto",
  "cartao_debito",
  "cartao_credito",
]);

const Input = z
  .object({
    itemId: z.string().uuid(),
    valor: z.number().positive(),
    dataVencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /**
     * Só aplicado em `modo='unico'` — demais modos derivam competência por parcela.
     * Rejeitado via `superRefine` quando enviado em outro modo.
     */
    dataCompetencia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    observacoes: z.string().max(500).optional(),
    modo: z.enum(["unico", "parcelado", "recorrente", "cartao"]).default("unico"),
    formaPagamento: FormaPagamento.optional(),
    // Parcelado
    parcelaTotal: z.number().int().min(2).max(60).optional(),
    // Cartão
    cartaoId: z.string().uuid().optional(),
    dataCompra: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    // Recorrente
    diaVencimento: z.number().int().min(1).max(31).optional(),
    isValorFixo: z.boolean().optional(),
    source: z.enum(["user", "automation", "ai"]).default("user"),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.dataCompetencia && data.modo !== "unico") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dataCompetencia"],
        message: "dataCompetencia só é suportada no modo 'unico'.",
      });
    }
  });

const Output = z.object({ ids: z.array(z.string()), count: z.number() });

export const createTransaction = defineCommand({
  id: "finance.transaction.create",
  title: "Criar lançamento financeiro",
  description:
    "Cria lançamento financeiro (único, parcelado, recorrente ou cartão). Status é derivado pelo banco.",
  input: Input,
  output: Output,
  permissions: ["finance:write"],
  sideEffects: ["db:fin_transactions", "event:finance.transaction.created"],
  audit: "on-success",
  examples: [
    {
      nl: "Lançar R$ 250 de energia elétrica vencendo 10/07",
      input: {
        itemId: "00000000-0000-0000-0000-000000000000",
        valor: 250,
        dataVencimento: "2026-07-10",
        modo: "unico",
        source: "user",
      },
    },
  ],
  async handler(input, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;
    const userId = auth.value;

    try {
      let rows: Awaited<ReturnType<typeof supabaseTransactionsRepo.createSingle>>[] = [];

      if (input.modo === "parcelado") {
        if (!input.parcelaTotal) {
          return err(domainError("VALIDATION", "parcelaTotal obrigatório no modo parcelado."));
        }
        rows = await supabaseTransactionsRepo.createParcelado({
          itemId: input.itemId,
          valorTotal: input.valor,
          dataPrimeiraOcorrencia: input.dataVencimento,
          numeroDeParcelas: input.parcelaTotal,
          formaPagamento: input.formaPagamento ?? null,
          observacoes: input.observacoes,
        });
      } else if (input.modo === "recorrente") {
        const dia = input.diaVencimento ?? new Date(input.dataVencimento).getUTCDate();
        rows = await supabaseTransactionsRepo.createRecorrente({
          itemId: input.itemId,
          valor: input.valor,
          diaVencimento: dia,
          dataInicio: input.dataVencimento,
          isValorFixo: input.isValorFixo ?? true,
          observacoes: input.observacoes,
        });
      } else if (input.modo === "cartao") {
        if (!input.cartaoId) {
          return err(domainError("VALIDATION", "cartaoId obrigatório no modo cartão."));
        }
        rows = await supabaseTransactionsRepo.createCartao({
          itemId: input.itemId,
          valorTotal: input.valor,
          dataCompra: input.dataCompra ?? input.dataVencimento,
          cartaoId: input.cartaoId,
          numeroDeParcelas: input.parcelaTotal,
          observacoes: input.observacoes,
        });
      } else {
        const single = await supabaseTransactionsRepo.createSingle({
          itemId: input.itemId,
          valor: input.valor,
          dataVencimento: input.dataVencimento,
          dataCompetencia: input.dataCompetencia,
          observacoes: input.observacoes ?? null,
          formaPagamento: input.formaPagamento ?? null,
        });
        rows = [single];
      }

      if (ctx.runtime === "client") {
        try {
          for (const r of rows) transactionsStore.upsert(r);
        } catch {
          /* noop */
        }
      }

      const first = rows[0];
      if (first) {
        await ctx.emit("finance.transaction.created", {
          id: first.id,
          itemId: first.itemId,
          valor: first.valor,
          photographerId: userId,
          actor: input.source,
        });
      }

      return ok({ ids: rows.map((r) => r.id), count: rows.length });
    } catch (e) {
      ctx.log.error("falha ao criar lançamento", { e });
      return err(
        domainError("EXTERNAL", "Não foi possível criar o lançamento.", { cause: e, retriable: true }),
      );
    }
  },
});
