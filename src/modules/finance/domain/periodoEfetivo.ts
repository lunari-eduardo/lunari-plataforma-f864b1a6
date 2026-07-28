/**
 * Período Efetivo — fonte única de verdade para "onde termina o real".
 * Evita que gráficos anuais interpretem meses futuros vazios como queda.
 */

export interface PeriodoEfetivo {
  modo: 'mensal' | 'anual' | 'personalizado';
  ano: number;
  mesAtual: number; // 1-12 (referência corrente)
  mesesDecorridos: number; // qtd de meses efetivos no ano selecionado
  ultimoMesComDados: number; // 0..12; 0 se sem dados
  temHistoricoSuficiente: boolean; // ≥3 meses reais no ano
}

export interface PontoMensal {
  mes: string;
  receita: number;
  despesas?: number;
  lucro?: number;
  saldoAcumulado?: number;
}

export interface PeriodoEfetivoOptions {
  /** Saldo inicial do ano — quando != 0 o gráfico deve renderizar mesmo sem movimentos. */
  openingBalance?: number;
  /** true enquanto qualquer fonte (workflow/transações) ainda está hidratando. */
  loading?: boolean;
}

export function calcularPeriodoEfetivo(
  ano: number,
  modo: 'mensal' | 'anual' | 'personalizado',
  dadosMensais: PontoMensal[],
  hoje: Date = new Date(),
  options: PeriodoEfetivoOptions = {},
): PeriodoEfetivo {
  const anoCorrente = hoje.getFullYear();
  const mesCorrente = hoje.getMonth() + 1;

  let mesesDecorridos = 12;
  if (ano > anoCorrente) mesesDecorridos = 0;
  else if (ano === anoCorrente) mesesDecorridos = mesCorrente;

  // Último mês com atividade (receita ou despesa > 0), limitado a mesesDecorridos
  let ultimoMesComDados = 0;
  const limite = Math.min(mesesDecorridos, dadosMensais.length);
  for (let i = 0; i < limite; i++) {
    const p = dadosMensais[i];
    if ((p.receita ?? 0) > 0 || (p.despesas ?? 0) > 0) {
      ultimoMesComDados = i + 1;
    }
  }

  // Fallback: se ainda não há movimento no ano mas existe saldo inicial OU as fontes
  // ainda estão carregando, estende para todos os meses decorridos. Assim o gráfico
  // renderiza a linha do saldo acumulado (não some), evitando o bug de "card vazio
  // até navegar pelo Workflow e voltar".
  if (ultimoMesComDados === 0 && mesesDecorridos > 0) {
    const opening = Number(options.openingBalance ?? 0);
    if (opening !== 0 || options.loading) {
      ultimoMesComDados = mesesDecorridos;
    }
  }

  return {
    modo,
    ano,
    mesAtual: mesCorrente,
    mesesDecorridos,
    ultimoMesComDados,
    temHistoricoSuficiente: ultimoMesComDados >= 3,
  };
}


/**
 * Divide dadosMensais em pontos reais (até ultimoMesComDados) e slots futuros.
 * Não gera projeção — apenas separa.
 */
export function dividirRealVsFuturo<T extends PontoMensal>(
  dadosMensais: T[],
  periodo: PeriodoEfetivo,
): { reais: T[]; futuros: T[] } {
  const corte = periodo.ultimoMesComDados;
  return {
    reais: dadosMensais.slice(0, corte),
    futuros: dadosMensais.slice(corte),
  };
}
