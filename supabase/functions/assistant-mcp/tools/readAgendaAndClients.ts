// deno-lint-ignore-file no-explicit-any
import {
  APPT_COLS,
  GRUPOS_RECEITA,
  Handler,
  UUID_RE,
  addDays,
  clampLimit,
  fail,
  fromMinutes,
  money,
  ok,
  today,
  toMinutes,
} from "../types.ts";
import { appointmentsInDay, conflictAt } from "../resolvers.ts";

export const READ_AGENDA_AND_CLIENTS_TOOLS: Record<string, Handler> = {
  // -------------------- AGENDA --------------------
  "lunari.agenda.appointments.list": async (sb, uid, args) => {
    const start = String(args.start ?? args.from ?? today());
    const end = String(args.end ?? args.to ?? addDays(start, 30));
    const { data, error } = await sb.from("appointments").select(APPT_COLS)
      .eq("user_id", uid).gte("date", start).lte("date", end)
      .order("date", { ascending: true }).order("time", { ascending: true }).limit(clampLimit(args.limit, 200, 500));
    if (error) return fail(error.message);
    return ok({ start, end, appointments: data ?? [] }, `${data?.length ?? 0} agendamento(s) entre ${start} e ${end}.`);
  },
  "lunari.agenda.appointments.get": async (sb, uid, args) => {
    const id = String(args.id ?? "");
    if (!id) return fail("Campo 'id' é obrigatório.");
    const { data, error } = await sb.from("appointments").select(APPT_COLS).eq("user_id", uid).eq("id", id).maybeSingle();
    if (error) return fail(error.message);
    if (!data) return fail("Agendamento não encontrado.");
    return ok({ appointment: data }, `${data.title} — ${data.date} ${data.time} (${data.status}).`);
  },
  "lunari.agenda.slot.check": async (sb, uid, args) => {
    const date = String(args.date ?? ""), time = String(args.time ?? "");
    if (!date || !time) return fail("Campos 'date' (YYYY-MM-DD) e 'time' (HH:MM) são obrigatórios.");
    const duration = Number(args.durationMinutes) || 60;
    const list = await appointmentsInDay(sb, uid, date);
    const c = conflictAt(list, time, duration, args.excludeAppointmentId ? String(args.excludeAppointmentId) : undefined);
    return ok(
      { date, time, available: !c, conflict: c ?? null },
      c ? `Ocupado: "${c.title}" às ${c.time}.` : `Horário livre em ${date} às ${time}.`,
    );
  },
  "lunari.agenda.availability.findNext": async (sb, uid, args) => {
    const fromDate = String(args.fromDate ?? today());
    const fromTime = String(args.fromTime ?? "08:00");
    const horizon = Math.min(Number(args.horizonDays) || 30, 180);
    const duration = Number(args.durationMinutes) || 60;
    const dayStart = toMinutes(String(args.dayStart ?? "08:00"));
    const dayEnd = toMinutes(String(args.dayEnd ?? "19:00"));
    const endDate = addDays(fromDate, horizon);
    const { data, error } = await sb.from("appointments")
      .select("id,date,time,duration_minutes,title").eq("user_id", uid).gte("date", fromDate).lte("date", endDate);
    if (error) return fail(error.message);
    const byDay = new Map<string, any[]>();
    for (const a of data ?? []) {
      const k = String((a as any).date);
      byDay.set(k, [...(byDay.get(k) ?? []), a]);
    }
    const slots: { date: string; time: string }[] = [];
    for (let d = 0; d <= horizon && slots.length < 5; d++) {
      const date = addDays(fromDate, d);
      const list = byDay.get(date) ?? [];
      const min = d === 0 ? Math.max(dayStart, toMinutes(fromTime)) : dayStart;
      for (let t = min; t + duration <= dayEnd && slots.length < 5; t += 30) {
        const time = fromMinutes(t);
        if (!conflictAt(list, time, duration)) slots.push({ date, time });
      }
    }
    if (!slots.length) return ok({ slots: [] }, `Nenhum horário livre nos próximos ${horizon} dias.`);
    return ok({ slots, next: slots[0] }, `Próximo horário livre: ${slots[0].date} às ${slots[0].time}.`);
  },

  // -------------------- CLIENTES --------------------
  "lunari.clientes.list": async (sb, uid, args) => {
    let q = sb.from("clientes").select("id,nome,email,telefone,whatsapp,cidade,created_at")
      .eq("user_id", uid).order("nome").limit(clampLimit(args.limit, 50, 200));
    if (args.search ?? args.q) q = q.ilike("nome", `%${String(args.search ?? args.q)}%`);
    const { data, error } = await q;
    if (error) return fail(error.message);
    return ok({ clientes: data ?? [] }, `${data?.length ?? 0} cliente(s).`);
  },
  "lunari.clientes.search": async (sb, uid, args) => {
    const q = String(args.q ?? "").trim();
    if (!q) return fail("Campo 'q' é obrigatório.");
    const { data, error } = await sb.from("clientes")
      .select("id,nome,email,telefone,whatsapp").eq("user_id", uid)
      .or(`nome.ilike.%${q}%,email.ilike.%${q}%,telefone.ilike.%${q}%,whatsapp.ilike.%${q}%`).limit(20);
    if (error) return fail(error.message);
    return ok({ clientes: data ?? [] }, `${data?.length ?? 0} cliente(s) para "${q}".`);
  },
  "lunari.clientes.get": async (sb, uid, args) => {
    const id = String(args.id ?? "");
    if (!id) return fail("Campo 'id' é obrigatório.");
    const { data, error } = await sb.from("clientes").select("*").eq("user_id", uid).eq("id", id).maybeSingle();
    if (error) return fail(error.message);
    if (!data) return fail("Cliente não encontrado.");
    return ok({ cliente: data }, `Cliente ${data.nome}.`);
  },
  "lunari.clientes.listSessoes": async (sb, uid, args) => {
    const clienteId = String(args.clienteId ?? "");
    if (!clienteId) return fail("Campo 'clienteId' é obrigatório.");
    const { data, error } = await sb.from("clientes_sessoes")
      .select("id,session_id,data_sessao,hora_sessao,categoria,pacote,status,valor_total,valor_pago,status_financeiro")
      .eq("user_id", uid).eq("cliente_id", clienteId)
      .order("data_sessao", { ascending: false }).limit(clampLimit(args.limit, 20, 200));
    if (error) return fail(error.message);
    return ok({ sessoes: data ?? [] }, `${data?.length ?? 0} sessão(ões) do cliente.`);
  },

  // -------------------- TAREFAS --------------------
  "lunari.tasks.list": async (sb, uid, args) => {
    let q = sb.from("tasks")
      .select("id,title,status,priority,due_date,category,type,related_cliente_id,related_session_id,checklist_items,notes")
      .eq("user_id", uid).order("due_date", { ascending: true, nullsFirst: false })
      .limit(clampLimit(args.limit, 50, 500));
    if (args.status) q = q.eq("status", String(args.status));
    const { data, error } = await q;
    if (error) return fail(error.message);
    return ok({ tasks: data ?? [] }, `${data?.length ?? 0} tarefa(s).`);
  },
  "lunari.tasks.dueOverview": async (sb, uid) => {
    const hoje = today();
    const { data, error } = await sb.from("tasks")
      .select("id,title,status,priority,due_date").eq("user_id", uid).neq("status", "done")
      .not("due_date", "is", null).order("due_date").limit(200);
    if (error) return fail(error.message);
    const atrasadas = (data ?? []).filter((t: any) => t.due_date < hoje);
    const hojeList = (data ?? []).filter((t: any) => t.due_date === hoje);
    const proximas = (data ?? []).filter((t: any) => t.due_date > hoje && t.due_date <= addDays(hoje, 7));
    return ok(
      { atrasadas, hoje: hojeList, proximos7dias: proximas },
      `${atrasadas.length} atrasada(s), ${hojeList.length} para hoje, ${proximas.length} nos próximos 7 dias.`,
    );
  },

  // -------------------- FINANCEIRO --------------------
  "lunari.finance.item.list": async (sb, uid, args) => {
    let q = sb.from("fin_items_master").select("id,nome,grupo_principal,group_code,ativo")
      .eq("user_id", uid).is("archived_at", null).order("nome").limit(500);
    if (args.grupo) q = q.eq("grupo_principal", String(args.grupo));
    const { data, error } = await q;
    if (error) return fail(error.message);
    return ok({ itens: data ?? [] }, `${data?.length ?? 0} item(ns) financeiro(s).`);
  },
  "lunari.finance.extrato.list": async (sb, uid, args) => {
    const dataInicio = String(args.dataInicio ?? addDays(today(), -30));
    const dataFim = String(args.dataFim ?? today());
    let q = sb.from("fin_transactions")
      .select("id,valor,status,data_vencimento,data_competencia,observacoes,parcela_atual,parcela_total,item_id,fin_items_master(nome,grupo_principal)")
      .eq("user_id", uid).gte("data_vencimento", dataInicio).lte("data_vencimento", dataFim)
      .order("data_vencimento", { ascending: false }).limit(clampLimit(args.pageSize, 50, 200));
    if (args.status && args.status !== "todos") q = q.eq("status", String(args.status));
    const { data, error } = await q;
    if (error) return fail(error.message);
    return ok({ dataInicio, dataFim, lancamentos: data ?? [] }, `${data?.length ?? 0} lançamento(s) entre ${dataInicio} e ${dataFim}.`);
  },
  "lunari.finance.extrato.summary": async (sb, uid, args) => {
    const dataInicio = String(args.dataInicio ?? addDays(today(), -30));
    const dataFim = String(args.dataFim ?? today());
    const { data, error } = await sb.from("fin_transactions")
      .select("valor,status,fin_items_master(grupo_principal)")
      .eq("user_id", uid).gte("data_vencimento", dataInicio).lte("data_vencimento", dataFim);
    if (error) return fail(error.message);
    let entradas = 0, saidas = 0, pago = 0, aberto = 0;
    for (const r of (data ?? []) as any[]) {
      const v = Number(r.valor) || 0;
      const grupo = r.fin_items_master?.grupo_principal ?? "";
      if (GRUPOS_RECEITA.includes(grupo)) entradas += v; else saidas += v;
      if (r.status === "Pago") pago += v; else aberto += v;
    }
    return ok(
      { dataInicio, dataFim, entradas, saidas, saldo: entradas - saidas, pago, emAberto: aberto, count: data?.length ?? 0 },
      `Entradas ${money(entradas)} · Saídas ${money(saidas)} · Saldo ${money(entradas - saidas)} (${dataInicio}→${dataFim}).`,
    );
  },

  // -------------------- LEADS (leitura) --------------------
  "lunari.leads.listStatuses": async (sb, uid) => {
    const { data, error } = await sb.from("lead_statuses")
      .select("key,name,sort_order,color,is_converted,is_lost").eq("user_id", uid).order("sort_order");
    if (error) return fail(error.message);
    return ok({ statuses: data ?? [] }, (data ?? []).map((s: any) => s.name).join(" → ") || "Nenhum estágio configurado.");
  },
  "lunari.leads.get": async (sb, uid, args) => {
    const id = String(args.id ?? "");
    let q = sb.from("leads").select("*").eq("user_id", uid).limit(1);
    q = UUID_RE.test(id) ? q.eq("id", id) : q.ilike("nome", `%${id}%`);
    const { data, error } = await q;
    if (error) return fail(error.message);
    const lead = (data ?? [])[0];
    if (!lead) return fail(`Lead não encontrado: ${id}`);
    return ok({ lead }, `${lead.nome} · ${lead.status ?? "sem estágio"} · origem ${lead.origem ?? "—"}${lead.motivo_perda ? ` · perdido: ${lead.motivo_perda}` : ""}.`);
  },
  "lunari.leads.list": async (sb, uid, args) => {
    let q = sb.from("leads")
      .select("id,nome,email,telefone,origem,status,motivo_perda,created_at,data_contato,arquivado,cliente_id")
      .eq("user_id", uid).order("created_at", { ascending: false }).limit(clampLimit(args.limit, 50, 200));
    const arq = String(args.arquivados ?? "ocultar");
    if (arq === "ocultar") q = q.or("arquivado.is.null,arquivado.eq.false");
    else if (arq === "somente") q = q.eq("arquivado", true);
    if (args.status) q = q.eq("status", String(args.status));
    if (args.origem) q = q.eq("origem", String(args.origem));
    if (args.desde) q = q.gte("created_at", String(args.desde));
    if (args.ate) q = q.lte("created_at", `${String(args.ate)}T23:59:59.999Z`);
    if (args.search) q = q.ilike("nome", `%${String(args.search)}%`);
    const { data, error } = await q;
    if (error) return fail(error.message);
    return ok({ leads: data ?? [] }, `${data?.length ?? 0} lead(s).`);
  },
  "lunari.leads.metrics": async (sb, uid, args) => {
    const now = new Date();
    const desde = String(args.desde ?? `${now.getUTCFullYear()}-01-01`);
    const ate = String(args.ate ?? today());
    const [{ data: statuses, error: sErr }, { data: rows, error: lErr }] = await Promise.all([
      sb.from("lead_statuses").select("key,name,is_converted,is_lost").eq("user_id", uid),
      sb.from("leads").select("status,origem,motivo_perda,cliente_id")
        .eq("user_id", uid).gte("created_at", desde).lte("created_at", `${ate}T23:59:59.999Z`).limit(5000),
    ]);
    if (sErr) return fail(sErr.message);
    if (lErr) return fail(lErr.message);
    const conv = new Set((statuses ?? []).filter((s: any) => s.is_converted).map((s: any) => s.key));
    const lost = new Set((statuses ?? []).filter((s: any) => s.is_lost).map((s: any) => s.key));
    const porStatus: Record<string, number> = {}, porOrigem: Record<string, number> = {}, motivos: Record<string, number> = {};
    let convertidos = 0, perdidos = 0;
    for (const l of ((rows ?? []) as any[])) {
      const st = l.status ?? "sem-status";
      porStatus[st] = (porStatus[st] ?? 0) + 1;
      const og = l.origem || "nao-especificado";
      porOrigem[og] = (porOrigem[og] ?? 0) + 1;
      if (conv.has(st) || l.cliente_id) convertidos++;
      if (lost.has(st)) { perdidos++; const mp = l.motivo_perda || "não informado"; motivos[mp] = (motivos[mp] ?? 0) + 1; }
    }
    const total = rows?.length ?? 0;
    const taxa = total > 0 ? Number(((convertidos / total) * 100).toFixed(1)) : 0;
    const topMotivo = Object.entries(motivos).sort((a, b) => b[1] - a[1])[0] ?? null;
    return ok(
      { periodo: { desde, ate }, total, porStatus, porOrigem, convertidos, perdidos, motivosPerda: motivos, taxaConversao: taxa },
      `${total} lead(s) de ${desde} a ${ate} · ${convertidos} convertido(s) (${taxa}%) · ${perdidos} perdido(s)${topMotivo ? ` · principal motivo: ${topMotivo[0]} (${topMotivo[1]})` : ""}.`,
    );
  },
};
