import { Projeto } from '@/types/projeto';

// Interface simplificada para receitas mensais
export interface MonthlyRevenue {
  year: number;
  month: number;
  receitaOperacional: number;
  receitasExtras: number;
  totalReceita: number;
}

/**
 * ✅ CALCULADOR SIMPLIFICADO DE RECEITAS
 * Trabalha diretamente com Projeto[] para eliminar conversões desnecessárias
 * Esta é a fonte única de verdade para cálculos de receita
 */
export class SimpleRevenueCalculator {
  
  /**
   * ✅ FUNÇÃO PRINCIPAL: Calcula receita diretamente dos projetos
   * Elimina conversões e dupla filtragem
   */
  static calcularReceita(
    projetos: Projeto[],
    filtros: {
      year?: number;
      month?: number;
    } = {}
  ): number {
    let projetosFiltrados = projetos;

    // Debug: Log dos dados de entrada
    console.log(`🔍 [SimpleRevenueCalculator] Entrada: ${projetos.length} projetos, filtros:`, filtros);

    if (filtros.year) {
      projetosFiltrados = projetosFiltrados.filter(projeto => {
        try {
          const projetoYear = projeto.dataAgendada.getFullYear();
          return projetoYear === filtros.year;
        } catch {
          return false;
        }
      });
    }

    if (filtros.month) {
      projetosFiltrados = projetosFiltrados.filter(projeto => {
        try {
          const projetoMonth = projeto.dataAgendada.getMonth() + 1;
          return projetoMonth === filtros.month;
        } catch {
          return false;
        }
      });
    }

    const total = projetosFiltrados.reduce((sum, projeto) => sum + projeto.valorPago, 0);
    
    // Debug detalhado
    console.log(`💰 [SimpleRevenueCalculator] Resultado: ${projetosFiltrados.length} projetos filtrados, R$ ${total.toFixed(2)}`);
    console.log(`📊 [SimpleRevenueCalculator] Projetos processados:`, projetosFiltrados.map(p => ({
      id: p.projectId,
      nome: p.nome,
      data: p.dataAgendada.toDateString(),
      valorPago: p.valorPago
    })));
    
    return total;
  }

  /**
   * ✅ FUNÇÃO DE COMPATIBILIDADE: Obter dados mensais para gráficos
   */
  static obterDadosMensais(
    projetos: Projeto[], 
    year: number
  ): Array<{ mes: string; receita: number; lucro: number }> {
    const meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    
    return meses.map((nome, index) => {
      const month = index + 1;
      const receita = this.calcularReceita(projetos, { year, month });
      
      return {
        mes: nome,
        receita,
        lucro: receita // Simplificado - receita como base do lucro
      };
    });
  }

  /**
   * ✅ FUNÇÕES DE COMPATIBILIDADE: Para manter a interface existente
   * Essas funções convertem Projetos em dados compatíveis com o sistema antigo
   */
  static calcularReceitaWorkflowMes(projetos: Projeto[], year: number, month: number): number {
    return this.calcularReceita(projetos, { year, month });
  }

  static calcularReceitaWorkflowAno(projetos: Projeto[], year: number): number {
    return this.calcularReceita(projetos, { year });
  }

  /**
   * ✅ FUNÇÃO DE DEBUG: Para verificar integridade dos dados
   */
  static debugReceitas(projetos: Projeto[]): void {
    console.log('🐛 [SimpleRevenueCalculator] DEBUG - Resumo dos projetos:');
    console.log(`Total de projetos: ${projetos.length}`);
    
    const receitaTotal = projetos.reduce((sum, projeto) => sum + projeto.valorPago, 0);
    console.log(`Receita total de todos os projetos: R$ ${receitaTotal.toFixed(2)}`);
    
    // Agrupar por ano
    const porAno: Record<number, { projetos: number; receita: number }> = {};
    projetos.forEach(projeto => {
      const ano = projeto.dataAgendada.getFullYear();
      if (!porAno[ano]) porAno[ano] = { projetos: 0, receita: 0 };
      porAno[ano].projetos++;
      porAno[ano].receita += projeto.valorPago;
    });
    
    console.log('📊 Por ano:', porAno);
  }
}