import type { DadosValidacao } from "@/types/precificacao";
import { loadEstruturaCustos, validateEstruturaCustos, saveEstruturaCustos } from "./costsStorage";
import { loadPadraoHoras, savePadraoHoras, loadMetas, saveMetas } from "./hoursGoalsStorage";
import { loadCalculadora, saveCalculadora } from "./calculatorStorage";

export async function validateSystem(userId: string): Promise<DadosValidacao> {
  const agora = new Date().toISOString();

  try {
    const estrutura = await loadEstruturaCustos(userId);
    const horas = await loadPadraoHoras(userId);
    const metas = await loadMetas(userId);

    const errosEstrutura = validateEstruturaCustos(estrutura);
    const horasValido = horas.horasDisponiveis > 0 && horas.diasTrabalhados > 0;
    const metasValido = metas.margemLucroDesejada >= 0;

    return {
      estruturaCustos: errosEstrutura.length === 0,
      padraoHoras: horasValido,
      metas: metasValido,
      calculadora: true,
      ultimaValidacao: agora,
    };
  } catch (error) {
    console.error("❌ Erro na validação:", error);
    return {
      estruturaCustos: false,
      padraoHoras: false,
      metas: false,
      calculadora: false,
      ultimaValidacao: agora,
    };
  }
}

export async function exportData(userId: string): Promise<string> {
  const estrutura = await loadEstruturaCustos(userId);
  const horas = await loadPadraoHoras(userId);
  const metas = await loadMetas(userId);
  const calculadora = await loadCalculadora(userId);

  const backup = {
    versao: "2.0.0",
    dataExport: new Date().toISOString(),
    user_id: userId,
    estruturaCustos: estrutura,
    padraoHoras: horas,
    metas,
    estadosCalculadora: calculadora ? [calculadora] : [],
    configuracaoSistema: {
      versaoApp: "2.0.0",
      storage: "supabase",
    },
  };

  return JSON.stringify(backup, null, 2);
}

export async function importData(userId: string, data: string): Promise<boolean> {
  try {
    const backup = JSON.parse(data);

    await saveEstruturaCustos(userId, backup.estruturaCustos);
    await savePadraoHoras(userId, backup.padraoHoras);
    await saveMetas(userId, backup.metas);

    if (backup.estadosCalculadora?.length > 0) {
      await saveCalculadora(userId, backup.estadosCalculadora[0]);
    }

    return true;
  } catch (error) {
    console.error("❌ Erro ao importar dados:", error);
    return false;
  }
}
