// deno-lint-ignore-file no-explicit-any
import {
  WriteCfg,
  arredondar,
  fail,
  money,
  needsInput,
  norm,
  ok,
  resolverMarkup,
  somaCustos,
  somaProdutos,
} from "../types.ts";
import {
  askCategoriaObrigatoria,
  pacoteDuplicado,
  resolveCategoria,
  resolvePacote,
  upsertTabela,
} from "../resolvers.ts";
import {
  calcularPrecoFinal,
  loadEstruturaCustos,
  loadModelo,
  loadTabelas,
  valorPorFoto,
} from "../pricing.ts";

export const WRITE_PRICING_TOOLS: Record<string, WriteCfg> = {
  // ---------- CONFIGURAÇÕES / PRECIFICAÇÃO ----------
  "lunari.configuracoes.createCategoria": {
    requiresApproval: false,
    summarize: (a) => `Criar categoria "${a.nome ?? "?"}"`,
    handler: async (sb, uid, args) => {
      const nome = String(args.nome ?? "").trim();
      if (!nome) return fail("Campo 'nome' é obrigatório.");
      const { data: existe } = await sb.from("categorias").select("id,nome").eq("user_id", uid);
      if ((existe ?? []).some((c: any) => norm(c.nome) === norm(nome))) {
        return fail(`Já existe uma categoria chamada "${nome}".`);
      }
      const { data, error } = await sb.from("categorias")
        .insert({ user_id: uid, nome, cor: args.cor ? String(args.cor) : null })
        .select("id,nome,cor").single();
      if (error) return fail(error.message);
      return ok({ categoria: data }, `Categoria "${data.nome}" criada.`);
    },
  },
  "lunari.configuracoes.createPacote": {
    requiresApproval: false,
    summarize: (a) => `Criar pacote "${a.nome ?? "?"}"`,
    handler: async (sb, uid, args) => {
      const nome = String(args.nome ?? "").trim();
      if (!nome) return fail("Campo 'nome' é obrigatório.");
      const cat = await resolveCategoria(sb, uid, args);
      if (cat.ask) return cat.ask;
      if (cat.error) return fail(cat.error);
      if (!cat.id) return fail("Informe a categoria do pacote.");
      const dup = await pacoteDuplicado(sb, uid, cat.id, nome);
      if (dup) return fail(dup);
      const { data, error } = await sb.from("pacotes").insert({
        user_id: uid,
        nome,
        categoria_id: cat.id,
        valor_base: Number(args.valorBase ?? args.valor_base ?? 0) || 0,
        valor_foto_extra: Number(args.valorFotoExtra ?? args.valor_foto_extra ?? 0) || 0,
        fotos_incluidas: Math.max(0, Math.floor(Number(args.fotosIncluidas ?? args.fotos_incluidas ?? 0) || 0)),
      }).select("id,nome,categoria_id,valor_base,valor_foto_extra,fotos_incluidas").single();
      if (error) return fail(error.message);
      return ok(
        { pacote: data, categoria: cat.nome },
        `Pacote "${data.nome}" criado em ${cat.nome} · base ${money(data.valor_base)} · foto extra ${money(data.valor_foto_extra)} · ${data.fotos_incluidas} foto(s) inclusa(s). Sessões existentes não mudam.`,
      );
    },
  },
  "lunari.precificacao.criarPacotePrecificado": {
    requiresApproval: true,
    summarize: (a) => `Criar pacote precificado "${a.nome ?? "?"}" em ${a.categoria ?? a.categoriaId ?? "categoria"}`,
    handler: async (sb, uid, args) => {
      const nome = String(args.nome ?? "").trim();
      if (!nome) {
        return needsInput({ missing: ["nome"], question: "Qual será o nome do pacote?" });
      }

      let catId = "", catNome = "";
      const temCategoria = String(args.categoriaId ?? args.categoria ?? "").trim();
      if (!temCategoria) return await askCategoriaObrigatoria(sb, uid);
      const cat = await resolveCategoria(sb, uid, args);
      if (cat.id) { catId = cat.id; catNome = cat.nome ?? ""; }
      else if (args.criarCategoria === true && args.categoria) {
        const { data, error } = await sb.from("categorias")
          .insert({ user_id: uid, nome: String(args.categoria).trim() }).select("id,nome").single();
        if (error) return fail(error.message);
        catId = data.id; catNome = data.nome;
      } else if (cat.ask) {
        return cat.ask;
      } else {
        return fail(cat.error ?? "Informe a categoria do pacote.");
      }

      const dup = await pacoteDuplicado(sb, uid, catId, nome);
      if (dup) return fail(dup);

      let calc: ReturnType<typeof calcularPrecoFinal> | null = null;
      let markupInfo = "";
      let valorBase = Number(args.valorBase ?? 0) || 0;

      if (!args.valorBase) {
        const horas = Number(args.horasEstimadas ?? 0) || 0;
        if (horas <= 0) {
          return needsInput({
            missing: ["horasEstimadas"],
            question:
              `Para precificar "${nome}" preciso das horas estimadas de trabalho (ou de um valor base fechado). Quantas horas?`,
          });
        }

        const estrutura = await loadEstruturaCustos(sb, uid);
        const { markup, origem } = resolverMarkup(args, estrutura.margemLucroDesejada);
        markupInfo = origem;
        calc = calcularPrecoFinal({
          horasEstimadas: horas,
          custoPorHora: estrutura.custoPorHora,
          markup,
          custoProdutos: somaProdutos(args.produtos),
          custosAdicionais: somaCustos(args.custosExtras),
        });
        valorBase = arredondar(calc.precoFinal, Number(args.arredondarPara ?? 0) || 0);
      }

      let valorFotoExtra = Number(args.valorFotoExtra ?? 0) || 0;
      if (!args.valorFotoExtra) {
        const [modelo, tabelas] = await Promise.all([loadModelo(sb, uid), loadTabelas(sb, uid)]);
        const tabela = modelo === "categoria"
          ? tabelas.find((t) => t.tipo === "categoria" && t.categoriaId === catId)
          : tabelas.find((t) => t.tipo === "global");
        if (tabela && !tabela.usarValorFixoPacote) valorFotoExtra = valorPorFoto(1, tabela.faixas);
      }

      const { data, error } = await sb.from("pacotes").insert({
        user_id: uid,
        nome,
        categoria_id: catId,
        valor_base: valorBase,
        valor_foto_extra: valorFotoExtra,
        fotos_incluidas: Math.max(0, Math.floor(Number(args.fotosIncluidas ?? 0) || 0)),
      }).select("id,nome,categoria_id,valor_base,valor_foto_extra,fotos_incluidas").single();
      if (error) return fail(error.message);

      return ok(
        { pacote: data, categoria: catNome, calculo: calc, markup: markupInfo },
        `Pacote "${data.nome}" criado em ${catNome} por ${money(data.valor_base)}` +
          (calc
            ? ` (custo ${money(calc.custoTotal)} · ${markupInfo} · lucratividade ${calc.lucratividade}%)`
            : "") +
          ` · foto extra ${money(data.valor_foto_extra)}. Sessões existentes mantêm as regras congeladas.`,
      );
    },
  },
  "lunari.precificacao.salvarCenario": {
    requiresApproval: false,
    summarize: (a) => `Salvar cenário de precificação "${a.nome ?? "?"}"`,
    handler: async (sb, uid, args) => {
      const nome = String(args.nome ?? "").trim();
      if (!nome) return fail("Campo 'nome' é obrigatório.");
      const horas = Number(args.horasEstimadas ?? 0) || 0;
      const estrutura = await loadEstruturaCustos(sb, uid);
      const { markup, origem } = resolverMarkup(args, estrutura.margemLucroDesejada);
      const calc = calcularPrecoFinal({
        horasEstimadas: horas,
        custoPorHora: estrutura.custoPorHora,
        markup,
        custoProdutos: somaProdutos(args.produtos),
        custosAdicionais: somaCustos(args.custosExtras),
      });
      const { data, error } = await sb.from("pricing_calculadora_estados").insert({
        user_id: uid,
        nome,
        horas_estimadas: horas,
        markup,
        produtos: Array.isArray(args.produtos) ? args.produtos : [],
        custos_extras: Array.isArray(args.custosExtras) ? args.custosExtras : [],
        custo_total_calculado: calc.custoTotal,
        preco_final_calculado: calc.precoFinal,
        lucratividade: calc.lucratividade,
        is_default: false,
      }).select("id,nome,preco_final_calculado").single();
      if (error) return fail(error.message);
      return ok(
        { cenario: data, calculo: calc, markup: origem },
        `Cenário "${nome}" salvo · custo ${money(calc.custoTotal)} · preço ${money(calc.precoFinal)} · lucratividade ${calc.lucratividade}% (${origem}). Nenhum preço praticado foi alterado.`,
      );
    },
  },
  "lunari.precificacao.updatePacotePreco": {
    requiresApproval: true,
    summarize: (a) => `Alterar preço do pacote "${a.pacote ?? a.pacoteId ?? "?"}"`,
    handler: async (sb, uid, args) => {
      const p = await resolvePacote(sb, uid, args);
      if (p.error) return fail(p.error);
      const atual = p.pacote!;
      const patch: Record<string, unknown> = {};
      const diff: string[] = [];
      if (args.valorBase !== undefined) {
        patch.valor_base = Number(args.valorBase) || 0;
        diff.push(`base ${money(atual.valor_base)} → ${money(patch.valor_base)}`);
      }
      if (args.valorFotoExtra !== undefined) {
        patch.valor_foto_extra = Number(args.valorFotoExtra) || 0;
        diff.push(`foto extra ${money(atual.valor_foto_extra)} → ${money(patch.valor_foto_extra)}`);
      }
      if (args.fotosIncluidas !== undefined) {
        patch.fotos_incluidas = Math.max(0, Math.floor(Number(args.fotosIncluidas) || 0));
        diff.push(`fotos inclusas ${atual.fotos_incluidas} → ${patch.fotos_incluidas}`);
      }
      if (Object.keys(patch).length === 0) return fail("Informe pelo menos um valor para alterar.");
      const { data, error } = await sb.from("pacotes").update(patch)
        .eq("id", atual.id).eq("user_id", uid)
        .select("id,nome,valor_base,valor_foto_extra,fotos_incluidas").maybeSingle();
      if (error) return fail(error.message);
      if (!data) return fail("Pacote não encontrado.");
      return ok(
        { pacote: data, diff },
        `"${data.nome}": ${diff.join(" · ")}. Vale para sessões novas — as existentes mantêm o preço congelado.`,
      );
    },
  },
  "lunari.precificacao.upsertTabelaGlobal": {
    requiresApproval: true,
    summarize: () => "Aplicar nova tabela global de foto extra",
    handler: async (sb, uid, args) => upsertTabela(sb, uid, args, "global", null),
  },
  "lunari.precificacao.upsertTabelaCategoria": {
    requiresApproval: true,
    summarize: (a) => `Aplicar tabela de foto extra da categoria "${a.categoria ?? a.categoriaId ?? "?"}"`,
    handler: async (sb, uid, args) => {
      const cat = await resolveCategoria(sb, uid, args);
      if (cat.ask) return cat.ask;
      if (cat.error) return fail(cat.error);
      if (!cat.id) return fail("Informe a categoria.");
      return upsertTabela(sb, uid, args, "categoria", cat.id);
    },
  },
  "lunari.precificacao.setModelo": {
    requiresApproval: true,
    summarize: (a) => `Mudar o modelo de preço de foto extra para "${a.modelo ?? "?"}"`,
    handler: async (sb, uid, args) => {
      const modelo = String(args.modelo ?? "");
      if (!["fixo", "global", "categoria"].includes(modelo)) {
        return fail("Modelo deve ser 'fixo', 'global' ou 'categoria'.");
      }
      const { data: atual } = await sb.from("modelo_de_preco").select("id,modelo").eq("user_id", uid).maybeSingle();
      if (atual?.id) {
        const { error } = await sb.from("modelo_de_preco")
          .update({ modelo, updated_at: new Date().toISOString() }).eq("id", atual.id).eq("user_id", uid);
        if (error) return fail(error.message);
      } else {
        const { error } = await sb.from("modelo_de_preco").insert({ user_id: uid, modelo });
        if (error) return fail(error.message);
      }
      return ok(
        { de: atual?.modelo ?? "fixo", para: modelo },
        `Modelo de foto extra: ${atual?.modelo ?? "fixo"} → ${modelo}. Vale para sessões novas.`,
      );
    },
  },
  "lunari.precificacao.updateMargemEHoras": {
    requiresApproval: true,
    summarize: () => "Alterar margem desejada, pró-labore ou horas produtivas",
    handler: async (sb, uid, args) => {
      const patch: Record<string, unknown> = {};
      if (args.margemLucroDesejada !== undefined) patch.margem_lucro_desejada = Number(args.margemLucroDesejada) || 0;
      if (args.percentualProLabore !== undefined) patch.percentual_pro_labore = Number(args.percentualProLabore) || 0;
      if (args.horasDisponiveis !== undefined) patch.horas_disponiveis = Math.max(0, Math.floor(Number(args.horasDisponiveis) || 0));
      if (args.diasTrabalhados !== undefined) patch.dias_trabalhados = Math.max(0, Math.floor(Number(args.diasTrabalhados) || 0));
      if (Object.keys(patch).length === 0) return fail("Informe pelo menos um parâmetro.");
      const antes = await loadEstruturaCustos(sb, uid);
      const { data: cfg } = await sb.from("pricing_configuracoes").select("id").eq("user_id", uid).maybeSingle();
      if (cfg?.id) {
        const { error } = await sb.from("pricing_configuracoes").update(patch).eq("id", cfg.id).eq("user_id", uid);
        if (error) return fail(error.message);
      } else {
        const { error } = await sb.from("pricing_configuracoes").insert({ user_id: uid, ...patch });
        if (error) return fail(error.message);
      }
      const depois = await loadEstruturaCustos(sb, uid);
      return ok(
        { antes, depois },
        `Custo por hora ${money(antes.custoPorHora)} → ${money(depois.custoPorHora)} · margem ${antes.margemLucroDesejada}% → ${depois.margemLucroDesejada}%. Recalcula todas as simulações futuras.`,
      );
    },
  },
  "lunari.precificacao.setMetas": {
    requiresApproval: true,
    summarize: (a) => `Definir metas de ${a.ano ?? "ano atual"}`,
    handler: async (sb, uid, args) => {
      const ano = Math.floor(Number(args.ano ?? new Date().getFullYear()));
      const patch: Record<string, unknown> = { ano_meta: ano };
      if (args.metaFaturamentoAnual !== undefined) patch.meta_faturamento_anual = Number(args.metaFaturamentoAnual) || 0;
      if (args.metaLucroAnual !== undefined) patch.meta_lucro_anual = Number(args.metaLucroAnual) || 0;
      if (args.usarMetasPersonalizadas !== undefined) patch.usar_metas_personalizadas = Boolean(args.usarMetasPersonalizadas);
      const { data: cfg } = await sb.from("pricing_configuracoes").select("id").eq("user_id", uid).maybeSingle();
      if (cfg?.id) {
        const { error } = await sb.from("pricing_configuracoes").update(patch).eq("id", cfg.id).eq("user_id", uid);
        if (error) return fail(error.message);
      } else {
        const { error } = await sb.from("pricing_configuracoes").insert({ user_id: uid, ...patch });
        if (error) return fail(error.message);
      }
      return ok({ ano, patch }, `Metas de ${ano} atualizadas.`);
    },
  },
};
