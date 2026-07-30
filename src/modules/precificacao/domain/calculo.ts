/**
 * Funções puras de precificação — espelho da matemática já usada pela UI.
 *
 * Fonte da verdade histórica:
 *  - `PricingCalculationService.calcularValorPorFoto` (faixa progressiva)
 *  - `usePricingSupabaseData.calcularTotal` (custo fixo mensal)
 *  - `CalculadoraService.calcularPrecoFinal` (markup / lucratividade)
 *
 * Nada aqui toca banco nem localStorage.
 */

import type { FaixaPreco, SimulacaoBreakdown } from "./types";

export const round2 = (n: number): number => Math.round((Number(n) || 0) * 100) / 100;

/** Ordena faixas por `min` ascendente (defensivo contra dados legados). */
export function ordenarFaixas(faixas: FaixaPreco[]): FaixaPreco[] {
  return [...(faixas ?? [])].sort((a, b) => a.min - b.min);
}

/** Faixa aplicável a uma quantidade — `null` quando a tabela está vazia. */
export function faixaPara(quantidade: number, faixas: FaixaPreco[]): FaixaPreco | null {
  if (quantidade <= 0) return null;
  const ordenadas = ordenarFaixas(faixas);
  for (const f of ordenadas) {
    if (quantidade >= f.min && (f.max === null || quantidade <= f.max)) return f;
  }
  return ordenadas[ordenadas.length - 1] ?? null;
}

/** Valor unitário da foto extra segundo a tabela progressiva. */
export function valorPorFoto(quantidade: number, faixas: FaixaPreco[]): number {
  return faixaPara(quantidade, faixas)?.valor ?? 0;
}

/** Depreciação mensal linear de um equipamento (vida útil em anos). */
export function depreciacaoMensal(valorPago: number, vidaUtilAnos: number): number {
  if (!vidaUtilAnos || vidaUtilAnos <= 0) return 0;
  return (Number(valorPago) || 0) / (vidaUtilAnos * 12);
}

/** Horas produtivas no mês: horas/dia × dias/semana × 4. */
export function horasMes(horasDia: number, diasSemana: number): number {
  return (Number(horasDia) || 0) * (Number(diasSemana) || 0) * 4;
}

/**
 * Custo fixo mensal do estúdio.
 * Pró-labore aplica um acréscimo percentual sobre os gastos pessoais.
 */
export function custoFixoMensal(params: {
  totalGastosPessoais: number;
  percentualProLabore: number;
  totalCustosEstudio: number;
  totalDepreciacaoMensal: number;
}): number {
  const proLabore =
    (Number(params.totalGastosPessoais) || 0) *
    (1 + (Number(params.percentualProLabore) || 0) / 100);
  return proLabore + (Number(params.totalCustosEstudio) || 0) + (Number(params.totalDepreciacaoMensal) || 0);
}

/** Preço final da calculadora: (horas × custo/hora + produtos + extras) × markup. */
export function calcularPrecoFinal(params: {
  horasEstimadas: number;
  custoPorHora: number;
  markup: number;
  custoProdutos: number;
  custosAdicionais: number;
}): {
  custoTotal: number;
  precoFinal: number;
  lucratividade: number;
  breakdown: SimulacaoBreakdown;
} {
  const custoHoras = (Number(params.horasEstimadas) || 0) * (Number(params.custoPorHora) || 0);
  const custoProdutos = Number(params.custoProdutos) || 0;
  const custosAdicionais = Number(params.custosAdicionais) || 0;
  const custoTotal = custoHoras + custoProdutos + custosAdicionais;
  const markup = Number(params.markup) || 0;
  const precoFinal = custoTotal * markup;
  const lucro = precoFinal - custoTotal;
  const lucratividade = precoFinal > 0 ? (lucro / precoFinal) * 100 : 0;

  return {
    custoTotal: round2(custoTotal),
    precoFinal: round2(precoFinal),
    lucratividade: round2(lucratividade),
    breakdown: {
      custoHoras: round2(custoHoras),
      custoProdutos: round2(custoProdutos),
      custosAdicionais: round2(custosAdicionais),
      lucroEstimado: round2(lucro),
    },
  };
}

/**
 * Valida uma tabela progressiva: faixas contíguas, sem sobreposição,
 * começando em 1 e com a última aberta (`max: null`).
 */
export function validarFaixas(faixas: FaixaPreco[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!Array.isArray(faixas) || faixas.length === 0) {
    return { valid: false, errors: ["A tabela precisa de pelo menos uma faixa."] };
  }

  const ordenadas = ordenarFaixas(faixas);

  if (ordenadas[0].min !== 1) errors.push("A primeira faixa precisa começar em 1 foto.");

  ordenadas.forEach((f, i) => {
    if (!Number.isFinite(f.valor) || f.valor < 0) {
      errors.push(`Faixa ${i + 1}: valor inválido.`);
    }
    if (f.max !== null && f.max < f.min) {
      errors.push(`Faixa ${i + 1}: o máximo não pode ser menor que o mínimo.`);
    }
    if (i < ordenadas.length - 1) {
      const atual = ordenadas[i];
      const prox = ordenadas[i + 1];
      if (atual.max === null) {
        errors.push(`Faixa ${i + 1}: só a última faixa pode ser aberta ("ou mais").`);
      } else if (prox.min !== atual.max + 1) {
        errors.push(
          `Faixa ${i + 2}: deve começar em ${atual.max + 1} para não deixar buraco nem sobreposição.`,
        );
      }
    }
  });

  if (ordenadas[ordenadas.length - 1].max !== null) {
    errors.push("A última faixa precisa ser aberta (sem máximo) para cobrir quantidades altas.");
  }

  return { valid: errors.length === 0, errors };
}
