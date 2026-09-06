import { storage, STORAGE_KEYS } from "@/utils/localStorage";
import type { EstruturaCustosFixos } from "@/types/precificacao";
import { USUARIO_LOCAL } from "./constants";

export class EstruturaCustosService {
  static salvar(dados: EstruturaCustosFixos): boolean {
    try {
      const dadosComMetadata = {
        ...dados,
        user_id: USUARIO_LOCAL,
        updated_at: new Date().toISOString(),
      };

      storage.save(STORAGE_KEYS.PRICING_FIXED_COSTS, dadosComMetadata);
      console.log("✅ Estrutura de custos salva com sucesso");
      return true;
    } catch (error) {
      console.error("❌ Erro ao salvar estrutura de custos:", error);
      return false;
    }
  }

  static carregar(): EstruturaCustosFixos {
    try {
      const defaults = {
        gastosPessoais: [],
        percentualProLabore: 30,
        custosEstudio: [],
        equipamentos: [],
        totalCalculado: 0,
        user_id: USUARIO_LOCAL,
        created_at: new Date().toISOString(),
      };
      const dadosBrutos = storage.load(STORAGE_KEYS.PRICING_FIXED_COSTS, defaults);
      const dados = {
        ...defaults,
        ...dadosBrutos,
        gastosPessoais: Array.isArray(dadosBrutos?.gastosPessoais) ? dadosBrutos.gastosPessoais : [],
        custosEstudio: Array.isArray(dadosBrutos?.custosEstudio) ? dadosBrutos.custosEstudio : [],
        equipamentos: Array.isArray(dadosBrutos?.equipamentos) ? dadosBrutos.equipamentos : [],
      } as EstruturaCustosFixos;

      console.log("✅ Estrutura de custos carregada");
      return dados;
    } catch (error) {
      console.error("❌ Erro ao carregar estrutura de custos:", error);
      return this.criarPadrao();
    }
  }

  static criarPadrao(): EstruturaCustosFixos {
    return {
      gastosPessoais: [],
      percentualProLabore: 30,
      custosEstudio: [],
      equipamentos: [],
      totalCalculado: 0,
      user_id: USUARIO_LOCAL,
      created_at: new Date().toISOString(),
    };
  }

  static validar(dados: EstruturaCustosFixos): string[] {
    const erros = [];

    if (dados.percentualProLabore < 0 || dados.percentualProLabore > 200) {
      erros.push("Percentual de pró-labore deve estar entre 0% e 200%");
    }

    // Validar gastos pessoais
    dados.gastosPessoais.forEach((gasto, index) => {
      if (!gasto.descricao || gasto.descricao.trim() === "") {
        erros.push(`Gasto pessoal ${index + 1}: Descrição é obrigatória`);
      }
      if (gasto.valor < 0) {
        erros.push(`Gasto pessoal ${index + 1}: Valor não pode ser negativo`);
      }
    });

    // Validar equipamentos
    dados.equipamentos.forEach((eq, index) => {
      if (!eq.nome || eq.nome.trim() === "") {
        erros.push(`Equipamento ${index + 1}: Nome é obrigatório`);
      }
      if (eq.valorPago < 0) {
        erros.push(`Equipamento ${index + 1}: Valor pago não pode ser negativo`);
      }
      if (eq.vidaUtil <= 0) {
        erros.push(`Equipamento ${index + 1}: Vida útil deve ser maior que zero`);
      }
    });

    return erros;
  }

  /**
   * Adiciona um equipamento diretamente à estrutura existente
   */
  static adicionarEquipamento(equipamento: {
    nome: string;
    valorPago: number;
    dataCompra: string;
    vidaUtil: number;
  }): boolean {
    try {
      console.log("🔧 [EstruturaCustos] Adicionando equipamento:", equipamento);

      // Carregar dados atuais
      const dadosAtuais = this.carregar();

      // Criar novo equipamento
      const novoEquipamento = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        nome: equipamento.nome,
        valorPago: equipamento.valorPago,
        dataCompra: equipamento.dataCompra || new Date().toISOString().split("T")[0],
        vidaUtil: equipamento.vidaUtil || 5,
      };

      // Adicionar à lista
      const equipamentosAtualizados = [...dadosAtuais.equipamentos, novoEquipamento];

      // Recalcular total
      const totalDepreciacaoMensal = equipamentosAtualizados.reduce((total, eq) => {
        return total + eq.valorPago / (eq.vidaUtil * 12);
      }, 0);

      const totalGastosPessoais = dadosAtuais.gastosPessoais.reduce(
        (total, item) => total + item.valor,
        0,
      );
      const proLaboreCalculado =
        totalGastosPessoais * (1 + dadosAtuais.percentualProLabore / 100);
      const totalCustosEstudio = dadosAtuais.custosEstudio.reduce(
        (total, item) => total + item.valor,
        0,
      );
      const novoTotal = proLaboreCalculado + totalCustosEstudio + totalDepreciacaoMensal;

      // Salvar dados atualizados
      const dadosAtualizados = {
        ...dadosAtuais,
        equipamentos: equipamentosAtualizados,
        totalCalculado: novoTotal,
      };

      const sucesso = this.salvar(dadosAtualizados);

      if (sucesso) {
        console.log("✅ [EstruturaCustos] Equipamento adicionado com sucesso");
        return true;
      } else {
        console.error("❌ [EstruturaCustos] Falha ao salvar equipamento");
        return false;
      }
    } catch (error) {
      console.error("❌ [EstruturaCustos] Erro ao adicionar equipamento:", error);
      return false;
    }
  }
}
