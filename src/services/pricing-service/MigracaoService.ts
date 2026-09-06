import { storage } from "@/utils/localStorage";
import { EstruturaCustosService } from "./EstruturaCustosService";
import { PadraoHorasService } from "./PadraoHorasService";
import { MetasService } from "./MetasService";
import { USUARIO_LOCAL } from "./constants";

export class MigracaoService {
  static migrarDadosAntigos(): boolean {
    try {
      console.log("🔄 Iniciando migração de dados antigos...");

      // Migrar estrutura de custos fixos
      const custosAntigos = storage.load("precificacao_custos_fixos", null);
      if (custosAntigos) {
        console.log("🔄 Migrando estrutura de custos...");
        EstruturaCustosService.salvar({
          ...custosAntigos,
          totalCalculado: 0, // Será recalculado
          user_id: USUARIO_LOCAL,
          created_at: new Date().toISOString(),
        });
        storage.remove("precificacao_custos_fixos");
      }

      // Migrar padrão de horas
      const horasAntigas = storage.load("precificacao_padrao_horas", null);
      if (horasAntigas) {
        console.log("🔄 Migrando padrão de horas...");
        PadraoHorasService.salvar({
          ...horasAntigas,
          user_id: USUARIO_LOCAL,
          created_at: new Date().toISOString(),
        });
        storage.remove("precificacao_padrao_horas");
      }

      // Migrar metas
      const metasAntigas = storage.load("precificacao_metas", null);
      if (metasAntigas) {
        console.log("🔄 Migrando metas...");
        const currentYear = new Date().getFullYear();
        MetasService.salvar({
          ...metasAntigas,
          ano: currentYear,
          metaFaturamentoAnual: 0, // Será recalculado
          metaLucroAnual: 0, // Será recalculado
          user_id: USUARIO_LOCAL,
          created_at: new Date().toISOString(),
        });
        storage.remove("precificacao_metas");
      }

      console.log("✅ Migração concluída com sucesso");
      return true;
    } catch (error) {
      console.error("❌ Erro na migração:", error);
      return false;
    }
  }
}
