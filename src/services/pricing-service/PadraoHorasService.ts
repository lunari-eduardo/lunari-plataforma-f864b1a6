import { storage, STORAGE_KEYS } from "@/utils/localStorage";
import type { PadraoHoras } from "@/types/precificacao";
import { USUARIO_LOCAL } from "./constants";

export class PadraoHorasService {
  static salvar(dados: PadraoHoras): boolean {
    try {
      const dadosComMetadata = {
        ...dados,
        user_id: USUARIO_LOCAL,
        updated_at: new Date().toISOString(),
      };

      storage.save(STORAGE_KEYS.PRICING_HOUR_DEFAULTS, dadosComMetadata);
      console.log("✅ Padrão de horas salvo com sucesso");
      return true;
    } catch (error) {
      console.error("❌ Erro ao salvar padrão de horas:", error);
      return false;
    }
  }

  static carregar(): PadraoHoras {
    try {
      const dados = storage.load(STORAGE_KEYS.PRICING_HOUR_DEFAULTS, {
        horasDisponiveis: 8,
        diasTrabalhados: 5,
        user_id: USUARIO_LOCAL,
        created_at: new Date().toISOString(),
      });

      console.log("✅ Padrão de horas carregado");
      return dados;
    } catch (error) {
      console.error("❌ Erro ao carregar padrão de horas:", error);
      return this.criarPadrao();
    }
  }

  static criarPadrao(): PadraoHoras {
    return {
      horasDisponiveis: 8,
      diasTrabalhados: 5,
      user_id: USUARIO_LOCAL,
      created_at: new Date().toISOString(),
    };
  }
}
