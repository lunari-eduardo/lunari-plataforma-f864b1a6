import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { domainError, err, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";

/**
 * Capability `workflow.getSessionFinancials`
 * Wrapper direto da RPC `workflow_session_financials` — fonte única de
 * valores da sessão (base, extras, desconto, pago, pendente, crédito).
 * Toda decisão de cobrança/estorno/aplicação de crédito deve consultar
 * esta query antes.
 */
const Input = z.object({ sessionId: z.string().uuid() }).strict();

const Output = z.object({
  sessionId: z.string(),
  valorBase: z.number(),
  valorProdutos: z.number(),
  valorExtrasBruto: z.number(),
  valorExtrasComDesconto: z.number(),
  descontoProgressivo: z.number(),
  descontoManual: z.number(),
  valorAdicional: z.number(),
  valorTotal: z.number(),
  valorPago: z.number(),
  valorPendente: z.number(),
  qtdFotosExtra: z.number(),
  qtdExtrasGaleria: z.number(),
  creditoGerado: z.number(),
  creditoUtilizado: z.number(),
  creditoLiquido: z.number(),
  extrasPago: z.number(),
  extrasPendente: z.number(),
  extrasLiquido: z.number(),
  descontoAplicadoExtras: z.number(),
  pendenteSessao: z.number(),
});

export const getSessionFinancials = defineQuery({
  id: "workflow.getSessionFinancials",
  title: "Detalhamento financeiro da sessão",
  description:
    "Breakdown completo da sessão vindo da RPC workflow_session_financials: base, extras, desconto, pago, pendente, crédito.",
  input: Input,
  output: Output,
  permissions: ["workflow:read", "financeiro:read"],
  async handler({ sessionId }, ctx) {
    const { data, error } = await supabase.rpc("workflow_session_financials", {
      p_session_id: sessionId,
    });
    if (error) {
      ctx.log.error("RPC workflow_session_financials falhou", { error });
      return err(
        domainError("EXTERNAL", "Não foi possível ler o financeiro da sessão.", {
          retriable: true,
          cause: error,
        }),
      );
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return err(domainError("NOT_FOUND", "Sessão sem financeiro."));
    }
    const n = (v: unknown) => Number(v ?? 0);
    const pendente = n(row.valor_pendente);
    const extrasPend = n(row.extras_pendente);
    return ok({
      sessionId,
      valorBase: n(row.valor_base_pacote),
      valorProdutos: n(row.valor_produtos),
      valorExtrasBruto: n(row.valor_extras_bruto),
      valorExtrasComDesconto: n(row.valor_extras_com_desconto),
      descontoProgressivo: n(row.desconto_progressivo),
      descontoManual: n(row.desconto_manual),
      valorAdicional: n(row.valor_adicional),
      valorTotal: n(row.valor_total),
      valorPago: n(row.valor_pago),
      valorPendente: pendente,
      qtdFotosExtra: n(row.qtd_fotos_extra) | 0,
      qtdExtrasGaleria: n(row.qtd_extras_galeria) | 0,
      creditoGerado: n(row.credito_gerado),
      creditoUtilizado: n(row.credito_utilizado),
      creditoLiquido: n(row.credito_liquido),
      extrasPago: n(row.extras_pago),
      extrasPendente: extrasPend,
      extrasLiquido: n(row.extras_liquido),
      descontoAplicadoExtras: n(row.desconto_aplicado_extras),
      pendenteSessao: Math.max(0, pendente - extrasPend),
    });
  },
});
