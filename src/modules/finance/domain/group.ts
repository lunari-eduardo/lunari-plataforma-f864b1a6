/**
 * Onda A — Grupos financeiros (catálogo fixo, visível ao usuário).
 *
 * Espelha a tabela `public.fin_groups`. Cada Grupo pertence a uma Natureza.
 * Usuário escolhe Grupo → sistema infere Natureza automaticamente.
 */

import type { NatureCode } from "./nature";

export type GroupCode =
  // Receita Operacional
  | "ensaios" | "eventos" | "produtos" | "cursos"
  // Receita Financeira
  | "rendimentos" | "juros_recebidos"
  // Despesa Operacional
  | "marketing" | "softwares" | "estrutura" | "transporte"
  | "servicos" | "pessoal" | "alimentacao" | "outros_op"
  // Investimento em Ativos
  | "equipamentos" | "acervo" | "cenarios" | "moveis" | "imoveis"
  // Impostos
  | "tributos" | "taxas"
  // Pró-labore / Distribuição
  | "pro_labore_grp" | "distribuicao"
  // Transferência
  | "entre_contas"
  // Empréstimo / Financiamento
  | "capital_giro" | "emprestimo_pessoal"
  | "financ_equipamento" | "financ_veiculo" | "financ_imovel"
  // Aplicação Financeira
  | "aplic_cdb" | "aplic_tesouro" | "aplic_outros";

export interface Group {
  code: GroupCode;
  natureCode: NatureCode;
  label: string;
  icon: string;
  ordering: number;
}

export const GROUPS: Record<GroupCode, Group> = {
  ensaios:            { code: "ensaios",            natureCode: "receita_operacional",   label: "Ensaios",                icon: "camera",            ordering: 10 },
  eventos:            { code: "eventos",            natureCode: "receita_operacional",   label: "Eventos",                icon: "sparkles",          ordering: 20 },
  produtos:           { code: "produtos",           natureCode: "receita_operacional",   label: "Vendas de Produtos",     icon: "package",           ordering: 30 },
  cursos:             { code: "cursos",             natureCode: "receita_operacional",   label: "Cursos e Mentorias",     icon: "graduation-cap",    ordering: 40 },

  rendimentos:        { code: "rendimentos",        natureCode: "receita_financeira",    label: "Rendimentos",            icon: "trending-up",       ordering: 50 },
  juros_recebidos:    { code: "juros_recebidos",    natureCode: "receita_financeira",    label: "Juros Recebidos",        icon: "percent",           ordering: 60 },

  marketing:          { code: "marketing",          natureCode: "despesa_operacional",   label: "Marketing",              icon: "megaphone",         ordering: 70 },
  softwares:          { code: "softwares",          natureCode: "despesa_operacional",   label: "Softwares",              icon: "monitor",           ordering: 80 },
  estrutura:          { code: "estrutura",          natureCode: "despesa_operacional",   label: "Estrutura",              icon: "building",          ordering: 90 },
  transporte:         { code: "transporte",         natureCode: "despesa_operacional",   label: "Transporte",             icon: "car",               ordering: 100 },
  servicos:           { code: "servicos",           natureCode: "despesa_operacional",   label: "Serviços",               icon: "wrench",            ordering: 110 },
  pessoal:            { code: "pessoal",            natureCode: "despesa_operacional",   label: "Pessoal",                icon: "users",             ordering: 120 },
  alimentacao:        { code: "alimentacao",        natureCode: "despesa_operacional",   label: "Alimentação",            icon: "utensils",          ordering: 130 },
  outros_op:          { code: "outros_op",          natureCode: "despesa_operacional",   label: "Outros",                 icon: "more-horizontal",   ordering: 140 },

  equipamentos:       { code: "equipamentos",       natureCode: "investimento_ativos",   label: "Equipamentos",           icon: "camera",            ordering: 150 },
  acervo:             { code: "acervo",             natureCode: "investimento_ativos",   label: "Acervo",                 icon: "image",             ordering: 160 },
  cenarios:           { code: "cenarios",           natureCode: "investimento_ativos",   label: "Cenários",               icon: "theater",           ordering: 170 },
  moveis:             { code: "moveis",             natureCode: "investimento_ativos",   label: "Móveis",                 icon: "sofa",              ordering: 180 },
  imoveis:            { code: "imoveis",             natureCode: "investimento_ativos",  label: "Imóveis",                icon: "home",              ordering: 190 },

  tributos:           { code: "tributos",           natureCode: "impostos",              label: "Tributos",               icon: "landmark",          ordering: 200 },
  taxas:              { code: "taxas",              natureCode: "impostos",              label: "Taxas",                  icon: "receipt",           ordering: 210 },

  pro_labore_grp:     { code: "pro_labore_grp",     natureCode: "pro_labore",            label: "Pró-labore",             icon: "user-check",        ordering: 220 },
  distribuicao:       { code: "distribuicao",       natureCode: "distribuicao_lucros",   label: "Distribuição de Lucros", icon: "pie-chart",         ordering: 230 },

  entre_contas:       { code: "entre_contas",       natureCode: "transferencia",         label: "Entre Contas",           icon: "arrow-left-right",  ordering: 240 },

  capital_giro:       { code: "capital_giro",       natureCode: "emprestimo",            label: "Capital de Giro",        icon: "banknote",          ordering: 250 },
  emprestimo_pessoal: { code: "emprestimo_pessoal", natureCode: "emprestimo",            label: "Pessoal",                icon: "hand-coins",        ordering: 260 },

  financ_equipamento: { code: "financ_equipamento", natureCode: "financiamento",         label: "Equipamento",            icon: "camera",            ordering: 270 },
  financ_veiculo:     { code: "financ_veiculo",     natureCode: "financiamento",         label: "Veículo",                icon: "car",               ordering: 280 },
  financ_imovel:      { code: "financ_imovel",      natureCode: "financiamento",         label: "Imóvel",                 icon: "home",              ordering: 290 },

  aplic_cdb:          { code: "aplic_cdb",          natureCode: "aplicacao_financeira",  label: "CDB",                    icon: "piggy-bank",        ordering: 300 },
  aplic_tesouro:      { code: "aplic_tesouro",      natureCode: "aplicacao_financeira",  label: "Tesouro",                icon: "landmark",          ordering: 310 },
  aplic_outros:       { code: "aplic_outros",       natureCode: "aplicacao_financeira",  label: "Outros",                 icon: "wallet",            ordering: 320 },
};

export const GROUP_LIST: Group[] = Object.values(GROUPS).sort((a, b) => a.ordering - b.ordering);

export function getGroup(code: GroupCode): Group {
  return GROUPS[code];
}

export function getGroupsByNature(natureCode: NatureCode): Group[] {
  return GROUP_LIST.filter((g) => g.natureCode === natureCode);
}

export function natureOfGroup(code: GroupCode): NatureCode {
  return GROUPS[code].natureCode;
}
