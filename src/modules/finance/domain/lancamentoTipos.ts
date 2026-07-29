/**
 * Taxonomia de tipos de lançamento financeiro.
 *
 * Fonte única de verdade para:
 *  - o menu "+ Novo lançamento" (Notion-like) do header do módulo;
 *  - o roteamento do drawer contextual;
 *  - o filtro de grupos/categorias exibidos por tipo;
 *  - a futura invocação pela LU (a IA usa exatamente as mesmas funções puras
 *    para propor/criar lançamentos, sem duplicar regras da UI).
 *
 * ⚠️  NENHUMA regra financeira nova nasce aqui — só reorganização.
 *     Persistência continua via capabilities `finance.transaction.create`,
 *     `finance.item.create`, `finance.category.create` e derivados.
 */
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  ArrowDownRight,
  Banknote,
  Landmark,
  Package,
  Receipt,
  Sparkles,
  Wallet,
} from "lucide-react";
import type { Grupo, ItemFinanceiro } from "./types";

// ─────────────────────────────────────────────────────────────
// Enum + registry
// ─────────────────────────────────────────────────────────────

export type LancamentoTipo =
  | "receita_operacional"
  | "receita_nao_operacional"
  | "despesa_fixa"
  | "despesa_variavel"
  | "investimento";

/** Extensível — futuras adições não quebram consumidores existentes. */
export type LancamentoTipoFuturo =
  | "transferencia"
  | "estorno"
  | "saldo_inicial"
  | "ajuste";

export type CampoLancamento =
  | "cliente"
  | "sessao"
  | "produto"
  | "favorecido"
  | "descricaoAtivo"
  | "descricao"
  | "grupo"
  | "categoria"
  | "valor"
  | "competencia"
  | "recebimento"
  | "vencimento"
  | "formaPagamento"
  | "observacoes";

export type OrigemReceitaOperacional = "sessao" | "venda_avulsa" | "outro";

export interface LancamentoTipoMeta {
  id: LancamentoTipo;
  /** Rótulo curto exibido no menu contextual. */
  label: string;
  /** Descrição de 1 linha estilo Notion — subtítulo do item do menu. */
  descricao: string;
  /** Título do drawer ("Nova Despesa Variável", etc.). */
  tituloDrawer: string;
  /** Subtítulo editorial curto exibido logo abaixo do título. */
  subtituloDrawer: string;
  /** Ícone Lucide dourado — mesmo tratamento visual dos demais módulos. */
  icone: LucideIcon;
  /**
   * Grupos permitidos para este tipo.
   * A UI e a LU filtram a lista completa de `financial_items` por este predicado.
   */
  gruposPermitidos: Grupo[];
  /** Direção contábil (in/out) — usada para tint sutil e cálculos derivados. */
  natureza: "entrada" | "saida";
  /**
   * Chip discreto de contexto pré-form (ex.: Receita Operacional apresenta
   * Sessão / Venda avulsa / Outro antes do formulário).
   */
  contextoPreForm?: {
    label: string;
    opcoes: Array<{ id: OrigemReceitaOperacional; label: string; descricao: string; icone: LucideIcon }>;
  };
  /**
   * Datas relevantes — evita apresentar campos sem sentido para o contexto.
   *  - Receitas → competência + recebimento
   *  - Despesas/Investimento → competência + vencimento
   */
  datas: Array<"competencia" | "recebimento" | "vencimento">;
  /**
   * Campos "essenciais" — sempre visíveis (sem accordion).
   */
  camposEssenciais: CampoLancamento[];
  /**
   * Campos que NUNCA devem aparecer neste tipo — guard-rail para a UI
   * e para a LU (nunca sugerir cliente em despesa fixa, por exemplo).
   */
  camposProibidos: CampoLancamento[];
}

// ─────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────

export const LANCAMENTO_TIPOS: Record<LancamentoTipo, LancamentoTipoMeta> = {
  receita_operacional: {
    id: "receita_operacional",
    label: "Receita Operacional",
    descricao: "Sessões, vendas de produtos e serviços fotográficos.",
    tituloDrawer: "Nova Receita Operacional",
    subtituloDrawer: "Registre uma nova entrada do seu estúdio.",
    icone: ArrowUpRight,
    gruposPermitidos: ["Receita Operacional"],
    natureza: "entrada",
    contextoPreForm: {
      label: "Origem da receita",
      opcoes: [
        {
          id: "sessao",
          label: "Sessão",
          descricao: "Venda de sessões",
          icone: Sparkles,
        },
        {
          id: "venda_avulsa",
          label: "Venda avulsa",
          descricao: "Produtos ou pacotes",
          icone: Package,
        },
        {
          id: "outro",
          label: "Outro",
          descricao: "Outras receitas",
          icone: Receipt,
        },
      ],
    },
    datas: ["competencia", "recebimento"],
    camposEssenciais: ["grupo", "categoria", "valor", "competencia", "recebimento", "formaPagamento"],
    camposProibidos: ["vencimento"],
  },

  receita_nao_operacional: {
    id: "receita_nao_operacional",
    label: "Receita Não Operacional",
    descricao: "Entradas fora da operação: juros, reembolsos, aportes.",
    tituloDrawer: "Nova Receita Não Operacional",
    subtituloDrawer: "Entrada fora da atividade principal do estúdio.",
    icone: Banknote,
    gruposPermitidos: ["Receita Não Operacional"],
    natureza: "entrada",
    datas: ["competencia", "recebimento"],
    camposEssenciais: ["grupo", "categoria", "descricao", "valor", "competencia", "recebimento", "formaPagamento"],
    camposProibidos: ["cliente", "sessao", "produto", "vencimento"],
  },

  despesa_fixa: {
    id: "despesa_fixa",
    label: "Despesa Fixa",
    descricao: "Gastos recorrentes: aluguel, software, internet.",
    tituloDrawer: "Nova Despesa Fixa",
    subtituloDrawer: "Registre um custo recorrente do estúdio.",
    icone: ArrowDownRight,
    gruposPermitidos: ["Despesa Fixa"],
    natureza: "saida",
    datas: ["competencia", "vencimento"],
    camposEssenciais: [
      "grupo",
      "categoria",
      "favorecido",
      "valor",
      "competencia",
      "vencimento",
      "formaPagamento",
    ],
    camposProibidos: ["cliente", "sessao", "produto", "recebimento"],
  },

  despesa_variavel: {
    id: "despesa_variavel",
    label: "Despesa Variável",
    descricao: "Gastos pontuais: marketing, transporte, insumos.",
    tituloDrawer: "Nova Despesa Variável",
    subtituloDrawer: "Registre um novo gasto do seu estúdio.",
    icone: ArrowDownRight,
    gruposPermitidos: ["Despesa Variável"],
    natureza: "saida",
    datas: ["competencia", "vencimento"],
    camposEssenciais: [
      "grupo",
      "categoria",
      "favorecido",
      "valor",
      "competencia",
      "vencimento",
      "formaPagamento",
    ],
    camposProibidos: ["cliente", "sessao", "produto", "recebimento"],
  },

  investimento: {
    id: "investimento",
    label: "Investimento",
    descricao: "Equipamentos, acervo, móveis, imóveis, veículos.",
    tituloDrawer: "Novo Investimento",
    subtituloDrawer: "Registre a aquisição de um ativo do estúdio.",
    icone: Landmark,
    gruposPermitidos: ["Investimento"],
    natureza: "saida",
    datas: ["competencia", "vencimento"],
    camposEssenciais: [
      "grupo",
      "categoria",
      "descricaoAtivo",
      "valor",
      "competencia",
      "vencimento",
      "formaPagamento",
    ],
    camposProibidos: ["cliente", "sessao", "produto", "recebimento"],
  },
};

/** Ordem canônica exibida no menu contextual "+ Novo lançamento". */
export const LANCAMENTO_TIPOS_ORDEM: LancamentoTipo[] = [
  "receita_operacional",
  "receita_nao_operacional",
  "despesa_fixa",
  "despesa_variavel",
  "investimento",
];

// ─────────────────────────────────────────────────────────────
// Helpers puros (reutilizados por UI e LU)
// ─────────────────────────────────────────────────────────────

export function getLancamentoTipoMeta(tipo: LancamentoTipo): LancamentoTipoMeta {
  return LANCAMENTO_TIPOS[tipo];
}

/**
 * Filtra a lista de `ItemFinanceiro` pelos grupos permitidos daquele tipo.
 * Ex.: em "Despesa Variável", só devolve items cujo `grupo === "Despesa Variável"`.
 */
export function filterItemsByTipo<T extends Pick<ItemFinanceiro, "grupo" | "ativo" | "archivedAt">>(
  items: T[],
  tipo: LancamentoTipo,
): T[] {
  const meta = LANCAMENTO_TIPOS[tipo];
  return items.filter(
    (it) => meta.gruposPermitidos.includes(it.grupo) && it.ativo !== false && !it.archivedAt,
  );
}

/** Inverso: dado um `grupo`, resolve o tipo canônico (ou `null`). */
export function tipoFromGrupo(grupo: Grupo): LancamentoTipo | null {
  switch (grupo) {
    case "Receita Operacional":
      return "receita_operacional";
    case "Receita Não Operacional":
      return "receita_nao_operacional";
    case "Despesa Fixa":
      return "despesa_fixa";
    case "Despesa Variável":
      return "despesa_variavel";
    case "Investimento":
      return "investimento";
    default:
      return null;
  }
}

/** True se o campo deve ser exibido para este tipo. */
export function isCampoPermitido(tipo: LancamentoTipo, campo: CampoLancamento): boolean {
  const meta = LANCAMENTO_TIPOS[tipo];
  return !meta.camposProibidos.includes(campo);
}

/** Ícone auxiliar exportado para reuso rápido pelo menu — evita re-import. */
export const walletIcon = Wallet;
