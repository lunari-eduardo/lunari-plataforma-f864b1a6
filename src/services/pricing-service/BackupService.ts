import { STORAGE_KEYS } from "@/utils/localStorage";
import type { BackupPrecificacao } from "@/types/precificacao";
import { EstruturaCustosService } from "./EstruturaCustosService";
import { PadraoHorasService } from "./PadraoHorasService";
import { MetasService } from "./MetasService";
import { CalculadoraService } from "./CalculadoraService";
import { VERSAO_ATUAL, USUARIO_LOCAL } from "./constants";

export class BackupService {
  static criarBackup(): BackupPrecificacao {
    const agora = new Date().toISOString();

    return {
      versao: VERSAO_ATUAL,
      dataExport: agora,
      user_id: USUARIO_LOCAL,
      estruturaCustos: EstruturaCustosService.carregar(),
      padraoHoras: PadraoHorasService.carregar(),
      metas: MetasService.carregar(),
      estadosCalculadora: CalculadoraService.carregar() ? [CalculadoraService.carregar()!] : [],
      configuracaoSistema: {
        versaoApp: VERSAO_ATUAL,
        chavesStorage: Object.values(STORAGE_KEYS).filter(
          (key) => key.includes("pricing") || key.includes("PRICING"),
        ),
      },
    };
  }

  static exportarJSON(): string {
    const backup = this.criarBackup();
    return JSON.stringify(backup, null, 2);
  }

  static downloadBackup(): void {
    const backupData = this.exportarJSON();
    const blob = new Blob([backupData], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `backup-precificacao-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
    console.log("📥 Backup baixado com sucesso");
  }
}
