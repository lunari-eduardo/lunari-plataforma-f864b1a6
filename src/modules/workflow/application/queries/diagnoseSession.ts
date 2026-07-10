import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { domainError, err, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";

/**
 * Capability `workflow.diagnoseSession`
 *
 * Roda uma bateria de checagens em UMA sessão e devolve inconsistências
 * detectadas. Não corrige nada — sugere a capability apropriada.
 *
 * É o coração da experiência "Lu diagnostica" — o agente injeta os
 * findings no snapshot e propõe ao humano a correção via outra tool.
 */
const Input = z.object({ sessionId: z.string().uuid() }).strict();

const Finding = z.object({
  code: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  message: z.string(),
  suggestedCapability: z.string().nullable(),
  details: z.record(z.any()).optional(),
});

const Output = z.object({
  sessionId: z.string(),
  ok: z.boolean(),
  findings: z.array(Finding),
});

export const diagnoseSession = defineQuery({
  id: "workflow.diagnoseSession",
  title: "Diagnosticar inconsistências da sessão",
  description:
    "Checa FK de galeria, divergências de extras, cobranças órfãs, crédito não-conciliado e somatório de transações.",
  input: Input,
  output: Output,
  permissions: ["workflow:read"],
  async handler({ sessionId }, ctx) {
    const findings: z.infer<typeof Finding>[] = [];

    // 1. Sessão base
    const { data: sess, error: sessErr } = await supabase
      .from("clientes_sessoes")
      .select(
        "id, session_id, cliente_id, galeria_id, valor_total, valor_pago, qtd_fotos_extra, valor_foto_extra, regras_congeladas, user_id",
      )
      .eq("id", sessionId)
      .maybeSingle();
    if (sessErr || !sess) {
      return err(domainError("NOT_FOUND", "Sessão não encontrada.", { cause: sessErr }));
    }

    // 2. Financeiro RPC
    const { data: finData } = await supabase.rpc("workflow_session_financials", {
      p_session_id: sessionId,
    });
    const fin = Array.isArray(finData) ? finData[0] : finData;

    // 3. Galeria (se houver)
    let galeria: any = null;
    if (sess.galeria_id) {
      const { data: g } = await supabase
        .from("galerias")
        .select(
          "id, status, status_selecao, fotos_selecionadas, total_fotos_extras_vendidas, valor_foto_extra, expires_at, finalized_at, regras_congeladas",
        )
        .eq("id", sess.galeria_id)
        .maybeSingle();
      galeria = g;
      if (!g) {
        findings.push({
          code: "GALERIA_FK_QUEBRADA",
          severity: "critical",
          message: "galeria_id aponta para registro inexistente.",
          suggestedCapability: null,
        });
      }
    } else if (sess.session_id) {
      // Buscar galeria por slug/session_id text — FK ausente
      const { data: gBySlug } = await supabase
        .from("galerias")
        .select("id, status")
        .eq("session_id", sess.session_id)
        .eq("user_id", sess.user_id)
        .maybeSingle();
      if (gBySlug) {
        findings.push({
          code: "GALERIA_FK_AUSENTE",
          severity: "warning",
          message: `Existe galeria (${gBySlug.id}) para esta sessão via slug, mas galeria_id está NULL.`,
          suggestedCapability: null,
          details: { galleryId: gBySlug.id },
        });
      }
    }

    // 4. Divergência extras finalizados
    if (galeria && (galeria.status_selecao === "finalizada" || galeria.finalized_at)) {
      const selec = Number(galeria.fotos_selecionadas ?? 0);
      const vendidas = Number(galeria.total_fotos_extras_vendidas ?? 0);
      const naSessao = Number(sess.qtd_fotos_extra ?? 0);
      const esperado = Math.max(vendidas, selec);
      if (naSessao !== esperado && esperado > 0) {
        findings.push({
          code: "EXTRAS_DIVERGEM",
          severity: "warning",
          message: `Sessão registra ${naSessao} extras, galeria finalizada indica ${esperado}.`,
          suggestedCapability: "workflow.reconcileFotosExtras",
          details: { sessao: naSessao, galeria: esperado },
        });
      }
    }

    // 5. Preço de extra vs regras congeladas
    if (sess.regras_congeladas) {
      const rc = sess.regras_congeladas as any;
      const efetivo = Number(rc?.valorFotoExtraEfetivo ?? rc?.valorFotoExtra ?? 0);
      const atual = Number(sess.valor_foto_extra ?? 0);
      if (efetivo > 0 && atual > 0 && Math.abs(efetivo - atual) > 0.01) {
        findings.push({
          code: "PRECO_EXTRA_DIVERGE_REGRAS",
          severity: "critical",
          message: `valor_foto_extra=${atual} não bate com regras congeladas=${efetivo}.`,
          suggestedCapability: null,
          details: { atual, congelado: efetivo },
        });
      }
    }

    // 6. Cobranças pendentes com sessão paga
    const total = Number(sess.valor_total ?? 0);
    const pago = Number(sess.valor_pago ?? 0);
    if (total > 0 && pago >= total - 0.01) {
      const { data: cobs } = await supabase
        .from("cobrancas")
        .select("id, valor, status, finalidade")
        .eq("session_id", sess.session_id ?? "")
        .in("status", ["pendente", "parcialmente_pago"]);
      if (cobs && cobs.length > 0) {
        findings.push({
          code: "COBRANCA_ORFA",
          severity: "warning",
          message: `Sessão quitada mas ${cobs.length} cobrança(s) ainda aberta(s).`,
          suggestedCapability: null,
          details: { cobrancas: cobs.map((c) => c.id) },
        });
      }
    }

    // 7. Diferença pago-transações
    const { data: txs } = await supabase
      .from("clientes_transacoes")
      .select("valor, tipo")
      .eq("session_id", sess.session_id ?? "")
      .in("tipo", ["pagamento", "estorno", "ajuste"]);
    if (txs) {
      const soma = txs.reduce((a, t: any) => a + Number(t.valor ?? 0), 0);
      if (Math.abs(soma - pago) > 0.05) {
        findings.push({
          code: "SOMA_TRANSACOES_DIVERGE",
          severity: "warning",
          message: `Soma de transações (${soma.toFixed(2)}) diverge de valor_pago (${pago.toFixed(2)}).`,
          suggestedCapability: null,
          details: { soma, valor_pago: pago },
        });
      }
    }

    // 8. Crédito líquido não conciliado (informativo)
    const credLiq = Number(fin?.credito_liquido ?? 0);
    if (credLiq > 0.01) {
      findings.push({
        code: "CREDITO_LIQUIDO_POSITIVO",
        severity: "info",
        message: `Cliente tem R$${credLiq.toFixed(2)} de crédito líquido disponível.`,
        suggestedCapability: "finance.credit.apply",
      });
    }

    ctx.log.info("diagnose", { sessionId, findings: findings.length });
    return ok({ sessionId, ok: findings.filter((f) => f.severity !== "info").length === 0, findings });
  },
});
