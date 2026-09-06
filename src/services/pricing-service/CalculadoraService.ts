import { storage, STORAGE_KEYS } from "@/utils/localStorage";
import type { EstadoCalculadora } from "@/types/precificacao";
import { USUARIO_LOCAL } from "./constants";

export class CalculadoraService {
  static salvar(dados: EstadoCalculadora, autoSave = true): boolean {
    try {
      const dadosComMetadata = {
        ...dados,
        user_id: USUARIO_LOCAL,
        salvo_automaticamente: autoSave,
        updated_at: new Date().toISOString(),
      };

      storage.save(STORAGE_KEYS.PRICING_CALCULATOR_STATE, dadosComMetadata);
      if (autoSave) {
        console.log("✅ Estado da calculadora salvo automaticamente");
      } else {
        console.log("✅ Estado da calculadora salvo manualmente");
      }
      return true;
    } catch (error) {
      console.error("❌ Erro ao salvar estado da calculadora:", error);
      return false;
    }
  }

  static carregar(): EstadoCalculadora | null {
    try {
      const dados = storage.load(STORAGE_KEYS.PRICING_CALCULATOR_STATE, null);

      if (dados) {
        console.log("✅ Estado da calculadora carregado");
        return dados;
      } else {
        console.log("ℹ️ Nenhum estado da calculadora encontrado");
        return null;
      }
    } catch (error) {
      console.error("❌ Erro ao carregar estado da calculadora:", error);
      return null;
    }
  }

  static limpar(): boolean {
    try {
      storage.remove(STORAGE_KEYS.PRICING_CALCULATOR_STATE);
      console.log("✅ Estado da calculadora limpo");
      return true;
    } catch (error) {
      console.error("❌ Erro ao limpar estado da calculadora:", error);
      return false;
    }
  }

  static criarPadrao(): EstadoCalculadora {
    return {
      horasEstimadas: 0,
      markup: 2,
      produtos: [],
      custosExtras: [],
      custoTotalCalculado: 0,
      precoFinalCalculado: 0,
      lucratividade: 0,
      salvo_automaticamente: false,
      user_id: USUARIO_LOCAL,
      created_at: new Date().toISOString(),
    };
  }
}
