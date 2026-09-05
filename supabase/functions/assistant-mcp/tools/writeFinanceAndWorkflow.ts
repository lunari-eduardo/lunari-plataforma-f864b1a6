// deno-lint-ignore-file no-explicit-any
import {
  GRUPOS_RECEITA,
  UUID_RE,
  WORKFLOW_EDITABLE,
  WORKFLOW_NUMERIC,
  WriteCfg,
  fail,
  money,
  needsInput,
  norm,
  ok,
  today,
} from "../types.ts";
import {
  resolveFinanceItem,
  resolveSessao,
} from "../resolvers.ts";

export const WRITE_FINANCE_AND_WORKFLOW_TOOLS: Record<string, WriteCfg> = {
  // ---------- FINANCEIRO ----------
  "lunari.finance.item.create": {
    requiresApproval: false,
    summarize: (a) => `Criar item financeiro "${a.nome ?? "?"}" (${a.grupo ?? "?"})`,
    handler: async (sb, uid, args) => {
      const nome = String(args.nome ?? "").trim();
      const grupo = String(args.grupo ?? "").trim();
      if (!nome || !grupo) return fail("Campos 'nome' e 'grupo' são obrigatórios.");
      const { data, error } = await sb.from("fin_items_master")
        .insert({ user_id: uid, nome, grupo_principal: grupo, ativo: true })
        .select("id,nome,grupo_principal").single();
      if (error) return fail(error.message);
      return ok({ item: data }, `Item "${data.nome}" criado em ${data.grupo_principal}.`);
    },
  },
  "lunari.finance.transaction.create": {
    requiresApproval: false,
    summarize: (a) =>
      `Lançar ${money(a.valor)}${a.item ? ` em "${a.item}"` : ""}${a.observacoes ? ` — ${a.observacoes}` : ""}`,
    handler: async (sb, uid, args) => {
      const valor = Number(args.valor);
      if (!Number.isFinite(valor) || valor <= 0) return fail("Campo 'valor' inválido.");
      const item = await resolveFinanceItem(sb, uid, args);
      if (item.error) return fail(item.error);
      const vencimento = String(args.dataVencimento ?? args.data ?? today());
      const payload: Record<string, unknown> = {
        user_id: uid,
        item_id: item.id,
        valor,
        data_vencimento: vencimento,
        data_competencia: args.dataCompetencia ? String(args.dataCompetencia) : vencimento,
        status: String(args.status ?? "Pago"),
        observacoes: args.observacoes ? String(args.observacoes).slice(0, 500) : null,
      };
      if (args.dataCompra) payload.data_compra = String(args.dataCompra);
      const { data, error } = await sb.from("fin_transactions").insert(payload)
        .select("id,valor,status,data_vencimento").single();
      if (error) return fail(error.message);
      const natureza = GRUPOS_RECEITA.includes(item.grupo ?? "") ? "Receita" : "Despesa";
      return ok(
        { transacao: data, item: { id: item.id, nome: item.nome, grupo: item.grupo } },
        `${natureza} de ${money(valor)} em "${item.nome}" lançada (${data.status}, venc. ${data.data_vencimento}).`,
      );
    },
  },
  "lunari.finance.transaction.markPaid": {
    requiresApproval: false,
    summarize: (a) => `Marcar lançamento ${a.id ?? "?"} como pago`,
    handler: async (sb, uid, args) => {
      const id = String(args.id ?? "");
      if (!id) return fail("Campo 'id' é obrigatório.");
      const upd: Record<string, unknown> = { status: "Pago" };
      if (args.dataPagamento) upd.data_vencimento = String(args.dataPagamento);
      const { data, error } = await sb.from("fin_transactions").update(upd)
        .eq("id", id).eq("user_id", uid).select("id,valor,status").maybeSingle();
      if (error) return fail(error.message);
      if (!data) return fail("Lançamento não encontrado.");
      return ok({ transacao: data }, `Lançamento de ${money(data.valor)} marcado como pago.`);
    },
  },
  "lunari.finance.transaction.delete": {
    requiresApproval: true,
    summarize: (a) => `Excluir lançamento financeiro ${a.id ?? "?"} (irreversível)`,
    handler: async (sb, uid, args) => {
      const id = String(args.id ?? "");
      if (!id) return fail("Campo 'id' é obrigatório.");
      const { error } = await sb.from("fin_transactions").delete().eq("id", id).eq("user_id", uid);
      if (error) return fail(error.message);
      return ok({ deleted: id }, "Lançamento excluído.");
    },
  },

  // ---------- WORKFLOW ----------
  "lunari.workflow.updateFields": {
    requiresApproval: false,
    summarize: (a) => `Atualizar dados da sessão ${a.sessionId ?? a.clienteNome ?? "?"}`,
    handler: async (sb, uid, args) => {
      const r = await resolveSessao(sb, uid, args);
      if (r.ask) return r.ask;
      if (r.error) return fail(r.error);
      const s = r.sessao!;
      const src = (args.fields ?? args) as Record<string, any>;
      const upd: Record<string, unknown> = {};
      for (const key of WORKFLOW_EDITABLE) {
        if (src[key] != null) upd[key] = WORKFLOW_NUMERIC.has(key) ? Number(src[key]) : String(src[key]);
      }
      if (src.qtd_fotos_extra != null) upd.qtd_fotos_extra = Math.max(0, Math.floor(Number(src.qtd_fotos_extra) || 0));
      if (!Object.keys(upd).length) {
        return fail(`Nada para atualizar. Campos aceitos: ${[...WORKFLOW_EDITABLE, "qtd_fotos_extra"].join(", ")}.`);
      }
      upd.updated_by = uid;
      const { error } = await sb.from("clientes_sessoes").update(upd).eq("id", s.id).eq("user_id", uid);
      if (error) return fail(error.message);
      const { data: novo } = await sb.from("clientes_sessoes")
        .select("id,session_id,status,valor_total,valor_pago,status_financeiro,desconto,valor_adicional")
        .eq("id", s.id).maybeSingle();
      return ok(
        { sessionId: s.id, changedKeys: Object.keys(upd).filter((k) => k !== "updated_by"), sessao: novo },
        `Sessão atualizada (${Object.keys(upd).filter((k) => k !== "updated_by").join(", ")}). Total ${money(novo?.valor_total)} · pago ${money(novo?.valor_pago)}.`,
      );
    },
  },
  "lunari.workflow.advanceCard": {
    requiresApproval: false,
    summarize: (a) => `Mover sessão ${a.sessionId ?? a.clienteNome ?? "?"} para "${a.toStatus ?? a.status ?? "?"}"`,
    handler: async (sb, uid, args) => {
      const toStatus = String(args.toStatus ?? args.status ?? "").trim();
      if (!toStatus) return fail("Campo 'toStatus' é obrigatório. Consulte lunari.workflow.statusOptions.");
      const r = await resolveSessao(sb, uid, args);
      if (r.ask) return r.ask;
      if (r.error) return fail(r.error);
      const s = r.sessao!;
      const { data: etapas } = await sb.from("etapas_trabalho").select("nome").eq("user_id", uid);
      const nomes = (etapas ?? []).map((e: any) => e.nome as string);
      const match = nomes.find((n) => norm(n) === norm(toStatus)) ?? nomes.find((n) => norm(n).includes(norm(toStatus)));
      if (nomes.length && !match) {
        return fail(`Etapa "${toStatus}" não existe. Etapas disponíveis: ${nomes.join(", ")}.`);
      }
      const destino = match ?? toStatus;
      if (norm(s.status) === norm(destino)) return ok({ sessionId: s.id, status: destino }, `Sessão já está em "${destino}".`);
      const { error } = await sb.from("clientes_sessoes")
        .update({ status: destino, updated_by: uid }).eq("id", s.id).eq("user_id", uid);
      if (error) return fail(error.message);
      return ok({ sessionId: s.id, fromStatus: s.status ?? null, toStatus: destino }, `Sessão movida de "${s.status ?? "—"}" para "${destino}".`);
    },
  },
  "lunari.workflow.addPayment": {
    requiresApproval: false,
    summarize: (a) => `Registrar pagamento de ${money(a.valor)} na sessão ${a.sessionId ?? a.clienteNome ?? "?"}`,
    handler: async (sb, uid, args) => {
      const r = await resolveSessao(sb, uid, args);
      if (r.ask) return r.ask;
      if (r.error) return fail(r.error);
      const s = r.sessao!;
      if (!s.session_id) return fail("Sessão sem session_id texto — registre o pagamento pelo app.");
      const valor = Number(args.valor);
      if (!(valor > 0)) {
        const pendente = (Number(s.valor_total) || 0) - (Number(s.valor_pago) || 0);
        return needsInput({
          missing: ["valor"],
          question: pendente > 0
            ? `Qual o valor do pagamento? O saldo pendente desta sessão é ${money(pendente)}.`
            : "Qual o valor do pagamento (em reais)?",
          options: pendente > 0
            ? [{ label: `Quitar o pendente (${money(pendente)})`, value: String(pendente) }]
            : [],
        });
      }

      const data = String(args.data ?? args.dataTransacao ?? today());
      const forma = String(args.formaPagamento ?? args.forma ?? "PIX");
      const paymentId = `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const intentKey = String(args.intentKey ?? `mcp:${s.session_id}:${valor}:${data}:${forma}`);

      // Idempotência: mesma intenção já lançada?
      const { data: dup } = await sb.from("clientes_transacoes")
        .select("id").eq("user_id", uid).eq("session_id", s.session_id).eq("tipo", "pagamento")
        .ilike("descricao", `%[INTENT:${intentKey}]%`).limit(1).maybeSingle();
      if (dup?.id) return ok({ sessionId: s.id, transactionId: dup.id, duplicate: true }, "Pagamento idêntico já registrado — nada foi duplicado.");

      const obs = String(args.descricao ?? args.observacoes ?? `Pagamento ${forma}`);
      const descricao = `${obs} [ID:${paymentId}] [INTENT:${intentKey}]`;
      const { data: inserted, error } = await sb.from("clientes_transacoes").insert({
        user_id: uid,
        cliente_id: s.cliente_id,
        session_id: s.session_id,
        tipo: "pagamento",
        valor,
        data_transacao: data,
        descricao,
        updated_by: uid,
      }).select("id").single();
      if (error) return fail(error.message);

      const { data: novo } = await sb.from("clientes_sessoes")
        .select("valor_total,valor_pago,status_financeiro").eq("id", s.id).maybeSingle();
      const pend = (Number(novo?.valor_total) || 0) - (Number(novo?.valor_pago) || 0);
      return ok(
        { sessionId: s.id, transactionId: inserted.id, valor, data, formaPagamento: forma, sessao: novo },
        `Pagamento de ${money(valor)} (${forma}) registrado em ${data}. Pago ${money(novo?.valor_pago)} de ${money(novo?.valor_total)} · pendente ${money(pend)}.`,
      );
    },
  },
  "lunari.workflow.refundPayment": {
    requiresApproval: true,
    summarize: (a) => `Estornar o pagamento ${a.transactionId ?? "?"} (cria transação espelhada)`,
    handler: async (sb, uid, args) => {
      const transactionId = String(args.transactionId ?? args.id ?? "");
      if (!UUID_RE.test(transactionId)) return fail("Campo 'transactionId' (UUID do pagamento) é obrigatório.");
      const { data: orig } = await sb.from("clientes_transacoes")
        .select("id,user_id,cliente_id,session_id,valor,tipo,descricao")
        .eq("id", transactionId).eq("user_id", uid).maybeSingle();
      if (!orig) return fail("Pagamento não encontrado.");
      if (orig.tipo !== "pagamento") return fail("Somente pagamentos podem ser estornados.");
      if (!(Number(orig.valor) > 0)) return fail("Pagamento sem valor positivo — nada a estornar.");
      const { data: jaEstornado } = await sb.from("clientes_transacoes")
        .select("id").eq("user_id", uid).eq("tipo", "estorno")
        .ilike("descricao", `%[ESTORNO_DE:${transactionId}]%`).limit(1).maybeSingle();
      if (jaEstornado?.id) return ok({ estornoId: jaEstornado.id, duplicate: true }, "Este pagamento já foi estornado.");
      const motivo = args.motivo ? String(args.motivo) : "Estorno via assistente";
      const { data: est, error } = await sb.from("clientes_transacoes").insert({
        user_id: uid,
        cliente_id: orig.cliente_id,
        session_id: orig.session_id,
        tipo: "estorno",
        valor: -Math.abs(Number(orig.valor)),
        data_transacao: today(),
        descricao: `${motivo} [ESTORNO_DE:${transactionId}]`,
        updated_by: uid,
      }).select("id").single();
      if (error) return fail(error.message);
      return ok(
        { transactionId, estornoId: est.id, valorEstornado: Number(orig.valor) },
        `Estorno de ${money(orig.valor)} registrado. Motivo: ${motivo}.`,
      );
    },
  },
  "lunari.workflow.deleteSession": {
    requiresApproval: true,
    summarize: (a) => `Excluir a sessão ${a.sessionId ?? a.clienteNome ?? "?"} e seus lançamentos (irreversível)`,
    handler: async (sb, uid, args) => {
      const r = await resolveSessao(sb, uid, args);
      if (r.ask) return r.ask;
      if (r.error) return fail(r.error);
      const s = r.sessao!;
      const { count } = await sb.from("clientes_transacoes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid).eq("session_id", s.session_id ?? "__none__");
      if ((count ?? 0) > 0 && !args.force) {
        return fail(
          `Esta sessão tem ${count} lançamento(s) financeiro(s) (${money(s.valor_pago)} pago). ` +
            "Reenvie com force=true para excluir sessão e lançamentos.",
        );
      }
      if (s.session_id) {
        await sb.from("clientes_transacoes").delete().eq("user_id", uid).eq("session_id", s.session_id);
      }
      const { error } = await sb.from("clientes_sessoes").delete().eq("id", s.id).eq("user_id", uid);
      if (error) return fail(error.message);
      return ok({ deleted: s.id, transacoesRemovidas: count ?? 0 }, `Sessão excluída (${count ?? 0} lançamento(s) removido(s)).`);
    },
  },
};
