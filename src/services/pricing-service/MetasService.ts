import { storage, STORAGE_KEYS } from "@/utils/localStorage";
import type { MetasPrecificacao } from "@/types/precificacao";
import { USUARIO_LOCAL } from "./constants";

export class MetasService {
  static salvar(dados: MetasPrecificacao): boolean {
    try {
      const dadosComMetadata = {
        ...dados,
        user_id: USUARIO_LOCAL,
        updated_at: new Date().toISOString(),
      };

      storage.save(STORAGE_KEYS.PRICING_GOALS, dadosComMetadata);
      console.log("✅ Metas salvas com sucesso");
      return true;
    } catch (error) {
      console.error("❌ Erro ao salvar metas:", error);
      return false;
    }
  }

  static carregar(): MetasPrecificacao {
    try {
      const currentYear = new Date().getFullYear();
      const dados = storage.load(STORAGE_KEYS.PRICING_GOALS, {
        margemLucroDesejada: 30,
        ano: currentYear,
        metaFaturamentoAnual: 0,
        metaLucroAnual: 0,
        user_id: USUARIO_LOCAL,
        created_at: new Date().toISOString(),
      });

      console.log("✅ Metas carregadas");
      return dados;
    } catch (error) {
      console.error("❌ Erro ao carregar metas:", error);
      return this.criarPadrao();
    }
  }

  static criarPadrao(): MetasPrecificacao {
    const currentYear = new Date().getFullYear();
    return {
      margemLucroDesejada: 30,
      ano: currentYear,
      metaFaturamentoAnual: 0,
      metaLucroAnual: 0,
      user_id: USUARIO_LOCAL,
      created_at: new Date().toISOString(),
    };
  }
}
