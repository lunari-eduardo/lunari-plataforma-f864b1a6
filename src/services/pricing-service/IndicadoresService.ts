import type { StatusSalvamento, IndicadorSalvamento } from "@/types/precificacao";

export class IndicadoresService {
  private static indicadores: Map<string, IndicadorSalvamento> = new Map();

  static atualizarIndicador(componente: string, status: StatusSalvamento, mensagem?: string): void {
    const agora = new Date().toISOString();

    this.indicadores.set(componente, {
      status,
      ultimoSalvamento: status === "salvo" ? agora : this.indicadores.get(componente)?.ultimoSalvamento,
      mensagem,
    });
  }

  static obterIndicador(componente: string): IndicadorSalvamento {
    return (
      this.indicadores.get(componente) || {
        status: "nao_salvo",
        mensagem: "Dados não salvos",
      }
    );
  }

  static obterTodosIndicadores(): Record<string, IndicadorSalvamento> {
    const resultado: Record<string, IndicadorSalvamento> = {};
    for (const [componente, indicador] of this.indicadores) {
      resultado[componente] = indicador;
    }
    return resultado;
  }
}
