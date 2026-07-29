/**
 * healthScore — diagnóstico ponderado da Saúde Financeira.
 * Nunca considera meses futuros como queda. Meta é comparada com o valor
 * proporcional ao período decorrido.
 */

import type { PontoMensal } from './periodoEfetivo';

export type Health = 'critico' | 'atencao' | 'saudavel' | 'excelente';

export interface HealthSignal {
  key: string;
  score: number; // 0..100
  peso: number;
  label: string;
  impacto: 'positivo' | 'neutro' | 'negativo';
  detalhe?: string;
}

export interface HealthResult {
  status: Health;
  score: number;
  titulo: string;
  justificativa: string;
  sinais: HealthSignal[];
}

export interface HealthInput {
  receita: number;
  despesas: number;
  lucro: number;
  aReceber: number;
  aPagar: number;
  metaReceitaProporcional: number;
  dadosMensaisReais: PontoMensal[];
  temDados: boolean; // false quando não há nenhum mês real
  /**
   * true quando o último ponto de `dadosMensaisReais` corresponde ao mês
   * corrente ainda em curso. Nesse caso, o slope de tendência descarta o
   * mês parcial para não fabricar uma "queda" artificial contra meses
   * fechados anteriores.
   */
  mesCorrenteParcial?: boolean;
}

function scoreMargem(margem: number): { score: number; label: string; impacto: HealthSignal['impacto']; detalhe: string } {
  if (margem < 0) return { score: 0, label: 'Margem negativa', impacto: 'negativo', detalhe: `margem ${margem.toFixed(1)}%` };
  if (margem < 10) return { score: 30, label: 'Margem baixa', impacto: 'negativo', detalhe: `margem ${margem.toFixed(1)}%` };
  if (margem < 20) return { score: 60, label: 'Margem razoável', impacto: 'neutro', detalhe: `margem ${margem.toFixed(1)}%` };
  if (margem < 30) return { score: 85, label: 'Margem saudável', impacto: 'positivo', detalhe: `margem ${margem.toFixed(1)}%` };
  return { score: 100, label: 'Margem elevada', impacto: 'positivo', detalhe: `margem ${margem.toFixed(1)}%` };
}

function scoreMeta(cumprimento: number): { score: number; label: string; impacto: HealthSignal['impacto']; detalhe: string } {
  if (cumprimento < 60) return { score: 30, label: 'Abaixo da meta do período', impacto: 'negativo', detalhe: `${cumprimento.toFixed(0)}% da meta esperada` };
  if (cumprimento < 85) return { score: 60, label: 'Próximo da meta do período', impacto: 'neutro', detalhe: `${cumprimento.toFixed(0)}% da meta esperada` };
  if (cumprimento < 95) return { score: 85, label: 'Quase batendo a meta', impacto: 'positivo', detalhe: `${cumprimento.toFixed(0)}% da meta esperada` };
  if (cumprimento <= 120) return { score: 100, label: 'Meta do período atingida', impacto: 'positivo', detalhe: `${cumprimento.toFixed(0)}% da meta esperada` };
  return { score: 95, label: 'Meta do período superada', impacto: 'positivo', detalhe: `${cumprimento.toFixed(0)}% da meta esperada` };
}

function slopeReceita(reais: PontoMensal[], mesCorrenteParcial: boolean): number {
  // Descarta o mês corrente ainda em curso — comparar mês parcial contra
  // meses fechados sempre parece "queda" e derruba o score indevidamente.
  const base = mesCorrenteParcial ? reais.slice(0, -1) : reais;
  const n = base.length;
  if (n < 2) return 0;
  const ultimos = base.slice(-Math.min(3, n));
  const xs = ultimos.map((_, i) => i);
  const ys = ultimos.map(p => p.receita);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0, den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

export function computeHealth(input: HealthInput): HealthResult {
  const {
    receita, despesas, lucro, aReceber, aPagar,
    metaReceitaProporcional, dadosMensaisReais, temDados,
    mesCorrenteParcial = false,
  } = input;

  if (!temDados) {
    return {
      status: 'atencao',
      score: 50,
      titulo: 'Sem dados suficientes',
      justificativa: 'Ainda não há movimentações registradas no período selecionado para gerar um diagnóstico.',
      sinais: [],
    };
  }

  const sinais: HealthSignal[] = [];

  // 1. Margem — peso 25
  const margem = receita > 0 ? (lucro / receita) * 100 : 0;
  const sM = scoreMargem(margem);
  sinais.push({ key: 'margem', peso: 25, score: sM.score, label: sM.label, impacto: sM.impacto, detalhe: sM.detalhe });

  // 2. Meta proporcional — peso 20 (só se houver meta)
  let cumprimentoMeta = 0;
  if (metaReceitaProporcional > 0) {
    cumprimentoMeta = (receita / metaReceitaProporcional) * 100;
    const sMeta = scoreMeta(cumprimentoMeta);
    sinais.push({ key: 'meta_proporcional', peso: 20, score: sMeta.score, label: sMeta.label, impacto: sMeta.impacto, detalhe: sMeta.detalhe });
  }

  // 3. Saldo acumulado — peso 15
  const saldo = dadosMensaisReais.length
    ? dadosMensaisReais[dadosMensaisReais.length - 1].saldoAcumulado ?? (receita - despesas)
    : receita - despesas;
  let scoreSaldo = 20, labelSaldo = 'Saldo negativo', impSaldo: HealthSignal['impacto'] = 'negativo';
  if (saldo >= 0) {
    const anterior = dadosMensaisReais.length >= 2
      ? dadosMensaisReais[dadosMensaisReais.length - 2].saldoAcumulado ?? saldo
      : saldo;
    if (saldo > anterior) { scoreSaldo = 100; labelSaldo = 'Saldo positivo e crescendo'; impSaldo = 'positivo'; }
    else { scoreSaldo = 80; labelSaldo = 'Saldo positivo estável'; impSaldo = 'positivo'; }
  }
  sinais.push({ key: 'saldo', peso: 15, score: scoreSaldo, label: labelSaldo, impacto: impSaldo });

  // 4. Tendência da receita — peso 15 (mês parcial descartado)
  const slope = slopeReceita(dadosMensaisReais, mesCorrenteParcial);
  let scoreTend = 60, labelTend = 'Receita estável', impTend: HealthSignal['impacto'] = 'neutro';
  if (slope > receita * 0.02) { scoreTend = 95; labelTend = 'Receita em crescimento'; impTend = 'positivo'; }
  else if (slope < -receita * 0.02) { scoreTend = 30; labelTend = 'Receita desacelerando'; impTend = 'negativo'; }
  sinais.push({ key: 'tendencia', peso: 15, score: scoreTend, label: labelTend, impacto: impTend });

  // 5. Cobertura A Receber vs A Pagar — peso 10
  let scoreCob = 100, labelCob = 'A receber cobre pendências', impCob: HealthSignal['impacto'] = 'positivo';
  if (aPagar > 0) {
    const cob = aReceber / aPagar;
    if (cob >= 1) { scoreCob = 100; labelCob = 'A receber cobre pendências'; impCob = 'positivo'; }
    else if (cob >= 0.6) { scoreCob = 70; labelCob = 'Cobertura parcial de pendências'; impCob = 'neutro'; }
    else { scoreCob = 30; labelCob = 'Pendências acima do a receber'; impCob = 'negativo'; }
  }
  sinais.push({ key: 'cobertura', peso: 10, score: scoreCob, label: labelCob, impacto: impCob });

  // 6. Despesas vs Receita — peso 15
  const razao = receita > 0 ? despesas / receita : 1;
  let scoreDR = 60, labelDR = 'Despesas em nível intermediário', impDR: HealthSignal['impacto'] = 'neutro';
  if (razao <= 0.6) { scoreDR = 100; labelDR = 'Despesas controladas'; impDR = 'positivo'; }
  else if (razao <= 0.9) { scoreDR = 60; labelDR = 'Despesas em nível intermediário'; impDR = 'neutro'; }
  else { scoreDR = 20; labelDR = 'Despesas próximas ou acima da receita'; impDR = 'negativo'; }
  sinais.push({
    key: 'despesa_receita', peso: 15, score: scoreDR, label: labelDR, impacto: impDR,
    detalhe: receita > 0 ? `${(razao * 100).toFixed(0)}% da receita` : undefined,
  });

  // 7. Lucro absoluto vs meta — peso 10 (só se houver meta)
  if (metaReceitaProporcional > 0) {
    const lucroSobreMeta = (lucro / metaReceitaProporcional) * 100;
    let scoreLA = 60, labelLA = 'Lucro moderado no período', impLA: HealthSignal['impacto'] = 'neutro';
    if (lucro < 0) { scoreLA = 20; labelLA = 'Prejuízo no período'; impLA = 'negativo'; }
    else if (lucroSobreMeta >= 40) { scoreLA = 100; labelLA = 'Lucro expressivo no período'; impLA = 'positivo'; }
    else if (lucroSobreMeta >= 20) { scoreLA = 80; labelLA = 'Lucro consistente no período'; impLA = 'positivo'; }
    sinais.push({
      key: 'lucro_absoluto', peso: 10, score: scoreLA, label: labelLA, impacto: impLA,
      detalhe: `${lucroSobreMeta.toFixed(0)}% da meta em lucro`,
    });
  }

  // Score final ponderado
  const pesoTotal = sinais.reduce((s, x) => s + x.peso, 0);
  let score = pesoTotal > 0 ? sinais.reduce((s, x) => s + x.score * x.peso, 0) / pesoTotal : 0;

  // Override "Excelente" por fundamentos: quando os pilares primários
  // (margem, meta, lucro, saldo) estão claramente sólidos, um sinal
  // secundário fraco não deve rebaixar o diagnóstico geral.
  const fundamentosExcelentes =
    margem >= 30 &&
    cumprimentoMeta >= 90 &&
    lucro > 0 &&
    saldo >= 0;

  let status: Health;
  let titulo: string;
  if (fundamentosExcelentes) {
    status = 'excelente';
    titulo = 'Excelente';
    score = Math.max(score, 88);
  } else if (score >= 85) { status = 'excelente'; titulo = 'Excelente'; }
  else if (score >= 70) { status = 'saudavel'; titulo = 'Saudável'; }
  else if (score >= 50) { status = 'atencao'; titulo = 'Requer atenção'; }
  else { status = 'critico'; titulo = 'Crítico'; }

  // Justificativa: escolher 2 sinais mais relevantes
  const positivos = sinais.filter(s => s.impacto === 'positivo').sort((a, b) => b.score * b.peso - a.score * a.peso);
  const negativos = sinais.filter(s => s.impacto === 'negativo').sort((a, b) => (100 - a.score) * a.peso - (100 - b.score) * b.peso);

  let justificativa = '';
  if (status === 'excelente' || status === 'saudavel') {
    const dois = positivos.slice(0, 2);
    if (dois.length) {
      justificativa = dois.map(s => s.detalhe ? `${s.label.toLowerCase()} (${s.detalhe})` : s.label.toLowerCase()).join(' e ');
      justificativa = capitalize(justificativa) + '.';
    } else {
      justificativa = 'Indicadores dentro do esperado para o período.';
    }
  } else {
    const dois = negativos.slice(0, 2);
    if (dois.length) {
      justificativa = dois.map(s => s.detalhe ? `${s.label.toLowerCase()} (${s.detalhe})` : s.label.toLowerCase()).join(' e ');
      justificativa = capitalize(justificativa) + '.';
    } else {
      justificativa = 'Alguns indicadores merecem acompanhamento.';
    }
  }

  return { status, score, titulo, justificativa, sinais };
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}
