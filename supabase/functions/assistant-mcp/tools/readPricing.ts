// deno-lint-ignore-file no-explicit-any
import {
  Handler,
  clampLimit,
  fail,
  money,
  ok,
  resolverMarkup,
  round2,
  somaCustos,
  somaProdutos,
} from "../types.ts";
import {
  resolveCategoria,
  resolvePacote,
} from "../resolvers.ts";
import {
  calcularPrecoFinal,
  faixaPara,
  loadEstruturaCustos,
  loadModelo,
  loadTabelas,
  parseFaixas,
  validarFaixas,
  valorPorFoto,
} from "../pricing.ts";

export const READ_PRICING_TOOLS: Record<string, Handler> = {
  // ---------- PRECIFICAÇÃO (leitura e simulação) ----------
  "lunari.precificacao.getConfiguracao": async (sb, uid) => {
    const [modelo, tabelas, estrutura] = await Promise.all([
      loadModelo(sb, uid), loadTabelas(sb, uid), loadEstruturaCustos(sb, uid),
    ]);
    return ok(
      {
        modelo,
        hasTabelaGlobal: tabelas.some((t) => t.tipo === "global"),
        categoriasComTabela: tabelas.filter((t) => t.tipo === "categoria").length,
        horasDisponiveisDia: estrutura.horasDisponiveisDia,
        diasTrabalhadosSemana: estrutura.diasTrabalhadosSemana,
        horasMes: estrutura.horasMes,
        percentualProLabore: estrutura.percentualProLabore,
        margemLucroDesejada: estrutura.margemLucroDesejada,
        custoPorHora: estrutura.custoPorHora,
      },
      `Modelo "${modelo}" · ${estrutura.horasMes}h produtivas/mês · custo/hora ${money(estrutura.custoPorHora)} · margem desejada ${estrutura.margemLucroDesejada}%.`,
    );
  },
  "lunari.precificacao.getEstruturaCustos": async (sb, uid) => {
    const e = await loadEstruturaCustos(sb, uid);
    return ok(
      e,
      `Custo fixo ${money(e.custoFixoMensal)}/mês (pessoais ${money(e.totalGastosPessoais)} + estúdio ${money(e.totalCustosEstudio)} + depreciação ${money(e.totalDepreciacaoMensal)}) · ${e.horasMes}h/mês · custo/hora ${money(e.custoPorHora)}.`,
    );
  },
  "lunari.precificacao.listTabelas": async (sb, uid) => {
    const [modelo, items] = await Promise.all([loadModelo(sb, uid), loadTabelas(sb, uid)]);
    return ok({ modelo, items }, `Modelo "${modelo}" · ${items.length} tabela(s) configurada(s).`);
  },
  "lunari.precificacao.getTabelaCategoria": async (sb, uid, args) => {
    const cat = await resolveCategoria(sb, uid, args);
    if (cat.ask) return cat.ask;
    if (cat.error) return fail(cat.error);
    if (!cat.id) return fail("Informe a categoria.");
    const tabelas = await loadTabelas(sb, uid);
    const t = tabelas.find((x) => x.tipo === "categoria" && x.categoriaId === cat.id) ?? null;
    return ok(
      { categoria: cat.nome, tabela: t },
      t ? `Tabela "${t.nome}" com ${t.faixas.length} faixa(s).` : `${cat.nome} não tem tabela própria.`,
    );
  },
  "lunari.precificacao.listPacotesComPreco": async (sb, uid, args) => {
    const cat = await resolveCategoria(sb, uid, args);
    if (cat.ask) return cat.ask;
    if (cat.error) return fail(cat.error);
    let q = sb.from("pacotes")
      .select("id,nome,categoria_id,valor_base,valor_foto_extra,fotos_incluidas")
      .eq("user_id", uid).order("nome");
    if (cat.id) q = q.eq("categoria_id", cat.id);
    const { data, error } = await q;
    if (error) return fail(error.message);
    const items = data ?? [];
    return ok(
      { categoria: cat.nome ?? null, items },
      items.length
        ? items.map((p: any) => `${p.nome}: base ${money(p.valor_base)} · extra ${money(p.valor_foto_extra)} · ${p.fotos_incluidas} inclusa(s)`).join(" | ")
        : "Nenhum pacote cadastrado.",
    );
  },
  "lunari.precificacao.getMetas": async (sb, uid, args) => {
    const { data: cfg } = await sb.from("pricing_configuracoes")
      .select("margem_lucro_desejada, ano_meta, meta_faturamento_anual, meta_lucro_anual, usar_metas_personalizadas")
      .eq("user_id", uid).maybeSingle();
    let q = sb.from("metas_personalizadas")
      .select("ano,mes,categoria,meta_faturamento,meta_lucro").eq("user_id", uid).order("ano").order("mes");
    if (args.ano) q = q.eq("ano", Math.floor(Number(args.ano)));
    const { data: metas, error } = await q;
    if (error) return fail(error.message);
    return ok(
      {
        margemLucroDesejada: Number(cfg?.margem_lucro_desejada ?? 0),
        anoMeta: cfg?.ano_meta ?? null,
        metaFaturamentoAnual: Number(cfg?.meta_faturamento_anual ?? 0),
        metaLucroAnual: Number(cfg?.meta_lucro_anual ?? 0),
        usarMetasPersonalizadas: Boolean(cfg?.usar_metas_personalizadas),
        personalizadas: metas ?? [],
      },
      `Meta ${cfg?.ano_meta ?? "—"}: faturamento ${money(cfg?.meta_faturamento_anual)} · lucro ${money(cfg?.meta_lucro_anual)} · margem ${Number(cfg?.margem_lucro_desejada ?? 0)}%.`,
    );
  },
  "lunari.precificacao.listCenarios": async (sb, uid, args) => {
    const { data, error } = await sb.from("pricing_calculadora_estados")
      .select("id,nome,horas_estimadas,markup,custo_total_calculado,preco_final_calculado,lucratividade,is_default,updated_at")
      .eq("user_id", uid).order("updated_at", { ascending: false }).limit(clampLimit(args.limit, 20, 50));
    if (error) return fail(error.message);
    return ok({ items: data ?? [] }, `${data?.length ?? 0} cenário(s) salvo(s).`);
  },
  "lunari.precificacao.diagnostico": async (sb, uid) => {
    const [modelo, tabelas, estrutura] = await Promise.all([
      loadModelo(sb, uid), loadTabelas(sb, uid), loadEstruturaCustos(sb, uid),
    ]);
    const problemas: string[] = [], avisos: string[] = [];
    if (estrutura.custoFixoMensal <= 0) problemas.push("Nenhum custo fixo cadastrado — o custo por hora fica zerado.");
    if (estrutura.horasMes <= 0) problemas.push("Horas produtivas não configuradas.");
    if (estrutura.margemLucroDesejada <= 0) avisos.push("Margem de lucro desejada não definida.");
    if (modelo === "global" && !tabelas.some((t) => t.tipo === "global")) problemas.push("Modelo é 'tabela global', mas nenhuma tabela global foi criada.");
    if (modelo === "categoria" && tabelas.filter((t) => t.tipo === "categoria").length === 0) problemas.push("Modelo é 'por categoria', mas nenhuma categoria tem tabela.");
    const { data: pacotes } = await sb.from("pacotes").select("nome,valor_base,valor_foto_extra").eq("user_id", uid);
    const semBase = (pacotes ?? []).filter((p: any) => !(Number(p.valor_base) > 0));
    if (semBase.length) avisos.push(`${semBase.length} pacote(s) sem valor base definido.`);
    if (modelo === "fixo") {
      const semExtra = (pacotes ?? []).filter((p: any) => !(Number(p.valor_foto_extra) > 0));
      if (semExtra.length) avisos.push(`${semExtra.length} pacote(s) sem valor de foto extra.`);
    }
    return ok(
      { pronto: problemas.length === 0, problemas, avisos },
      problemas.length ? `Pendências: ${problemas.join(" ")}` : `Precificação pronta.${avisos.length ? ` Avisos: ${avisos.join(" ")}` : ""}`,
    );
  },
  "lunari.precificacao.simularPreco": async (sb, uid, args) => {
    const horas = Number(args.horasEstimadas ?? 0) || 0;
    if (horas <= 0) return fail("Informe 'horasEstimadas' maior que zero.");
    const estrutura = await loadEstruturaCustos(sb, uid);
    const custoPorHora = Number(args.custoPorHoraOverride ?? estrutura.custoPorHora) || 0;
    const { markup, origem } = resolverMarkup(args, estrutura.margemLucroDesejada);
    const notas: string[] = [`Markup ${markup}x (${origem}).`];
    if (custoPorHora <= 0) notas.push("Custo por hora zerado — cadastre custos fixos e horas produtivas.");
    const r = calcularPrecoFinal({
      horasEstimadas: horas, custoPorHora, markup,
      custoProdutos: somaProdutos(args.produtos), custosAdicionais: somaCustos(args.custosExtras),
    });
    if (estrutura.margemLucroDesejada > 0 && r.lucratividade < estrutura.margemLucroDesejada) {
      notas.push(`Lucratividade ${r.lucratividade}% abaixo da margem desejada (${estrutura.margemLucroDesejada}%).`);
    }
    return ok(
      { custoPorHora: round2(custoPorHora), markupUsado: markup, origemMarkup: origem, ...r, notas },
      `Custo/hora ${money(custoPorHora)} · custo total ${money(r.custoTotal)} · preço sugerido ${money(r.precoFinal)} · lucratividade ${r.lucratividade}% (${origem}).`,
    );
  },
  "lunari.precificacao.simularFotoExtra": async (sb, uid, args) => {
    const quantidade = Math.floor(Number(args.quantidade ?? 0) || 0);
    if (quantidade <= 0) return fail("Informe 'quantidade' maior que zero.");
    const modelo = await loadModelo(sb, uid);
    const notas: string[] = [];
    let pacote: any = null;
    if (args.pacote || args.pacoteId) {
      const p = await resolvePacote(sb, uid, args);
      if (p.error) return fail(p.error);
      pacote = p.pacote;
    }
    const cat = await resolveCategoria(sb, uid, args);
    const catId = cat.id ?? pacote?.categoria_id ?? null;

    const finalize = (unit: number, faixa: unknown, tabelaNome: string | null) =>
      ok(
        { modelo, quantidade, valorUnitario: round2(unit), valorTotal: round2(unit * quantidade), faixaAplicada: faixa, tabelaUsada: tabelaNome, notas },
        `${quantidade} foto(s) extra: ${money(unit)}/foto · total ${money(unit * quantidade)}${tabelaNome ? ` (tabela ${tabelaNome})` : ""}.`,
      );

    if (modelo === "fixo") {
      if (!pacote) notas.push("Modelo fixo usa o valor do pacote — informe o pacote para um valor real.");
      return finalize(Number(pacote?.valor_foto_extra ?? 0) || 0, null, null);
    }
    const tabelas = await loadTabelas(sb, uid);
    const tabela = modelo === "global"
      ? tabelas.find((t) => t.tipo === "global") ?? null
      : tabelas.find((t) => t.tipo === "categoria" && t.categoriaId === catId) ?? null;
    if (!tabela) {
      notas.push(modelo === "global"
        ? "Nenhuma tabela global configurada — extras ficariam zerados."
        : "Esta categoria não tem tabela configurada — extras ficariam zerados.");
      return finalize(0, null, null);
    }
    if (tabela.usarValorFixoPacote) {
      notas.push("Tabela marcada para usar o valor fixo do pacote.");
      return finalize(Number(pacote?.valor_foto_extra ?? 0) || 0, null, tabela.nome);
    }
    return finalize(valorPorFoto(quantidade, tabela.faixas), faixaPara(quantidade, tabela.faixas), tabela.nome);
  },
  "lunari.precificacao.simularPacote": async (sb, uid, args) => {
    const p = await resolvePacote(sb, uid, args);
    if (p.error) return fail(p.error);
    const pacote = p.pacote!;
    const fotosExtras = Math.max(0, Math.floor(Number(args.fotosExtras ?? 0) || 0));
    const valorAdicional = Number(args.valorAdicional ?? 0) || 0;
    const desconto = Number(args.desconto ?? 0) || 0;
    const notas: string[] = [];
    let unit = 0;
    if (fotosExtras > 0) {
      const modelo = await loadModelo(sb, uid);
      if (modelo === "fixo") unit = Number(pacote.valor_foto_extra) || 0;
      else {
        const tabelas = await loadTabelas(sb, uid);
        const tabela = modelo === "global"
          ? tabelas.find((t) => t.tipo === "global")
          : tabelas.find((t) => t.tipo === "categoria" && t.categoriaId === pacote.categoria_id);
        if (!tabela) notas.push("Sem tabela para o modelo ativo — fotos extras calculadas como zero.");
        else if (tabela.usarValorFixoPacote) unit = Number(pacote.valor_foto_extra) || 0;
        else unit = valorPorFoto(fotosExtras, tabela.faixas);
      }
    }
    const valorBase = Number(pacote.valor_base) || 0;
    const valorFotosExtras = unit * fotosExtras;
    const total = valorBase + valorFotosExtras + valorAdicional - desconto;
    if (total < 0) notas.push("O desconto informado deixa o total negativo.");
    return ok(
      {
        pacote: { id: pacote.id, nome: pacote.nome, valorBase: round2(valorBase) },
        valorFotosExtras: round2(valorFotosExtras), valorUnitarioFotoExtra: round2(unit),
        valorAdicional: round2(valorAdicional), desconto: round2(desconto),
        totalCliente: round2(total), notas,
      },
      `${pacote.nome}: base ${money(valorBase)} + extras ${money(valorFotosExtras)} + adicional ${money(valorAdicional)} − desconto ${money(desconto)} = ${money(total)}.`,
    );
  },
  "lunari.precificacao.simularImpactoTabela": async (sb, uid, args) => {
    const novas = parseFaixas(args.faixas);
    const validacao = validarFaixas(novas);
    const escopo = String(args.escopo ?? "global") === "categoria" ? "categoria" : "global";
    let catId: string | null = null;
    if (escopo === "categoria") {
      const cat = await resolveCategoria(sb, uid, args);
      if (cat.ask) return cat.ask;
      if (cat.error) return fail(cat.error);
      if (!cat.id) return fail("Informe a categoria para simular o escopo por categoria.");
      catId = cat.id;
    }
    const tabelas = await loadTabelas(sb, uid);
    const atual = escopo === "global"
      ? tabelas.find((t) => t.tipo === "global")
      : tabelas.find((t) => t.tipo === "categoria" && t.categoriaId === catId);
    const qtds: number[] = Array.isArray(args.quantidades) && args.quantidades.length
      ? args.quantidades.map((q: any) => Math.floor(Number(q) || 0)).filter((q: number) => q > 0).slice(0, 12)
      : [1, 5, 10, 20, 50];
    const comparativo = qtds.map((q) => {
      const unitAtual = atual ? valorPorFoto(q, atual.faixas) : 0;
      const unitNovo = valorPorFoto(q, novas);
      const totalAtual = unitAtual * q, totalNovo = unitNovo * q;
      return {
        quantidade: q, unitarioAtual: round2(unitAtual), unitarioNovo: round2(unitNovo),
        totalAtual: round2(totalAtual), totalNovo: round2(totalNovo),
        variacaoPercentual: round2(totalAtual > 0 ? ((totalNovo - totalAtual) / totalAtual) * 100 : 0),
      };
    });
    return ok(
      { valida: validacao.valid, erros: validacao.errors, temTabelaAtual: Boolean(atual), comparativo,
        notas: ["Alterar a tabela afeta apenas sessões novas — sessões existentes mantêm as regras congeladas."] },
      (validacao.valid ? "Faixas válidas. " : `Faixas inválidas: ${validacao.errors.join(" ")} `) +
        comparativo.map((c) => `${c.quantidade}: ${money(c.totalAtual)}→${money(c.totalNovo)} (${c.variacaoPercentual}%)`).join(" | "),
    );
  },
  "lunari.configuracoes.listCategorias": async (sb, uid) => {
    const { data, error } = await sb.from("categorias").select("id,nome,cor").eq("user_id", uid).order("nome");
    if (error) return fail(error.message);
    return ok({ items: data ?? [] }, `${data?.length ?? 0} categoria(s): ${(data ?? []).map((c: any) => c.nome).join(", ")}`);
  },
  "lunari.configuracoes.listPacotes": async (sb, uid, args) => {
    const cat = await resolveCategoria(sb, uid, args);
    if (cat.ask) return cat.ask;
    if (cat.error) return fail(cat.error);
    let q = sb.from("pacotes").select("id,nome,categoria_id,valor_base,valor_foto_extra,fotos_incluidas")
      .eq("user_id", uid).order("nome");
    if (cat.id) q = q.eq("categoria_id", cat.id);
    const { data, error } = await q;
    if (error) return fail(error.message);
    return ok({ items: data ?? [] }, `${data?.length ?? 0} pacote(s).`);
  },
};
