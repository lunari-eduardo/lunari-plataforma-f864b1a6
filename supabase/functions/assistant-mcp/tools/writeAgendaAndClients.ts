// deno-lint-ignore-file no-explicit-any
import {
  APPT_COLS,
  NeedsInputOption,
  WriteCfg,
  fail,
  fromMinutes,
  needsInput,
  ok,
} from "../types.ts";
import {
  appointmentsInDay,
  conflictAt,
  resolveCliente,
} from "../resolvers.ts";

export const WRITE_AGENDA_AND_CLIENTS_TOOLS: Record<string, WriteCfg> = {
  // ---------- AGENDA ----------
  "lunari.agenda.appointments.create": {
    requiresApproval: false,
    summarize: (a) => `Criar agendamento "${a.title ?? a.type ?? "sessão"}" em ${a.date ?? "?"} ${a.time ?? ""}`,
    handler: async (sb, uid, args) => {
      const date = String(args.date ?? ""), time = String(args.time ?? "");
      if (!date) {
        return needsInput({
          missing: ["date"],
          question: "Para qual data é o agendamento? (formato YYYY-MM-DD)",
        });
      }
      const cli = await resolveCliente(sb, uid, args);
      if (cli.ask) return cli.ask;
      if (cli.error) return fail(cli.error);
      if (!cli.id && !args.semCliente) {
        return needsInput({
          missing: ["clienteNome"],
          question: "Para qual cliente é este agendamento?",
          allowCreate: true,
          createHint:
            "Se for um bloqueio pessoal (sem cliente), reenvie com semCliente=true. Se for cliente novo, confirme antes de criar.",
        });
      }
      const duration = Number(args.durationMinutes) || 60;
      if (!time) {
        const doDia = await appointmentsInDay(sb, uid, date);
        const livres: NeedsInputOption[] = [];
        for (let m = 8 * 60; m + duration <= 19 * 60 && livres.length < 8; m += 30) {
          const hhmm = fromMinutes(m);
          if (!conflictAt(doDia, hhmm, duration)) livres.push({ label: hhmm, value: hhmm });
        }
        return needsInput({
          missing: ["time"],
          question: `Qual horário em ${date}? Horários livres sugeridos:`,
          options: livres,
        });
      }
      const title = String(args.title ?? cli.nome ?? "Agendamento");

      const conflict = conflictAt(await appointmentsInDay(sb, uid, date), time, duration);

      if (conflict && !args.force) {
        return fail(`Conflito com "${conflict.title}" às ${conflict.time}. Escolha outro horário ou envie force=true.`);
      }
      const payload: Record<string, unknown> = {
        user_id: uid,
        session_id: crypto.randomUUID(),
        title,
        date,
        time,
        type: String(args.type ?? args.categoria ?? "Sessão"),
        status: String(args.status ?? "a confirmar"),
        description: args.description ? String(args.description) : null,
        cliente_id: cli.id,
        duration_minutes: duration,
        origem: "agenda",
      };
      const { data, error } = await sb.from("appointments").insert(payload).select(APPT_COLS).single();
      if (error) return fail(error.message);
      return ok({ appointment: data }, `Agendamento "${title}" criado em ${date} às ${time}.`);
    },
  },
  "lunari.agenda.appointments.update": {
    requiresApproval: false,
    summarize: (a) => `Atualizar agendamento ${a.id ?? "?"}`,
    handler: async (sb, uid, args) => {
      const id = String(args.id ?? "");
      if (!id) return fail("Campo 'id' é obrigatório.");
      const patch = (args.patch ?? args) as Record<string, any>;
      const upd: Record<string, unknown> = {};
      if (patch.title != null) upd.title = String(patch.title);
      if (patch.date != null) upd.date = String(patch.date);
      if (patch.time != null) upd.time = String(patch.time);
      if (patch.type != null) upd.type = String(patch.type);
      if (patch.status != null) upd.status = String(patch.status);
      if (patch.description != null) upd.description = String(patch.description);
      if (patch.durationMinutes != null) upd.duration_minutes = Number(patch.durationMinutes);
      if (patch.clienteId != null || patch.clienteNome != null) {
        const cli = await resolveCliente(sb, uid, patch);
        if (cli.ask) return cli.ask;
        if (cli.error) return fail(cli.error);
        upd.cliente_id = cli.id;
      }
      if (!Object.keys(upd).length) return fail("Nada para atualizar.");
      const { data, error } = await sb.from("appointments").update(upd)
        .eq("id", id).eq("user_id", uid).select(APPT_COLS).maybeSingle();
      if (error) return fail(error.message);
      if (!data) return fail("Agendamento não encontrado.");
      return ok({ appointment: data }, `Agendamento "${data.title}" atualizado.`);
    },
  },
  "lunari.agenda.appointments.reschedule": {
    requiresApproval: false,
    summarize: (a) => `Remarcar agendamento ${a.id ?? "?"} para ${a.date ?? "?"} ${a.time ?? ""}`,
    handler: async (sb, uid, args) => {
      const id = String(args.id ?? ""), date = String(args.date ?? ""), time = String(args.time ?? "");
      if (!id || !date || !time) return fail("Campos 'id', 'date' e 'time' são obrigatórios.");
      const { data: atual } = await sb.from("appointments").select("id,duration_minutes,title,description")
        .eq("user_id", uid).eq("id", id).maybeSingle();
      if (!atual) return fail("Agendamento não encontrado.");
      const duration = Number(atual.duration_minutes) || 60;
      const conflict = conflictAt(await appointmentsInDay(sb, uid, date), time, duration, id);
      if (conflict && !args.force) return fail(`Conflito com "${conflict.title}" às ${conflict.time}.`);
      const upd: Record<string, unknown> = { date, time };
      if (args.reason) upd.description = `${atual.description ?? ""}\n[Remarcado] ${args.reason}`.trim();
      const { data, error } = await sb.from("appointments").update(upd)
        .eq("id", id).eq("user_id", uid).select(APPT_COLS).single();
      if (error) return fail(error.message);
      return ok({ appointment: data }, `"${data.title}" remarcado para ${date} às ${time}.`);
    },
  },
  "lunari.agenda.appointments.confirm": {
    requiresApproval: false,
    summarize: (a) => `Confirmar agendamento ${a.id ?? "?"}`,
    handler: async (sb, uid, args) => {
      const id = String(args.id ?? "");
      if (!id) return fail("Campo 'id' é obrigatório.");
      const { data, error } = await sb.from("appointments").update({ status: "confirmado" })
        .eq("id", id).eq("user_id", uid).select(APPT_COLS).maybeSingle();
      if (error) return fail(error.message);
      if (!data) return fail("Agendamento não encontrado.");
      return ok({ appointment: data }, `"${data.title}" confirmado.`);
    },
  },

  // ---------- CLIENTES ----------
  "lunari.clientes.create": {
    requiresApproval: false,
    summarize: (a) => `Criar cliente "${a.nome ?? "sem nome"}"`,
    handler: async (sb, uid, args) => {
      const nome = String(args.nome ?? "").trim();
      if (!nome) return fail("Campo 'nome' é obrigatório.");
      const payload: Record<string, unknown> = { user_id: uid, nome };
      for (const f of ["email", "telefone", "whatsapp", "cidade", "uf", "cpf_cnpj", "observacoes", "origem"]) {
        if (args[f] != null) payload[f] = String(args[f]);
      }
      const { data, error } = await sb.from("clientes").insert(payload).select("id,nome,email,telefone").single();
      if (error) return fail(error.message);
      return ok({ cliente: data }, `Cliente "${data.nome}" criado.`);
    },
  },
  "lunari.clientes.update": {
    requiresApproval: false,
    summarize: (a) => `Atualizar cliente ${a.id ?? "?"}`,
    handler: async (sb, uid, args) => {
      const id = String(args.id ?? "");
      if (!id) return fail("Campo 'id' é obrigatório.");
      const upd: Record<string, unknown> = {};
      for (const f of ["nome", "email", "telefone", "whatsapp", "cidade", "uf", "cpf_cnpj", "observacoes"]) {
        if (args[f] !== undefined) upd[f] = args[f] === null ? null : String(args[f]);
      }
      if (!Object.keys(upd).length) return fail("Nada para atualizar.");
      const { data, error } = await sb.from("clientes").update(upd)
        .eq("id", id).eq("user_id", uid).select("id,nome").maybeSingle();
      if (error) return fail(error.message);
      if (!data) return fail("Cliente não encontrado.");
      return ok({ cliente: data }, `Cliente "${data.nome}" atualizado.`);
    },
  },

  // ---------- TAREFAS ----------
  "lunari.tasks.create": {
    requiresApproval: false,
    summarize: (a) => `Criar tarefa "${a.title ?? "sem título"}"`,
    handler: async (sb, uid, args) => {
      const title = String(args.title ?? "").trim();
      if (!title) return fail("Campo 'title' é obrigatório.");
      const checklist = Array.isArray(args.checklistItems)
        ? args.checklistItems.map((it: any, i: number) =>
          typeof it === "string"
            ? { id: crypto.randomUUID(), text: it, done: false, order: i }
            : { id: it.id ?? crypto.randomUUID(), text: String(it.text ?? it.title ?? ""), done: !!it.done, order: i })
        : [];
      const payload: Record<string, unknown> = {
        user_id: uid,
        title,
        description: args.description ? String(args.description) : null,
        notes: args.notes ? String(args.notes) : null,
        status: String(args.status ?? "todo"),
        priority: String(args.priority ?? "medium"),
        due_date: args.dueDate ? String(args.dueDate).slice(0, 10) : null,
        category: args.category ? String(args.category) : null,
        type: args.type ? String(args.type) : null,
        source: String(args.source ?? "ai"),
        checklist_items: checklist,
        estimated_hours: args.estimatedHours != null ? Number(args.estimatedHours) : null,
        related_cliente_id: args.relatedClienteId ? String(args.relatedClienteId) : null,
        related_session_id: args.relatedSessionId ? String(args.relatedSessionId) : null,
      };
      if (!payload.related_cliente_id && (args.clienteNome || args.cliente)) {
        const cli = await resolveCliente(sb, uid, args);
        if (cli.id) payload.related_cliente_id = cli.id;
      }
      const { data, error } = await sb.from("tasks").insert(payload).select("id,title,status,due_date,priority").single();
      if (error) return fail(error.message);
      return ok({ task: data }, `Tarefa "${data.title}" criada${data.due_date ? ` para ${data.due_date}` : ""}.`);
    },
  },
  "lunari.tasks.update": {
    requiresApproval: false,
    summarize: (a) => `Atualizar tarefa ${a.id ?? "?"}`,
    handler: async (sb, uid, args) => {
      const id = String(args.id ?? "");
      if (!id) return fail("Campo 'id' é obrigatório.");
      const patch = (args.patch ?? args) as Record<string, any>;
      const upd: Record<string, unknown> = {};
      if (patch.title != null) upd.title = String(patch.title);
      if (patch.description !== undefined) upd.description = patch.description === null ? null : String(patch.description);
      if (patch.notes !== undefined) upd.notes = patch.notes === null ? null : String(patch.notes);
      if (patch.status != null) upd.status = String(patch.status);
      if (patch.priority != null) upd.priority = String(patch.priority);
      if (patch.dueDate !== undefined) upd.due_date = patch.dueDate ? String(patch.dueDate).slice(0, 10) : null;
      if (patch.category !== undefined) upd.category = patch.category ? String(patch.category) : null;
      if (Array.isArray(patch.checklistItems)) upd.checklist_items = patch.checklistItems;
      if (patch.estimatedHours != null) upd.estimated_hours = Number(patch.estimatedHours);
      if (!Object.keys(upd).length) return fail("Nada para atualizar.");
      const { data, error } = await sb.from("tasks").update(upd)
        .eq("id", id).eq("user_id", uid).select("id,title,status,due_date").maybeSingle();
      if (error) return fail(error.message);
      if (!data) return fail("Tarefa não encontrada.");
      return ok({ task: data }, `Tarefa "${data.title}" atualizada.`);
    },
  },
  "lunari.tasks.move": {
    requiresApproval: false,
    summarize: (a) => `Mover tarefa ${a.id ?? "?"} para ${a.toStatus ?? "?"}`,
    handler: async (sb, uid, args) => {
      const id = String(args.id ?? ""), toStatus = String(args.toStatus ?? "");
      if (!id || !toStatus) return fail("Campos 'id' e 'toStatus' são obrigatórios.");
      const upd: Record<string, unknown> = { status: toStatus };
      upd.completed_at = toStatus === "done" ? new Date().toISOString() : null;
      const { data, error } = await sb.from("tasks").update(upd)
        .eq("id", id).eq("user_id", uid).select("id,title,status").maybeSingle();
      if (error) return fail(error.message);
      if (!data) return fail("Tarefa não encontrada.");
      return ok({ task: data }, `Tarefa "${data.title}" movida para ${toStatus}.`);
    },
  },
  "lunari.tasks.complete": {
    requiresApproval: false,
    summarize: (a) => `Concluir tarefa ${a.id ?? "?"}`,
    handler: async (sb, uid, args) => {
      const id = String(args.id ?? "");
      if (!id) return fail("Campo 'id' é obrigatório.");
      const { data, error } = await sb.from("tasks")
        .update({ status: "done", checked: true, completed_at: new Date().toISOString() })
        .eq("id", id).eq("user_id", uid).select("id,title,status").maybeSingle();
      if (error) return fail(error.message);
      if (!data) return fail("Tarefa não encontrada.");
      return ok({ task: data }, `Tarefa "${data.title}" concluída.`);
    },
  },
  "lunari.tasks.reopen": {
    requiresApproval: false,
    summarize: (a) => `Reabrir tarefa ${a.id ?? "?"}`,
    handler: async (sb, uid, args) => {
      const id = String(args.id ?? "");
      if (!id) return fail("Campo 'id' é obrigatório.");
      const { data, error } = await sb.from("tasks")
        .update({ status: String(args.toStatus ?? "todo"), checked: false, completed_at: null })
        .eq("id", id).eq("user_id", uid).select("id,title,status").maybeSingle();
      if (error) return fail(error.message);
      if (!data) return fail("Tarefa não encontrada.");
      return ok({ task: data }, `Tarefa "${data.title}" reaberta.`);
    },
  },
  "lunari.tasks.delete": {
    requiresApproval: true,
    summarize: (a) => `Excluir tarefa ${a.id ?? "?"} (irreversível)`,
    handler: async (sb, uid, args) => {
      const id = String(args.id ?? "");
      if (!id) return fail("Campo 'id' é obrigatório.");
      const { error } = await sb.from("tasks").delete().eq("id", id).eq("user_id", uid);
      if (error) return fail(error.message);
      return ok({ deleted: id }, "Tarefa excluída.");
    },
  },
};
