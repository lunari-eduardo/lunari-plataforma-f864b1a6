import type { EstruturaCustosFixos, PadraoHoras } from '@/types/precificacao';

export const calcularTotalEstrutura = (dados: EstruturaCustosFixos): number => {
  const totalGastos = dados.gastosPessoais.reduce((sum, g) => sum + g.valor, 0);
  const proLaboreCalculado = totalGastos * (1 + dados.percentualProLabore / 100);
  const totalCustos = dados.custosEstudio.reduce((sum, c) => sum + c.valor, 0);
  const totalDepreciacao = dados.equipamentos.reduce(
    (sum, eq) => sum + eq.valorPago / (eq.vidaUtil * 12),
    0,
  );

  return proLaboreCalculado + totalCustos + totalDepreciacao;
};

export const calcularCustosFixosHora = (
  totalCustosFixos: number,
  padraoHoras: PadraoHoras | null,
): number => {
  const horasPorMes =
    (padraoHoras?.horasDisponiveis || 8) * (padraoHoras?.diasTrabalhados || 5) * 4;
  return horasPorMes > 0 ? totalCustosFixos / horasPorMes : 0;
};
