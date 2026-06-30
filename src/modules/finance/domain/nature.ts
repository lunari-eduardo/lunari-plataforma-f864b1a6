/**
 * Onda A — Natureza financeira (catálogo fixo, interno).
 *
 * Espelha a tabela `public.fin_natures`. Fonte de verdade do código.
 * Natureza NUNCA aparece para o usuário final — é usada para KPI/IA/relatórios.
 */

export type NatureCode =
  | "receita_operacional"
  | "receita_financeira"
  | "despesa_operacional"
  | "investimento_ativos"
  | "impostos"
  | "pro_labore"
  | "distribuicao_lucros"
  | "transferencia"
  | "emprestimo"
  | "financiamento"
  | "aplicacao_financeira";

export type NatureSign = "credit" | "debit" | "neutral";

export interface Nature {
  code: NatureCode;
  label: string;
  sign: NatureSign;
  /** Se entra no cálculo de P&L (Resultado). Transferências/Aplicações = false. */
  affectsPnL: boolean;
  ordering: number;
}

export const NATURES: Record<NatureCode, Nature> = {
  receita_operacional:  { code: "receita_operacional",  label: "Receita Operacional",    sign: "credit",  affectsPnL: true,  ordering: 10 },
  receita_financeira:   { code: "receita_financeira",   label: "Receita Financeira",     sign: "credit",  affectsPnL: true,  ordering: 20 },
  despesa_operacional:  { code: "despesa_operacional",  label: "Despesa Operacional",    sign: "debit",   affectsPnL: true,  ordering: 30 },
  investimento_ativos:  { code: "investimento_ativos",  label: "Investimento em Ativos", sign: "debit",   affectsPnL: true,  ordering: 40 },
  impostos:             { code: "impostos",             label: "Impostos",               sign: "debit",   affectsPnL: true,  ordering: 50 },
  pro_labore:           { code: "pro_labore",           label: "Pró-labore",             sign: "debit",   affectsPnL: true,  ordering: 60 },
  distribuicao_lucros:  { code: "distribuicao_lucros",  label: "Distribuição de Lucros", sign: "debit",   affectsPnL: true,  ordering: 70 },
  transferencia:        { code: "transferencia",        label: "Transferência",          sign: "neutral", affectsPnL: false, ordering: 80 },
  emprestimo:           { code: "emprestimo",           label: "Empréstimo",             sign: "neutral", affectsPnL: false, ordering: 90 },
  financiamento:        { code: "financiamento",        label: "Financiamento",          sign: "debit",   affectsPnL: true,  ordering: 100 },
  aplicacao_financeira: { code: "aplicacao_financeira", label: "Aplicação Financeira",   sign: "neutral", affectsPnL: false, ordering: 110 },
};

export const NATURE_LIST: Nature[] = Object.values(NATURES).sort((a, b) => a.ordering - b.ordering);

export function getNature(code: NatureCode): Nature {
  return NATURES[code];
}

export function isReceitaNature(code: NatureCode): boolean {
  return code === "receita_operacional" || code === "receita_financeira";
}

export function isGastoNature(code: NatureCode): boolean {
  // Compõe o KPI "Gastos" (operacional + investimento + impostos + pró-labore + financiamento + distribuição).
  return (
    code === "despesa_operacional" ||
    code === "investimento_ativos" ||
    code === "impostos" ||
    code === "pro_labore" ||
    code === "distribuicao_lucros" ||
    code === "financiamento"
  );
}

export function isNeutralNature(code: NatureCode): boolean {
  return !NATURES[code]?.affectsPnL;
}
