/**
 * forecast — previsão simples para gráficos.
 * NUNCA alimenta KPIs, saúde ou totais. Apenas visualização.
 */

import type { PontoMensal } from './periodoEfetivo';

export type Confianca = 'baixa' | 'media' | 'alta';

export interface PrevisaoPonto extends PontoMensal {
  previsao: true;
  confianca: Confianca;
}

/**
 * Gera projeção para os meses futuros de `dadosMensaisCompletos`, começando
 * após `ultimoMesComDados`. Retorna array vazio se não houver histórico mínimo.
 */
export function preverMeses(
  dadosMensaisCompletos: PontoMensal[],
  ultimoMesComDados: number,
  minHistorico: number = 3,
): PrevisaoPonto[] {
  const reais = dadosMensaisCompletos.slice(0, ultimoMesComDados);
  if (reais.length < minHistorico) return [];

  const janela = reais.slice(-Math.min(6, reais.length));
  const mediaReceita = avg(janela.map(p => p.receita));
  const mediaDespesas = avg(janela.map(p => p.despesas));

  // Confiança: alta se 6+, média se 4-5, baixa se 3
  const confianca: Confianca = reais.length >= 6 ? 'alta' : reais.length >= 4 ? 'media' : 'baixa';

  // Saldo acumulado inicial = último saldo real
  let saldo = reais[reais.length - 1].saldoAcumulado ?? 0;

  const futuros = dadosMensaisCompletos.slice(ultimoMesComDados);
  return futuros.map(f => {
    const lucro = mediaReceita - mediaDespesas;
    saldo += lucro;
    return {
      mes: f.mes,
      receita: mediaReceita,
      despesas: mediaDespesas,
      lucro,
      saldoAcumulado: saldo,
      previsao: true,
      confianca,
    };
  });
}

function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}
