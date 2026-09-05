// deno-lint-ignore-file no-explicit-any
import {
  Handler,
  addDays,
  clampLimit,
  fail,
  money,
  ok,
  today,
} from "../types.ts";
import {
  monthRange,
  projetarProdutos,
  resolveSessao,
} from "../resolvers.ts";

export const READ_WORKFLOW_TOOLS: Record<string, Handler> = {
  "lunari.workflow.search": async (sb, uid, args) => {
    let q = sb.from("clientes_sessoes")
      .select("id,session_id,cliente_id,data_sessao,categoria,pacote,status,valor_total,valor_pago,status_financeiro,descricao")
      .eq("user_id", uid).order("data_sessao", { ascending: false }).limit(clampLimit(args.limit, 20, 100));
    if (args.status) q = q.eq("status", String(args.status));
    if (args.categoria) q = q.eq("categoria", String(args.categoria));
    if (args.year && args.month) {
      const start = `${args.year}-${String(args.month).padStart(2, "0")}-01`;
      q = q.gte("data_sessao", start).lte("data_sessao", addDays(start, 31));
    }
    if (args.q) q = q.or(`descricao.ilike.%${args.q}%,pacote.ilike.%${args.q}%,categoria.ilike.%${args.q}%`);
    const { data, error } = await q;
    if (error) return fail(error.message);
    return ok({ sessoes: data ?? [] }, `${data?.length ?? 0} sessão(ões) encontradas.`);
  },
  "lunari.workflow.listMonth": async (sb, uid, args) => {
    const year = Number(args.year), month = Number(args.month);
    if (!year || !month) return fail("Campos 'year' e 'month' são obrigatórios.");
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const end = addDays(`${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, "0")}-01`, -1);
    const { data, error } = await sb.from("clientes_sessoes")
      .select("id,session_id,cliente_id,data_sessao,hora_sessao,categoria,pacote,status,valor_total,valor_pago,status_financeiro")
      .eq("user_id", uid).gte("data_sessao", start).lte("data_sessao", end).order("data_sessao").limit(500);
    if (error) return fail(error.message);
    const total = (data ?? []).reduce((s: number, r: any) => s + (Number(r.valor_total) || 0), 0);
    const pago = (data ?? []).reduce((s: number, r: any) => s + (Number(r.valor_pago) || 0), 0);
    return ok(
      { start, end, sessoes: data ?? [], totals: { valorTotal: total, valorPago: pago, pendente: total - pago } },
      `${data?.length ?? 0} sessão(ões) em ${start.slice(0, 7)} · total ${money(total)} · pago ${money(pago)}.`,
    );
  },
  "lunari.workflow.listRange": async (sb, uid, args) => {
    const start = String(args.startDate ?? args.start ?? today());
    const end = String(args.endDate ?? args.end ?? addDays(start, 30));
    const { data, error } = await sb.from("clientes_sessoes")
      .select("id,session_id,cliente_id,data_sessao,categoria,pacote,status,valor_total,valor_pago,status_financeiro")
      .eq("user_id", uid).gte("data_sessao", start).lte("data_sessao", end)
      .order("data_sessao").limit(clampLimit(args.limit, 500, 1000));
    if (error) return fail(error.message);
    return ok({ start, end, sessoes: data ?? [] }, `${data?.length ?? 0} sessão(ões) entre ${start} e ${end}.`);
  },
  "lunari.workflow.pendingPayments": async (sb, uid, args) => {
    const { data, error } = await sb.from("clientes_sessoes")
      .select("id,session_id,cliente_id,data_sessao,pacote,valor_total,valor_pago,status_financeiro")
      .eq("user_id", uid).neq("status_financeiro", "pago")
      .order("data_sessao", { ascending: false }).limit(clampLimit(args.limit, 50, 200));
    if (error) return fail(error.message);
    const pendente = (data ?? []).reduce((s: number, r: any) => s + ((Number(r.valor_total) || 0) - (Number(r.valor_pago) || 0)), 0);
    return ok({ sessoes: data ?? [], totalPendente: pendente }, `${data?.length ?? 0} sessão(ões) com ${money(pendente)} pendente(s).`);
  },
  "lunari.workflow.getCardBySession": async (sb, uid, args) => {
    const r = await resolveSessao(sb, uid, args);
    if (r.ask) return r.ask;
    if (r.error) return fail(r.error);
    const s = r.sessao!;
    const [{ data: fin }, { data: gal }] = await Promise.all([
      sb.rpc("workflow_session_financials", { p_session_id: s.id }),
      s.galeria_id
        ? sb.from("galerias").select("id,titulo,status,status_pagamento").eq("id", s.galeria_id).maybeSingle()
        : Promise.resolve({ data: null } as any),
    ]);
    const produtos = Array.isArray(s.produtos_incluidos) ? s.produtos_incluidos : [];
    return ok(
      {
        sessao: s,
        cliente: s.clientes ?? null,
        galeria: gal ?? null,
        financeiro: Array.isArray(fin) ? fin[0] ?? null : fin ?? null,
        produtos,
      },
      `Sessão ${s.session_id ?? s.id} · ${s.clientes?.nome ?? "sem cliente"} · ${s.data_sessao ?? "sem data"} · ` +
        `${s.status ?? "sem etapa"} · total ${money(s.valor_total)} · pago ${money(s.valor_pago)} · ` +
        `pendente ${money((Number(s.valor_total) || 0) - (Number(s.valor_pago) || 0))}.`,
    );
  },
  "lunari.workflow.getSessionFinancials": async (sb, uid, args) => {
    const r = await resolveSessao(sb, uid, args);
    if (r.ask) return r.ask;
    if (r.error) return fail(r.error);
    const s = r.sessao!;
    const { data, error } = await sb.rpc("workflow_session_financials", { p_session_id: s.id });
    if (error) return fail(error.message);
    const fin = Array.isArray(data) ? data[0] ?? null : data ?? null;
    const { data: pagamentos } = await sb.from("clientes_transacoes")
      .select("id,valor,tipo,data_transacao,descricao")
      .eq("user_id", uid).eq("session_id", s.session_id ?? "__none__")
      .order("data_transacao", { ascending: false }).limit(100);
    return ok(
      { sessionId: s.id, sessionKey: s.session_id, financeiro: fin, pagamentos: pagamentos ?? [] },
      `Total ${money(s.valor_total)} · pago ${money(s.valor_pago)} · pendente ${money((Number(s.valor_total) || 0) - (Number(s.valor_pago) || 0))} · ${pagamentos?.length ?? 0} lançamento(s).`,
    );
  },
  "lunari.workflow.listSessionsByPaymentStatus": async (sb, uid, args) => {
    const status = String(args.statusFinanceiro ?? args.status ?? "pendente");
    const { data, error } = await sb.from("clientes_sessoes")
      .select("id,session_id,cliente_id,data_sessao,pacote,status,valor_total,valor_pago,status_financeiro")
      .eq("user_id", uid).eq("status_financeiro", status)
      .order("data_sessao", { ascending: false }).limit(clampLimit(args.limit, 50, 200));
    if (error) return fail(error.message);
    return ok({ statusFinanceiro: status, sessoes: data ?? [] }, `${data?.length ?? 0} sessão(ões) com status financeiro "${status}".`);
  },
  "lunari.workflow.statusOptions": async (sb, uid) => {
    const { data, error } = await sb.from("etapas_trabalho")
      .select("nome,cor,ordem").eq("user_id", uid).order("ordem");
    if (error) return fail(error.message);
    const options = (data ?? []).map((r: any) => ({ value: r.nome, label: r.nome, color: r.cor ?? null, ordem: r.ordem ?? null }));
    return ok({ options }, options.length ? `Etapas: ${options.map((o: any) => o.value).join(" → ")}.` : "Nenhuma etapa configurada.");
  },
  "lunari.workflow.metricsForMonth": async (sb, uid, args) => {
    const { start, end } = monthRange(args);
    const { data, error } = await sb.rpc("workflow_month_metrics", { p_user_id: uid, p_start: start, p_end: end });
    if (error) return fail(error.message);
    const m = (Array.isArray(data) ? data[0] : data) ?? {};
    return ok(
      { start, end, metrics: m },
      `${start.slice(0, 7)}: ${m.sessoes ?? 0} sessão(ões) · previsto ${money(m.previsto)} · recebido ${money(m.receita)} · pendente ${money(m.pendente)}.`,
    );
  },
  "lunari.workflow.metricsForRange": async (sb, uid, args) => {
    const start = String(args.start ?? args.startDate ?? addDays(today(), -90));
    const end = String(args.end ?? args.endDate ?? today());
    const { data, error } = await sb.rpc("workflow_range_metrics", {
      p_user_id: uid, p_start: start, p_end: end,
      p_granularity: String(args.granularity ?? "month"),
      p_include_historico: Boolean(args.includeHistorico ?? false),
    });
    if (error) return fail(error.message);
    return ok({ start, end, metrics: data }, `Métricas de ${start} a ${end} calculadas.`);
  },
  "lunari.workflow.analytics.summary": async (sb, uid, args) => {
    const start = String(args.start ?? args.startDate ?? addDays(today(), -365));
    const end = String(args.end ?? args.endDate ?? today());
    const { data, error } = await sb.rpc("workflow_analytics_summary", {
      p_user_id: uid, p_start: start, p_end: end,
      p_include_historico: Boolean(args.includeHistorico ?? false),
    });
    if (error) return fail(error.message);
    const t = (data as any)?.totals ?? {};
    return ok(
      { start, end, summary: data },
      `${t.sessoes ?? 0} sessão(ões) de ${start} a ${end} · previsto ${money(t.previsto)} · receita ${money(t.receita)} · ticket médio ${money(t.ticket_medio)}.`,
    );
  },
  "lunari.workflow.photoProductionForMonth": async (sb, uid, args) => {
    const { start, end } = monthRange(args);
    const { data, error } = await sb.rpc("workflow_photo_production_month", {
      p_user_id: uid, p_start: start, p_end: end,
      p_categoria: args.categoria ? String(args.categoria) : null,
    });
    if (error) return fail(error.message);
    const row = (Array.isArray(data) ? data[0] : data) ?? {};
    return ok({ start, end, producao: data }, `Produção fotográfica de ${start.slice(0, 7)}: ${JSON.stringify(row).slice(0, 300)}`);
  },
  "lunari.workflow.photoProductionForYear": async (sb, uid, args) => {
    const year = Number(args.year ?? args.ano ?? new Date().getFullYear());
    const categoria = args.categoria ? String(args.categoria) : null;
    const n = (v: unknown) => Number(v) || 0;
    const porMes: any[] = [];
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, "0");
      const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
      const { data, error } = await sb.rpc("workflow_photo_production_month", {
        p_user_id: uid, p_start: `${year}-${mm}-01`, p_end: `${year}-${mm}-${String(last).padStart(2, "0")}`,
        p_categoria: categoria,
      });
      if (error) return fail(error.message);
      const r: any = (Array.isArray(data) ? data[0] : data) ?? {};
      porMes.push({
        mes: m,
        fotosIncluidas: Math.round(n(r.fotos_incluidas)),
        fotosExtras: Math.round(n(r.fotos_extras)),
        fotosTotal: Math.round(n(r.fotos_total)),
        sessoes: Math.round(n(r.sessoes_com_pacote)) + Math.round(n(r.sessoes_sem_pacote)),
        categoriaTop: r.categoria_top ?? null,
        fotosCategoriaTop: Math.round(n(r.fotos_categoria_top)),
      });
    }
    const sum = (k: string) => porMes.reduce((a, x) => a + (Number(x[k]) || 0), 0);
    const catMap = new Map<string, number>();
    for (const m of porMes) if (m.categoriaTop) catMap.set(m.categoriaTop, (catMap.get(m.categoriaTop) ?? 0) + m.fotosCategoriaTop);
    const top = [...catMap.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
    const sessoes = sum("sessoes");
    const total = {
      fotosIncluidas: sum("fotosIncluidas"), fotosExtras: sum("fotosExtras"), fotosTotal: sum("fotosTotal"),
      sessoes, mediaFotosPorSessao: sessoes > 0 ? Number((sum("fotosTotal") / sessoes).toFixed(2)) : 0,
      categoriaTop: top?.[0] ?? null, fotosCategoriaTop: top?.[1] ?? 0,
    };
    return ok(
      { year, total, porMes },
      `${year}: ${total.fotosTotal} foto(s) em ${sessoes} sessão(ões) · ${total.fotosIncluidas} inclusas + ${total.fotosExtras} extras · média ${total.mediaFotosPorSessao}/sessão${total.categoriaTop ? ` · categoria líder ${total.categoriaTop}` : ""}.`,
    );
  },
  "lunari.workflow.vendas.resumo": async (sb, uid, args) => {
    const ano = Number(args.ano ?? args.year ?? new Date().getFullYear());
    const mes = args.mes != null ? Number(args.mes) : (args.month != null ? Number(args.month) : null);
    const categoria = args.categoria ? String(args.categoria) : null;
    const { data, error } = await sb.rpc("sales_analytics_summary", {
      p_user_id: uid, p_year: ano, p_month: mes, p_categoria: categoria,
    });
    if (error) return fail(error.message);
    const t = (data as any)?.totais ?? {};
    const periodo = mes ? `${ano}-${String(mes).padStart(2, "0")}` : String(ano);
    return ok(
      { periodo, resumo: data },
      `${periodo}: ${t.sessoes ?? 0} sessão(ões) · receita ${money(t.receita_realizada)} de ${money(t.receita_prevista)} previstos · pendente ${money(t.pendente)} · ticket médio ${money(t.ticket_medio)} · fotos extras ${money(t.receita_fotos_extras)} · desconto ${money(t.desconto_total)} · ${t.clientes_unicos ?? 0} cliente(s).`,
    );
  },
  "lunari.workflow.vendas.compararAnos": async (sb, uid, args) => {
    const anoBase = Number(args.anoBase ?? new Date().getFullYear());
    const anoComparacao = Number(args.anoComparacao ?? anoBase - 1);
    const { data, error } = await sb.rpc("sales_analytics_compare", {
      p_user_id: uid, p_ano_base: anoBase, p_ano_comparacao: anoComparacao,
      p_limite_mes: args.limiteMes != null ? Number(args.limiteMes) : null,
      p_categoria: args.categoria ? String(args.categoria) : null,
    });
    if (error) return fail(error.message);
    const d = data as any;
    const v = d?.variacaoPercentual ?? {};
    return ok(
      { comparativo: data },
      `${anoBase} vs ${anoComparacao} (até o mês ${d?.limiteMes}): receita ${money(d?.base?.receita)} vs ${money(d?.comparacao?.receita)} (${v.receita ?? "—"}%) · sessões ${d?.base?.sessoes ?? 0} vs ${d?.comparacao?.sessoes ?? 0} (${v.sessoes ?? "—"}%) · ticket médio ${money(d?.base?.ticket_medio)} vs ${money(d?.comparacao?.ticket_medio)} (${v.ticketMedio ?? "—"}%).`,
    );
  },
  "lunari.workflow.vendas.metasProgresso": async (sb, uid, args) => {
    const ano = Number(args.ano ?? new Date().getFullYear());
    const mesRef = args.mes != null ? Number(args.mes) : new Date().getUTCMonth() + 1;
    const [resumoRes, cfgRes, metasRes] = await Promise.all([
      sb.rpc("sales_analytics_summary", { p_user_id: uid, p_year: ano, p_month: null, p_categoria: null }),
      sb.from("pricing_configuracoes").select("meta_faturamento_anual,ano_meta,modo_metas").eq("user_id", uid).maybeSingle(),
      sb.from("metas_personalizadas").select("mes,categoria,meta_faturamento").eq("user_id", uid).eq("ano", ano),
    ]);
    if (resumoRes.error) return fail(resumoRes.error.message);
    const resumo: any = resumoRes.data ?? {};
    const num = (v: unknown) => Number(v) || 0;
    const metas: any[] = (metasRes.data as any[]) ?? [];
    const metaAnualPers = metas.find((m) => !m.mes && !m.categoria)?.meta_faturamento;
    const metaAnual = num(metaAnualPers ?? (cfgRes.data as any)?.meta_faturamento_anual);
    const realizadoAno = num(resumo?.totais?.receita_realizada);
    const realizadoMes = num((resumo?.porMes ?? []).find((m: any) => Number(m.mes) === mesRef)?.receita);
    const metaMes = num(metas.find((m) => Number(m.mes) === mesRef && !m.categoria)?.meta_faturamento ?? (metaAnual > 0 ? metaAnual / 12 : 0));
    const mesesRestantes = Math.max(12 - mesRef + 1, 1);
    const gap = Math.max(metaAnual - realizadoAno, 0);
    const porCategoria = metas.filter((m) => !!m.categoria).map((m) => {
      const meta = num(m.meta_faturamento);
      const realizado = num((resumo?.porCategoria ?? []).find((c: any) => String(c.categoria).toLowerCase() === String(m.categoria).toLowerCase())?.receita);
      return { categoria: m.categoria, meta, realizado, progressoPercentual: meta > 0 ? Number(((realizado / meta) * 100).toFixed(2)) : null, falta: Math.max(meta - realizado, 0) };
    });
    const pct = metaAnual > 0 ? Number(((realizadoAno / metaAnual) * 100).toFixed(1)) : null;
    return ok(
      {
        ano,
        anual: { meta: metaAnual, realizado: realizadoAno, progressoPercentual: pct, falta: gap, ritmoMensalNecessario: Number((gap / mesesRestantes).toFixed(2)), mesesRestantes, origem: metaAnualPers != null ? "metas_personalizadas" : "precificacao" },
        mensal: { mes: mesRef, meta: metaMes, realizado: realizadoMes, progressoPercentual: metaMes > 0 ? Number(((realizadoMes / metaMes) * 100).toFixed(1)) : null, falta: Math.max(metaMes - realizadoMes, 0) },
        porCategoria,
      },
      metaAnual > 0
        ? `Meta anual ${money(metaAnual)} · realizado ${money(realizadoAno)} (${pct}%) · faltam ${money(gap)} em ${mesesRestantes} mês(es) → ${money(gap / mesesRestantes)}/mês. Mês ${mesRef}: ${money(realizadoMes)} de ${money(metaMes)}.`
        : `Nenhuma meta anual configurada para ${ano}. Realizado: ${money(realizadoAno)}.`,
    );
  },
  "lunari.workflow.diagnoseSession": async (sb, uid, args) => {
    const r = await resolveSessao(sb, uid, args);
    if (r.ask) return r.ask;
    if (r.error) return fail(r.error);
    const s = r.sessao!;
    const findings: Array<{ code: string; severity: string; message: string; suggestedCapability: string | null }> = [];
    const total = Number(s.valor_total) || 0, pago = Number(s.valor_pago) || 0;
    if (!s.cliente_id) findings.push({ code: "SEM_CLIENTE", severity: "warning", message: "Sessão sem cliente vinculado.", suggestedCapability: "lunari.workflow.updateFields" });
    if (!s.data_sessao) findings.push({ code: "SEM_DATA", severity: "warning", message: "Sessão sem data.", suggestedCapability: "lunari.workflow.updateFields" });
    if (total <= 0) findings.push({ code: "TOTAL_ZERADO", severity: "warning", message: "Valor total zerado.", suggestedCapability: "lunari.workflow.updateFields" });
    if (pago > total + 0.009) findings.push({ code: "PAGO_MAIOR_TOTAL", severity: "critical", message: `Pago (${money(pago)}) maior que o total (${money(total)}).`, suggestedCapability: "lunari.workflow.getSessionFinancials" });
    if (!s.galeria_id) findings.push({ code: "SEM_GALERIA", severity: "info", message: "Sessão sem galeria vinculada.", suggestedCapability: null });
    const produtos = Array.isArray(s.produtos_incluidos) ? s.produtos_incluidos : [];
    for (const p of produtos as any[]) {
      if (p?.tipo === "manual" && !(Number(p.valorUnitario) > 0)) {
        findings.push({ code: "PRODUTO_SEM_PRECO", severity: "warning", message: `Produto "${p?.nome ?? "?"}" sem preço unitário.`, suggestedCapability: "lunari.workflow.produto.setPrice" });
      }
    }
    return ok(
      { sessionId: s.id, ok: findings.length === 0, findings },
      findings.length === 0 ? "Nenhuma inconsistência encontrada." : `${findings.length} ponto(s) de atenção: ${findings.map((f) => f.message).join(" ")}`,
    );
  },
  "lunari.workflow.produto.listBySession": async (sb, uid, args) => {
    const r = await resolveSessao(sb, uid, args);
    if (r.ask) return r.ask;
    if (r.error) return fail(r.error);
    const produtos = projetarProdutos(r.sessao!);
    return ok(
      { sessionId: r.sessao!.id, produtos },
      produtos.length
        ? produtos.map((p: any) => `${p.nome} ×${p.quantidade} · ${p.etapaAtual ?? "sem etapa"}${p.prazoEntrega ? ` · prazo ${p.prazoEntrega}` : ""}`).join(" | ")
        : "Nenhum produto nesta sessão.",
    );
  },
  "lunari.workflow.produto.listPending": async (sb, uid, args) => {
    const { data, error } = await sb.from("clientes_sessoes")
      .select("id,session_id,data_sessao,produtos_incluidos,clientes(nome)")
      .eq("user_id", uid).neq("status", "historico")
      .not("produtos_incluidos", "is", null)
      .order("data_sessao", { ascending: false }).limit(clampLimit(args.limit, 200, 400));
    if (error) return fail(error.message);
    const hoje = today();
    const buckets: Record<string, any[]> = { atrasado: [], hoje: [], amanha: [], semana: [], futuro: [], semPrazo: [] };
    for (const s of (data ?? []) as any[]) {
      for (const p of projetarProdutos(s)) {
        if (p.entregue) continue;
        const item = { sessionId: s.id, sessionKey: s.session_id, cliente: s.clientes?.nome ?? null, ...p };
        const prazo = p.prazoEntrega;
        if (!prazo) buckets.semPrazo.push(item);
        else if (prazo < hoje) buckets.atrasado.push(item);
        else if (prazo === hoje) buckets.hoje.push(item);
        else if (prazo === addDays(hoje, 1)) buckets.amanha.push(item);
        else if (prazo <= addDays(hoje, 7)) buckets.semana.push(item);
        else buckets.futuro.push(item);
      }
    }
    const totalPend = Object.values(buckets).reduce((a, b) => a + b.length, 0);
    return ok(
      { buckets, total: totalPend },
      `${totalPend} produto(s) em produção · ${buckets.atrasado.length} atrasado(s), ${buckets.hoje.length} para hoje, ${buckets.semana.length} nesta semana.`,
    );
  },
};
