import type { DadosValidacao } from "@/types/precificacao";
import { EstruturaCustosService } from "./EstruturaCustosService";
import { PadraoHorasService } from "./PadraoHorasService";
import { MetasService } from "./MetasService";
import { CalculadoraService } from "./CalculadoraService";

export class ValidacaoService {
  static validarTodosSistemas(): DadosValidacao {
    const agora = new Date().toISOString();

    try {
      // Validar estrutura de custos
      const estrutura = EstruturaCustosService.carregar();
      const errosEstrutura = EstruturaCustosService.validar(estrutura);

      // Validar padrão de horas
      const horas = PadraoHorasService.carregar();
      const horasValido = horas.horasDisponiveis > 0 && horas.diasTrabalhados > 0;

      // Validar metas
      const metas = MetasService.carregar();
      const metasValido = metas.margemLucroDesejada >= 0;

      // Validar calculadora (pode não existir)
      CalculadoraService.carregar();
      const calculadoraValido = true; // Opcional

      const validacao: DadosValidacao = {
        estruturaCustos: errosEstrutura.length === 0,
        padraoHoras: horasValido,
        metas: metasValido,
        calculadora: calculadoraValido,
        ultimaValidacao: agora,
      };

      console.log("🔍 Validação concluída:", validacao);
      return validacao;
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

  static recuperarDadosCorrompidos(): boolean {
    try {
      console.log("🔧 Iniciando recuperação de dados corrompidos...");

      // Verificar e recrear estrutura de custos se necessário
      try {
        EstruturaCustosService.carregar();
      } catch {
        console.log("🔧 Recriando estrutura de custos...");
        EstruturaCustosService.salvar(EstruturaCustosService.criarPadrao());
      }

      // Verificar e recrear padrão de horas se necessário
      try {
        PadraoHorasService.carregar();
      } catch {
        console.log("🔧 Recriando padrão de horas...");
        PadraoHorasService.salvar(PadraoHorasService.criarPadrao());
      }

      // Verificar e recrear metas se necessário
      try {
        MetasService.carregar();
      } catch {
        console.log("🔧 Recriando metas...");
        MetasService.salvar(MetasService.criarPadrao());
      }

      console.log("✅ Recuperação concluída com sucesso");
      return true;
    } catch (error) {
      console.error("❌ Erro na recuperação:", error);
      return false;
    }
  }
}
