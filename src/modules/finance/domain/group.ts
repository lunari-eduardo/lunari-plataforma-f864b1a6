/**
 * Grupos financeiros (catálogo fixo, visível ao usuário).
 *
 * Espelha a tabela `public.fin_groups`. Cada Grupo pertence a uma Natureza.
 * Usuário escolhe Grupo → sistema infere Natureza automaticamente.
 *
 * `requiresCategory`:
 *  - true  → grupo "mãe" (Marketing, Softwares, Tributos…) que exige uma categoria livre.
 *  - false → grupo final (Equipamentos, Acervo, Estrutura…) — o detalhe vai na descrição.
 */

import type { NatureCode } from "./nature";

export type GroupCode =
  // Receita Operacional (internas — não exibidas no seletor manual)
  | "ensaios" | "eventos" | "produtos" | "cursos"
  // Receita Não Operacional / Financeira
  | "rendimentos" | "locacao_espaco" | "venda_ativos" | "indenizacoes" | "outros_extras"
  // Despesa Operacional
  | "marketing" | "softwares" | "estrutura" | "transporte"
  | "servicos" | "pessoal" | "alimentacao"
  // Investimento em Ativos
  | "equipamentos" | "acervo" | "cenarios" | "moveis" | "imoveis"
  // Impostos
  | "tributos"
  // Pró-labore / Distribuição
  | "pro_labore_grp" | "distribuicao"
  // Transferência
  | "entre_contas"
  // Empréstimo / Financiamento
  | "capital_giro"
  | "financ_equipamento" | "financ_veiculo" | "financ_imovel"
  // Aplicação Financeira
  | "aplic_cdb" | "aplic_tesouro" | "aplic_outros";

export interface Group {
  code: GroupCode;
  natureCode: NatureCode;
  label: string;
  icon: string;
  ordering: number;
  /** Se o grupo exige escolha/criação de categoria livre. */
  requiresCategory: boolean;
}

export const GROUPS: Record<GroupCode, Group> = {
  // Receita Operacional — entradas exclusivas via Venda Avulsa / Workflow.
  ensaios:            { code: "ensaios",            natureCode: "receita_operacional",   label: "Ensaios",                icon: "camera",            ordering: 10,  requiresCategory: true  },
  eventos:            { code: "eventos",            natureCode: "receita_operacional",   label: "Eventos",                icon: "sparkles",          ordering: 20,  requiresCategory: true  },
  produtos:           { code: "produtos",           natureCode: "receita_operacional",   label: "Vendas de Produtos",     icon: "package",           ordering: 30,  requiresCategory: true  },
  cursos:             { code: "cursos",             natureCode: "receita_operacional",   label: "Cursos e Mentorias",     icon: "graduation-cap",    ordering: 40,  requiresCategory: true  },

  // Receita Não Operacional (Extras) — grupos finais.
  rendimentos:        { code: "rendimentos",        natureCode: "receita_financeira",    label: "Rendimentos Financeiros", icon: "trending-up",      ordering: 50,  requiresCategory: false },
  locacao_espaco:     { code: "locacao_espaco",     natureCode: "receita_financeira",    label: "Locação de Espaço/Equipamentos", icon: "key",       ordering: 52,  requiresCategory: false },
  venda_ativos:       { code: "venda_ativos",       natureCode: "receita_financeira",    label: "Venda de Ativos",         icon: "tag",              ordering: 54,  requiresCategory: false },
  indenizacoes:       { code: "indenizacoes",       natureCode: "receita_financeira",    label: "Indenizações e Reembolsos", icon: "shield",         ordering: 56,  requiresCategory: false },
  outros_extras:      { code: "outros_extras",      natureCode: "receita_financeira",    label: "Outros (Extras)",         icon: "more-horizontal",  ordering: 58,  requiresCategory: false },

  // Despesa Operacional — Marketing e Softwares exigem categoria; demais são finais.
  marketing:          { code: "marketing",          natureCode: "despesa_operacional",   label: "Marketing",              icon: "megaphone",         ordering: 70,  requiresCategory: true  },
  softwares:          { code: "softwares",          natureCode: "despesa_operacional",   label: "Softwares",              icon: "monitor",           ordering: 80,  requiresCategory: true  },
  estrutura:          { code: "estrutura",          natureCode: "despesa_operacional",   label: "Estrutura",              icon: "building",          ordering: 90,  requiresCategory: false },
  transporte:         { code: "transporte",         natureCode: "despesa_operacional",   label: "Transporte",             icon: "car",               ordering: 100, requiresCategory: false },
  servicos:           { code: "servicos",           natureCode: "despesa_operacional",   label: "Serviços",               icon: "wrench",            ordering: 110, requiresCategory: false },
  pessoal:            { code: "pessoal",            natureCode: "despesa_operacional",   label: "Equipe",                 icon: "users",             ordering: 120, requiresCategory: false },
  alimentacao:        { code: "alimentacao",        natureCode: "despesa_operacional",   label: "Alimentação",            icon: "utensils",          ordering: 130, requiresCategory: false },

  // Investimento em Ativos — grupos finais.
  equipamentos:       { code: "equipamentos",       natureCode: "investimento_ativos",   label: "Equipamentos",           icon: "camera",            ordering: 150, requiresCategory: false },
  acervo:             { code: "acervo",             natureCode: "investimento_ativos",   label: "Acervo",                 icon: "image",             ordering: 160, requiresCategory: false },
  cenarios:           { code: "cenarios",           natureCode: "investimento_ativos",   label: "Cenários",               icon: "theater",           ordering: 170, requiresCategory: false },
  moveis:             { code: "moveis",             natureCode: "investimento_ativos",   label: "Móveis",                 icon: "sofa",              ordering: 180, requiresCategory: false },
  imoveis:            { code: "imoveis",            natureCode: "investimento_ativos",   label: "Imóveis",                icon: "home",              ordering: 190, requiresCategory: false },

  // Impostos
  tributos:           { code: "tributos",           natureCode: "impostos",              label: "Tributos",               icon: "landmark",          ordering: 200, requiresCategory: true  },

  // Pró-labore / Distribuição — finais.
  pro_labore_grp:     { code: "pro_labore_grp",     natureCode: "pro_labore",            label: "Pró-labore",             icon: "user-check",        ordering: 220, requiresCategory: false },
  distribuicao:       { code: "distribuicao",       natureCode: "distribuicao_lucros",   label: "Distribuição de Lucros", icon: "pie-chart",         ordering: 230, requiresCategory: false },

  // Transferência / Empréstimo / Financiamento / Aplicação — finais.
  entre_contas:       { code: "entre_contas",       natureCode: "transferencia",         label: "Entre Contas",           icon: "arrow-left-right",  ordering: 240, requiresCategory: false },

  capital_giro:       { code: "capital_giro",       natureCode: "emprestimo",            label: "Capital de Giro",        icon: "banknote",          ordering: 250, requiresCategory: false },

  financ_equipamento: { code: "financ_equipamento", natureCode: "financiamento",         label: "Financiamento Equipamento", icon: "camera",         ordering: 270, requiresCategory: false },
  financ_veiculo:     { code: "financ_veiculo",     natureCode: "financiamento",         label: "Financiamento Veículo",  icon: "car",               ordering: 280, requiresCategory: false },
  financ_imovel:      { code: "financ_imovel",      natureCode: "financiamento",         label: "Financiamento Imóvel",   icon: "home",              ordering: 290, requiresCategory: false },

  aplic_cdb:          { code: "aplic_cdb",          natureCode: "aplicacao_financeira",  label: "CDB",                    icon: "piggy-bank",        ordering: 300, requiresCategory: false },
  aplic_tesouro:      { code: "aplic_tesouro",      natureCode: "aplicacao_financeira",  label: "Tesouro",                icon: "landmark",          ordering: 310, requiresCategory: false },
  aplic_outros:       { code: "aplic_outros",       natureCode: "aplicacao_financeira",  label: "Outros (Aplicações)",    icon: "wallet",            ordering: 320, requiresCategory: false },
};

export const GROUP_LIST: Group[] = Object.values(GROUPS).sort((a, b) => a.ordering - b.ordering);

export function getGroup(code: GroupCode): Group | undefined {
  return GROUPS[code];
}

export function getGroupsByNature(natureCode: NatureCode): Group[] {
  return GROUP_LIST.filter((g) => g.natureCode === natureCode);
}

export function natureOfGroup(code: GroupCode): NatureCode | undefined {
  return GROUPS[code]?.natureCode;
}

export function requiresCategory(code: GroupCode | string): boolean {
  return GROUPS[code as GroupCode]?.requiresCategory ?? true;
}

/** Naturezas permitidas para cada "escopo" de modal. */
export const SCOPE_NATURES = {
  /** Botão "+ Despesa" no topo: tudo que afeta saída de caixa. */
  despesa: [
    "despesa_operacional",
    "investimento_ativos",
    "impostos",
    "pro_labore",
    "distribuicao_lucros",
    "financiamento",
    "emprestimo",
  ],
  /** Botão "+ Receita" no topo: somente Extras (não-operacional). */
  receita_extra: ["receita_financeira"],
  /** Modal aberto a partir da seção "Despesas Fixas". */
  despesa_fixa: [
    "despesa_operacional",
    "impostos",
    "pro_labore",
    "distribuicao_lucros",
    "financiamento",
    "emprestimo",
  ],
  /** Modal aberto a partir da seção "Despesas Variáveis". */
  despesa_variavel: [
    "despesa_operacional",
    "impostos",
  ],
  /** Modal aberto a partir da seção "Investimentos". */
  investimento: ["investimento_ativos"],
} as const satisfies Record<string, NatureCode[]>;

export type GroupScope = keyof typeof SCOPE_NATURES;
